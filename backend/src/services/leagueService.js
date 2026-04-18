const { db } = require('../config/database');

/**
 * Liga-Service: Round-Robin Generierung und Tabellenverwaltung
 */

// Round-Robin-Spielplan generieren (Berger-Tabellen-Algorithmus)
function generateRoundRobin(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) throw new Error('Turnier nicht gefunden');

  const registrations = db.prepare(
    'SELECT tr.*, u.name, u.lk FROM tournament_registrations tr JOIN users u ON tr.user_id = u.id WHERE tr.tournament_id = ? AND tr.status = ? ORDER BY u.lk ASC'
  ).all(tournamentId, 'approved');

  if (registrations.length < 2) throw new Error('Mindestens 2 Spieler benötigt');

  const players = registrations.map(r => r.user_id);
  const n = players.length;

  // Bei ungerader Anzahl: Freilos hinzufügen
  const hasBye = n % 2 !== 0;
  if (hasBye) players.push(null); // null = Freilos

  const totalPlayers = players.length;
  const rounds = totalPlayers - 1;
  const matchesPerRound = totalPlayers / 2;

  const insertRound = db.prepare(
    'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, ?, ?, ?)'
  );
  const insertMatch = db.prepare(
    'INSERT INTO matches (tournament_id, round_id, match_number, player1_id, player2_id) VALUES (?, ?, ?, ?, ?)'
  );
  const insertStanding = db.prepare(
    'INSERT OR IGNORE INTO league_standings (tournament_id, user_id) VALUES (?, ?)'
  );

  const transaction = db.transaction(() => {
    // Bestehende Runden/Matches löschen
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM rounds WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM league_standings WHERE tournament_id = ?').run(tournamentId);

    // Liga-Tabellen-Einträge erstellen
    for (const reg of registrations) {
      insertStanding.run(tournamentId, reg.user_id);
    }

    // Circle-Methode für Round-Robin
    const fixed = players[0];
    const rotating = players.slice(1);

    for (let round = 0; round < rounds; round++) {
      const roundResult = insertRound.run(tournamentId, round + 1, `Runde ${round + 1}`, 'pending');
      const roundId = roundResult.lastInsertRowid;

      let matchNum = 1;
      // Erste Paarung: fixed vs erstes Element der Rotation
      const opponent = rotating[0];
      if (fixed !== null && opponent !== null) {
        insertMatch.run(tournamentId, roundId, matchNum++, fixed, opponent);
      }

      // Restliche Paarungen
      for (let i = 1; i < matchesPerRound; i++) {
        const p1 = rotating[i];
        const p2 = rotating[rotating.length - i];
        if (p1 !== null && p2 !== null) {
          insertMatch.run(tournamentId, roundId, matchNum++, p1, p2);
        }
      }

      // Rotation: letztes Element an den Anfang
      rotating.unshift(rotating.pop());
    }
  });

  transaction();
  return { rounds, matchesPerRound };
}

// Liga-Tabelle aktualisieren nach Ergebnis
function updateLeagueStandings(matchId) {
  const match = db.prepare(`
    SELECT m.*, t.points_win, t.points_loss, t.points_draw, 
           t.lk_handicap_enabled, t.lk_handicap_factor,
           u1.lk as lk1, u2.lk as lk2
    FROM matches m 
    JOIN tournaments t ON m.tournament_id = t.id
    LEFT JOIN users u1 ON m.player1_id = u1.id
    LEFT JOIN users u2 ON m.player2_id = u2.id
    WHERE m.id = ?
  `).get(matchId);

  if (!match || !match.winner_id) return;

  // Satz-Details laden
  const sets = db.prepare('SELECT * FROM match_sets WHERE match_id = ? ORDER BY set_number').all(matchId);

  let setsP1 = 0, setsP2 = 0, gamesP1 = 0, gamesP2 = 0;
  for (const set of sets) {
    gamesP1 += set.games_player1;
    gamesP2 += set.games_player2;
    if (set.games_player1 > set.games_player2) setsP1++;
    else if (set.games_player2 > set.games_player1) setsP2++;
  }

  const winnerId = match.winner_id;
  const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;

  // LK-Handicap:
  // - Malus bei Sieg gegen schwächeren Spieler (höhere LK): weniger Siegpunkte, min. Niederlagepunkte
  // - Bonus bei Sieg gegen besseren Spieler (niedrigere LK): Extra-Bonuspunkte
  let effectiveWinPoints = match.points_win;
  let bonusWinner = 0;
  if (match.lk_handicap_enabled) {
    const winnerLk = match.player1_id === winnerId ? match.lk1 : match.lk2;
    const loserLk = match.player1_id === loserId ? match.lk1 : match.lk2;
    const lkDiff = Math.abs(winnerLk - loserLk);

    if (winnerLk < loserLk) {
      // Gewinner hat bessere (niedrigere) LK als Verlierer → Malus
      const malus = lkDiff * match.lk_handicap_factor;
      effectiveWinPoints = Math.max(match.points_win - malus, match.points_loss);
    } else if (winnerLk > loserLk) {
      // Gewinner hat schlechtere (höhere) LK als Verlierer → Bonus
      bonusWinner = lkDiff * match.lk_handicap_factor;
    }
  }

  const updateStanding = db.prepare(`
    UPDATE league_standings 
    SET matches_played = matches_played + 1,
        wins = wins + ?,
        losses = losses + ?,
        points = points + ?,
        sets_won = sets_won + ?,
        sets_lost = sets_lost + ?,
        games_won = games_won + ?,
        games_lost = games_lost + ?,
        bonus_points = bonus_points + ?
    WHERE tournament_id = ? AND user_id = ?
  `);

  const transaction = db.transaction(() => {
    // Gewinner-Statistik
    const winnerIsP1 = winnerId === match.player1_id;
    updateStanding.run(
      1, 0, effectiveWinPoints,
      winnerIsP1 ? setsP1 : setsP2,
      winnerIsP1 ? setsP2 : setsP1,
      winnerIsP1 ? gamesP1 : gamesP2,
      winnerIsP1 ? gamesP2 : gamesP1,
      bonusWinner,
      match.tournament_id, winnerId
    );

    // Verlierer-Statistik
    updateStanding.run(
      0, 1, match.points_loss,
      winnerIsP1 ? setsP2 : setsP1,
      winnerIsP1 ? setsP1 : setsP2,
      winnerIsP1 ? gamesP2 : gamesP1,
      winnerIsP1 ? gamesP1 : gamesP2,
      0,
      match.tournament_id, loserId
    );
  });

  transaction();
}

// Liga-Tabelle abrufen
function getLeagueStandings(tournamentId) {
  return db.prepare(`
    SELECT ls.*, u.name, u.username, u.lk, u.profile_photo
    FROM league_standings ls
    JOIN users u ON ls.user_id = u.id
    WHERE ls.tournament_id = ?
    ORDER BY (ls.points + ls.bonus_points) DESC, 
             (ls.sets_won - ls.sets_lost) DESC, 
             (ls.games_won - ls.games_lost) DESC
  `).all(tournamentId);
}

module.exports = { generateRoundRobin, updateLeagueStandings, getLeagueStandings };
