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
// Paarungslogik: Sortiert nach LK (beste = niedrigste LK zuerst).
// Bester Spieler (Index 0) spielt gegen Index 1 und Index 2.
// Jeder andere Spieler spielt gegen den 1 Rang besseren und den 2 Ränge besseren.
// Der schlechteste Spieler spielt gegen Rang-1 und Rang-2 über ihm.
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

    // Runde 1
    const round1 = db.prepare(
      'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, ?, ?, ?)'
    ).run(tournamentId, 1, 'Runde 1', 'pending');

    // Runde 2
    const round2 = db.prepare(
      'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, ?, ?, ?)'
    ).run(tournamentId, 2, 'Runde 2', 'pending');

    const n = registrations.length;
    const matchPairsR1 = new Set();
    const matchPairsR2 = new Set();
    let matchNumR1 = 1;
    let matchNumR2 = 1;

    const pairKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

    const addMatch = (roundId, matchPairs, matchNum, p1Id, p2Id) => {
      const key = pairKey(p1Id, p2Id);
      if (matchPairs.has(key)) return matchNum;
      matchPairs.add(key);
      db.prepare(
        'INSERT INTO matches (tournament_id, round_id, match_number, player1_id, player2_id) VALUES (?, ?, ?, ?, ?)'
      ).run(tournamentId, roundId, matchNum, p1Id, p2Id);
      return matchNum + 1;
    };

    for (let i = 0; i < n; i++) {
      const player = registrations[i];

      if (i === 0) {
        // Bester Spieler spielt gegen #2 (Runde 1) und #3 (Runde 2)
        if (n > 1) matchNumR1 = addMatch(round1.lastInsertRowid, matchPairsR1, matchNumR1, player.user_id, registrations[1].user_id);
        if (n > 2) matchNumR2 = addMatch(round2.lastInsertRowid, matchPairsR2, matchNumR2, player.user_id, registrations[2].user_id);
      } else {
        // Gegen 1 Rang besseren (Runde 1)
        const opp1 = registrations[i - 1];
        matchNumR1 = addMatch(round1.lastInsertRowid, matchPairsR1, matchNumR1, player.user_id, opp1.user_id);

        // Gegen 2 Ränge besseren (Runde 2), falls vorhanden
        if (i >= 2) {
          const opp2 = registrations[i - 2];
          matchNumR2 = addMatch(round2.lastInsertRowid, matchPairsR2, matchNumR2, player.user_id, opp2.user_id);
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

  // Parse court numbers from doubles_courts (e.g. "1,2,3" or "1-4")
  let courts = [];
  if (tournament.doubles_courts) {
    const parts = tournament.doubles_courts.split(',').map(s => s.trim());
    for (const p of parts) {
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(Number);
        for (let i = start; i <= end; i++) courts.push(String(i));
      } else {
        courts.push(p);
      }
    }
  }

  const roundDuration = tournament.doubles_round_duration || null;
  const startTime = tournament.doubles_start_time || null;

  // Helper to calculate round time offset
  const calcRoundTime = (roundIndex) => {
    if (!startTime || !roundDuration) return null;
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + roundIndex * roundDuration;
    const rh = Math.floor(totalMinutes / 60);
    const rm = totalMinutes % 60;
    return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
  };

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM rounds WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM doubles_standings WHERE tournament_id = ?').run(tournamentId);

    // Create standings for each player
    const insertStanding = db.prepare(
      'INSERT INTO doubles_standings (tournament_id, user_id, partner_id) VALUES (?, ?, ?)'
    );
    if (!randomPartners) {
      // Fixed partners: store partner_id from registration
      for (const reg of registrations) {
        insertStanding.run(tournamentId, reg.user_id, reg.partner_id || null);
      }
    } else {
      // Random partners: no fixed partner
      for (const reg of registrations) {
        insertStanding.run(tournamentId, reg.user_id, null);
      }
    }

    for (let round = 1; round <= numRounds; round++) {
      const roundTime = calcRoundTime(round - 1);
      const roundResult = db.prepare(
        'INSERT INTO rounds (tournament_id, round_number, name, status, scheduled_time, scheduled_duration, location) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(tournamentId, round, `Doppel-Runde ${round}`, 'pending', roundTime, roundDuration, tournament.location || null);

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
        // Feste Partner aus Registrierung (partner_id)
        const paired = new Set();
        pairs = [];
        for (const reg of registrations) {
          if (paired.has(reg.user_id)) continue;
          if (reg.partner_id) {
            pairs.push([reg.user_id, reg.partner_id]);
            paired.add(reg.user_id);
            paired.add(reg.partner_id);
          }
        }
      }

      // Doppel-Matches erstellen (Paar vs Paar)
      let matchNum = 1;
      for (let i = 0; i < pairs.length - 1; i += 2) {
        if (pairs[i + 1]) {
          const courtName = courts.length > 0 ? `Platz ${courts[(matchNum - 1) % courts.length]}` : null;
          db.prepare(
            `INSERT INTO matches (tournament_id, round_id, match_number, player1_id, partner1_id, player2_id, partner2_id, court, scheduled_time) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            tournamentId, roundResult.lastInsertRowid, matchNum++,
            pairs[i][0], pairs[i][1],
            pairs[i + 1][0], pairs[i + 1][1],
            courtName, roundTime
          );
        }
      }
    }
  });

  transaction();
}

// Doppel-Tabelle aktualisieren nach Ergebnis
function updateDoublesStandings(matchId) {
  const match = db.prepare(`
    SELECT m.*, t.doubles_random_partners 
    FROM matches m JOIN tournaments t ON m.tournament_id = t.id 
    WHERE m.id = ?
  `).get(matchId);
  if (!match || !match.winner_id) return;

  const sets = db.prepare('SELECT * FROM match_sets WHERE match_id = ? ORDER BY set_number').all(matchId);
  let gamesP1 = 0, gamesP2 = 0;
  for (const s of sets) {
    gamesP1 += s.games_player1 || 0;
    gamesP2 += s.games_player2 || 0;
  }

  // Determine winning team and losing team
  const team1Won = match.winner_id === match.player1_id;
  const winPlayers = team1Won ? [match.player1_id, match.partner1_id] : [match.player2_id, match.partner2_id];
  const losePlayers = team1Won ? [match.player2_id, match.partner2_id] : [match.player1_id, match.partner1_id];
  const winGames = team1Won ? gamesP1 : gamesP2;
  const loseGames = team1Won ? gamesP2 : gamesP1;

  const updatePlayer = db.prepare(`
    UPDATE doubles_standings 
    SET matches_played = matches_played + 1,
        wins = wins + ?,
        losses = losses + ?,
        match_points = match_points + ?,
        games_won = games_won + ?,
        games_lost = games_lost + ?
    WHERE tournament_id = ? AND user_id = ?
  `);

  for (const pid of winPlayers) {
    if (pid) updatePlayer.run(1, 0, 1, winGames, loseGames, match.tournament_id, pid);
  }
  for (const pid of losePlayers) {
    if (pid) updatePlayer.run(0, 1, 0, loseGames, winGames, match.tournament_id, pid);
  }
}

// One Point Slam generieren (KO ohne Setzliste, zufälliger Aufschläger)
function generateOnePointSlam(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) throw new Error('Turnier nicht gefunden');

  const registrations = db.prepare(
    `SELECT tr.*, u.name, u.lk 
     FROM tournament_registrations tr 
     JOIN users u ON tr.user_id = u.id 
     WHERE tr.tournament_id = ? AND tr.status = ?`
  ).all(tournamentId, 'approved');

  if (registrations.length < 2) throw new Error('Mindestens 2 Spieler benötigt');

  // Zufällig mischen (keine Setzliste)
  for (let i = registrations.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [registrations[i], registrations[j]] = [registrations[j], registrations[i]];
  }

  const n = registrations.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const totalRounds = Math.log2(bracketSize);

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM rounds WHERE tournament_id = ?').run(tournamentId);

    // Runden erstellen
    const roundNames = [];
    for (let r = 1; r <= totalRounds; r++) {
      const remaining = bracketSize / Math.pow(2, r - 1);
      let name;
      if (remaining === 2) name = 'Finale';
      else if (remaining === 4) name = 'Halbfinale';
      else if (remaining === 8) name = 'Viertelfinale';
      else name = `Runde ${r} (${remaining}er)`;
      
      const result = db.prepare(
        'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, ?, ?, ?)'
      ).run(tournamentId, r, name, 'pending');
      roundNames.push({ id: result.lastInsertRowid, roundNumber: r });
    }

    // Spieler auf Positionen verteilen (zufällig, bereits gemischt)
    const positions = new Array(bracketSize).fill(null);
    for (let i = 0; i < registrations.length; i++) {
      positions[i] = registrations[i];
    }

    // Erste Runde Matches erstellen mit zufälligem Aufschläger
    const firstRound = roundNames[0];
    const matchesInFirstRound = bracketSize / 2;
    const matchIds = [];

    for (let i = 0; i < matchesInFirstRound; i++) {
      const p1 = positions[i * 2] || null;
      const p2 = positions[i * 2 + 1] || null;
      
      // Zufälliger Aufschläger
      let serverId = null;
      if (p1 && p2) {
        serverId = Math.random() < 0.5 ? p1.user_id : p2.user_id;
      }

      const result = db.prepare(
        `INSERT INTO matches (tournament_id, round_id, match_number, player1_id, player2_id, bracket_position, server_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        tournamentId, firstRound.id, i + 1,
        p1 ? p1.user_id : null,
        p2 ? p2.user_id : null,
        i + 1, serverId
      );
      matchIds.push(result.lastInsertRowid);

      // Freilos
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
        
        db.prepare('UPDATE matches SET next_match_id = ? WHERE id = ?')
          .run(result.lastInsertRowid, previousMatchIds[i * 2]);
        db.prepare('UPDATE matches SET next_match_id = ? WHERE id = ?')
          .run(result.lastInsertRowid, previousMatchIds[i * 2 + 1]);

        newMatchIds.push(result.lastInsertRowid);

        // Freilos-Gewinner in nächste Runde
        const m1 = db.prepare('SELECT * FROM matches WHERE id = ?').get(previousMatchIds[i * 2]);
        const m2 = db.prepare('SELECT * FROM matches WHERE id = ?').get(previousMatchIds[i * 2 + 1]);

        if (m1 && m1.winner_id && m2 && m2.winner_id) {
          const serverId = Math.random() < 0.5 ? m1.winner_id : m2.winner_id;
          db.prepare('UPDATE matches SET player1_id = ?, player2_id = ?, server_id = ? WHERE id = ?')
            .run(m1.winner_id, m2.winner_id, serverId, result.lastInsertRowid);
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

// Tiebreak-KO-Turnier generieren (wie normales KO, mit Setzliste nach LK)
function generateTiebreakKO(tournamentId) {
  // Nutzt gleiche Logik wie generateKOBracket (Setzliste nach LK)
  return generateKOBracket(tournamentId);
}

// advanceWinner erweitern: Zufälligen Aufschläger für One Point Slam setzen
function advanceOnePointWinner(matchId) {
  const match = db.prepare('SELECT m.*, t.type FROM matches m JOIN tournaments t ON m.tournament_id = t.id WHERE m.id = ?').get(matchId);
  if (!match || !match.winner_id || !match.next_match_id) return;

  advanceWinner(matchId);

  // Aufschläger für nächstes Match setzen, wenn beide Spieler stehen
  if (match.tournament_id) {
    const nextMatch = db.prepare('SELECT * FROM matches WHERE id = ?').get(match.next_match_id);
    if (nextMatch && nextMatch.player1_id && nextMatch.player2_id) {
      const serverId = Math.random() < 0.5 ? nextMatch.player1_id : nextMatch.player2_id;
      db.prepare('UPDATE matches SET server_id = ? WHERE id = ?').run(serverId, match.next_match_id);
    }
  }
}

module.exports = { generateKOBracket, advanceWinner, generateLKDayTournament, generateDoublesTournament, updateDoublesStandings, generateOnePointSlam, generateTiebreakKO, advanceOnePointWinner };
