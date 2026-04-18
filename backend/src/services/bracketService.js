const { db } = require('../config/database');

/**
 * Bracket-Service: KO-Turnier, LK-Tagesturnier und Doppelturnier
 */

// KO-Turnier generieren
function generateKOBracket(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) throw new Error('Turnier nicht gefunden');

  const registrations = db.prepare(
    `SELECT tr.*, u.name, u.lk, tr.seed_number 
     FROM tournament_registrations tr 
     JOIN users u ON tr.user_id = u.id 
     WHERE tr.tournament_id = ? AND tr.status = ? 
     ORDER BY COALESCE(tr.seed_number, 999), u.lk ASC`
  ).all(tournamentId, 'approved');

  if (registrations.length < 2) throw new Error('Mindestens 2 Spieler benötigt');

  const n = registrations.length;
  // Aufrunden auf nächste Zweierpotenz
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const totalRounds = Math.log2(bracketSize);
  const totalMatches = bracketSize - 1;

  const transaction = db.transaction(() => {
    // Aufräumen
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM rounds WHERE tournament_id = ?').run(tournamentId);

    // Runden erstellen
    const roundNames = [];
    for (let r = 1; r <= totalRounds; r++) {
      let name;
      const remaining = bracketSize / Math.pow(2, r - 1);
      if (remaining === 2) name = 'Finale';
      else if (remaining === 4) name = 'Halbfinale';
      else if (remaining === 8) name = 'Viertelfinale';
      else name = `Runde ${r} (${remaining}er)`;
      
      const result = db.prepare(
        'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, ?, ?, ?)'
      ).run(tournamentId, r, name, 'pending');
      roundNames.push({ id: result.lastInsertRowid, roundNumber: r, name });
    }

    // Seeding: Platziere Gesetzte an Standardpositionen
    const seeded = seedPlayers(registrations, bracketSize);

    // Erste Runde Matches erstellen
    const firstRound = roundNames[0];
    const matchesInFirstRound = bracketSize / 2;
    const matchIds = [];

    for (let i = 0; i < matchesInFirstRound; i++) {
      const p1 = seeded[i * 2] || null;
      const p2 = seeded[i * 2 + 1] || null;

      const result = db.prepare(
        `INSERT INTO matches (tournament_id, round_id, match_number, player1_id, player2_id, bracket_position) 
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        tournamentId, firstRound.id, i + 1,
        p1 ? p1.user_id : null,
        p2 ? p2.user_id : null,
        i + 1
      );
      matchIds.push(result.lastInsertRowid);

      // Freilos: Wenn nur ein Spieler, automatisch weiter
      if ((p1 && !p2) || (!p1 && p2)) {
        const winnerId = p1 ? p1.user_id : p2.user_id;
        db.prepare('UPDATE matches SET winner_id = ?, result_status = ?, walkover = 1, score = ? WHERE id = ?')
          .run(winnerId, 'confirmed', 'Freilos', result.lastInsertRowid);
      }
    }

    // Folgerunden-Matches erstellen
    let previousMatchIds = matchIds;
    for (let r = 1; r < totalRounds; r++) {
      const round = roundNames[r];
      const matchesInRound = previousMatchIds.length / 2;
      const newMatchIds = [];

      for (let i = 0; i < matchesInRound; i++) {
        const result = db.prepare(
          `INSERT INTO matches (tournament_id, round_id, match_number, bracket_position) 
           VALUES (?, ?, ?, ?)`
        ).run(tournamentId, round.id, i + 1, i + 1);
        
        // Verknüpfe vorherige Matches
        db.prepare('UPDATE matches SET next_match_id = ? WHERE id = ?')
          .run(result.lastInsertRowid, previousMatchIds[i * 2]);
        db.prepare('UPDATE matches SET next_match_id = ? WHERE id = ?')
          .run(result.lastInsertRowid, previousMatchIds[i * 2 + 1]);

        newMatchIds.push(result.lastInsertRowid);

        // Freilos-Gewinner in nächste Runde
        const m1 = db.prepare('SELECT * FROM matches WHERE id = ?').get(previousMatchIds[i * 2]);
        const m2 = db.prepare('SELECT * FROM matches WHERE id = ?').get(previousMatchIds[i * 2 + 1]);

        if (m1 && m1.winner_id && m2 && m2.winner_id) {
          db.prepare('UPDATE matches SET player1_id = ?, player2_id = ? WHERE id = ?')
            .run(m1.winner_id, m2.winner_id, result.lastInsertRowid);
        } else if (m1 && m1.winner_id) {
          db.prepare('UPDATE matches SET player1_id = ? WHERE id = ?')
            .run(m1.winner_id, result.lastInsertRowid);
        } else if (m2 && m2.winner_id) {
          db.prepare('UPDATE matches SET player2_id = ? WHERE id = ?')
            .run(m2.winner_id, result.lastInsertRowid);
        }
      }

      previousMatchIds = newMatchIds;
    }
  });

  transaction();
  return { bracketSize, totalRounds };
}

// Spieler seeden
function seedPlayers(registrations, bracketSize) {
  const positions = new Array(bracketSize).fill(null);
  
  // Standard-Setzpositionen für Turnierformat
  if (registrations.length > 0) positions[0] = registrations[0]; // Setzplatz 1 oben
  if (registrations.length > 1) positions[bracketSize - 1] = registrations[1]; // Setzplatz 2 unten
  if (registrations.length > 2 && bracketSize >= 4) {
    positions[bracketSize / 2] = registrations[2]; // Setzplatz 3 Mitte unten
  }
  if (registrations.length > 3 && bracketSize >= 4) {
    positions[bracketSize / 2 - 1] = registrations[3]; // Setzplatz 4 Mitte oben
  }

  // Rest zufällig verteilen
  const remaining = registrations.slice(Math.min(4, registrations.length));
  const emptyPositions = [];
  for (let i = 0; i < bracketSize; i++) {
    if (!positions[i]) emptyPositions.push(i);
  }

  // Shuffeln
  for (let i = emptyPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emptyPositions[i], emptyPositions[j]] = [emptyPositions[j], emptyPositions[i]];
  }

  for (let i = 0; i < remaining.length && i < emptyPositions.length; i++) {
    positions[emptyPositions[i]] = remaining[i];
  }

  return positions;
}

// Spieler in nächste KO-Runde befördern
function advanceWinner(matchId) {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match || !match.winner_id || !match.next_match_id) return;

  const nextMatch = db.prepare('SELECT * FROM matches WHERE id = ?').get(match.next_match_id);
  if (!nextMatch) return;

  // Finde heraus welche zwei Matches in die nächste Runde führen
  const feedingMatches = db.prepare('SELECT * FROM matches WHERE next_match_id = ? ORDER BY bracket_position').all(match.next_match_id);

  if (feedingMatches[0] && feedingMatches[0].id === matchId) {
    db.prepare('UPDATE matches SET player1_id = ? WHERE id = ?').run(match.winner_id, match.next_match_id);
  } else {
    db.prepare('UPDATE matches SET player2_id = ? WHERE id = ?').run(match.winner_id, match.next_match_id);
  }
}

// LK-Tagesturnier generieren
function generateLKDayTournament(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) throw new Error('Turnier nicht gefunden');

  const registrations = db.prepare(
    `SELECT tr.*, u.name, u.lk 
     FROM tournament_registrations tr 
     JOIN users u ON tr.user_id = u.id 
     WHERE tr.tournament_id = ? AND tr.status = ? 
     ORDER BY u.lk ASC`
  ).all(tournamentId, 'approved');

  if (registrations.length < 3) throw new Error('Mindestens 3 Spieler benötigt');

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM rounds WHERE tournament_id = ?').run(tournamentId);

    // Runde 1: Gegen LK-Besseren
    const round1 = db.prepare(
      'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, ?, ?, ?)'
    ).run(tournamentId, 1, 'Runde 1 - Gegen LK-Besseren', 'pending');

    // Runde 2: Gegen LK-Schwächeren
    const round2 = db.prepare(
      'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, ?, ?, ?)'
    ).run(tournamentId, 2, 'Runde 2 - Gegen LK-Schwächeren', 'pending');

    // Paarungen: Jeder spielt gegen den nächstbesseren und nächstschwächeren
    for (let i = 0; i < registrations.length; i++) {
      const player = registrations[i];

      // Gegen Besseren (niedrigere LK = besserer Spieler)
      if (i > 0) {
        const better = registrations[i - 1];
        // Prüfe ob dieses Match schon existiert (Duplikat vermeiden)
        const existing = db.prepare(
          'SELECT id FROM matches WHERE tournament_id = ? AND round_id = ? AND ((player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?))'
        ).get(tournamentId, round1.lastInsertRowid, player.user_id, better.user_id, better.user_id, player.user_id);
        
        if (!existing) {
          db.prepare(
            'INSERT INTO matches (tournament_id, round_id, match_number, player1_id, player2_id) VALUES (?, ?, ?, ?, ?)'
          ).run(tournamentId, round1.lastInsertRowid, i, player.user_id, better.user_id);
        }
      }

      // Gegen Schwächeren (höhere LK = schwächerer Spieler)
      if (i < registrations.length - 1) {
        const worse = registrations[i + 1];
        const existing = db.prepare(
          'SELECT id FROM matches WHERE tournament_id = ? AND round_id = ? AND ((player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?))'
        ).get(tournamentId, round2.lastInsertRowid, player.user_id, worse.user_id, worse.user_id, player.user_id);
        
        if (!existing) {
          db.prepare(
            'INSERT INTO matches (tournament_id, round_id, match_number, player1_id, player2_id) VALUES (?, ?, ?, ?, ?)'
          ).run(tournamentId, round2.lastInsertRowid, i + 1, player.user_id, worse.user_id);
        }
      }
    }
  });

  transaction();
}

// Doppelturnier generieren
function generateDoublesTournament(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) throw new Error('Turnier nicht gefunden');

  const registrations = db.prepare(
    `SELECT tr.*, u.name, u.lk 
     FROM tournament_registrations tr 
     JOIN users u ON tr.user_id = u.id 
     WHERE tr.tournament_id = ? AND tr.status = ? 
     ORDER BY u.lk ASC`
  ).all(tournamentId, 'approved');

  const numRounds = tournament.doubles_rounds || 3;
  const randomPartners = tournament.doubles_random_partners;

  if (registrations.length < 4) throw new Error('Mindestens 4 Spieler benötigt für Doppel');

  const playerIds = registrations.map(r => r.user_id);

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM rounds WHERE tournament_id = ?').run(tournamentId);

    for (let round = 1; round <= numRounds; round++) {
      const roundResult = db.prepare(
        'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, ?, ?, ?)'
      ).run(tournamentId, round, `Doppel-Runde ${round}`, 'pending');

      let pairs;
      if (randomPartners) {
        // Zufällige Partner pro Runde
        const shuffled = [...playerIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        pairs = [];
        for (let i = 0; i < shuffled.length - 1; i += 2) {
          pairs.push([shuffled[i], shuffled[i + 1]]);
        }
      } else {
        // Feste Partner (nach LK sortiert, bester mit schwächstem)
        pairs = [];
        const half = Math.floor(playerIds.length / 2);
        for (let i = 0; i < half; i++) {
          pairs.push([playerIds[i], playerIds[playerIds.length - 1 - i]]);
        }
      }

      // Doppel-Matches erstellen (Paar vs Paar)
      let matchNum = 1;
      for (let i = 0; i < pairs.length - 1; i += 2) {
        if (pairs[i + 1]) {
          db.prepare(
            `INSERT INTO matches (tournament_id, round_id, match_number, player1_id, partner1_id, player2_id, partner2_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(
            tournamentId, roundResult.lastInsertRowid, matchNum++,
            pairs[i][0], pairs[i][1],
            pairs[i + 1][0], pairs[i + 1][1]
          );
        }
      }
    }
  });

  transaction();
}

module.exports = { generateKOBracket, advanceWinner, generateLKDayTournament, generateDoublesTournament };
