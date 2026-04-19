const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateUser } = require('../middleware/auth');
const { db } = require('../config/database');
const { sendResultConfirmationEmail, sendDisputeNotificationToAdmin } = require('../services/emailService');
const { updateLeagueStandings } = require('../services/leagueService');
const { advanceWinner, updateDoublesStandings, advanceOnePointWinner } = require('../services/bracketService');

const router = express.Router();

// === ERGEBNIS EINTRAGEN ===
router.post('/:matchId/report', authenticateUser, async (req, res) => {
  try {
    const match = db.prepare(`
      SELECT m.*, t.self_reporting, t.name as tournament_name, t.type as tournament_type, t.winning_sets,
             u1.name as player1_name, u1.email as player1_email,
             u2.name as player2_name, u2.email as player2_email
      FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      LEFT JOIN users u1 ON m.player1_id = u1.id
      LEFT JOIN users u2 ON m.player2_id = u2.id
      WHERE m.id = ?
    `).get(req.params.matchId);

    if (!match) {
      return res.status(404).json({ error: 'Spiel nicht gefunden.' });
    }

    if (!match.self_reporting) {
      return res.status(403).json({ error: 'Selbsteintragung ist für dieses Turnier nicht aktiviert.' });
    }

    // Prüfe ob User an diesem Match beteiligt ist
    const isPlayer1 = match.player1_id === req.user.id;
    const isPlayer2 = match.player2_id === req.user.id;
    if (!isPlayer1 && !isPlayer2) {
      return res.status(403).json({ error: 'Du bist an diesem Spiel nicht beteiligt.' });
    }

    if (match.result_status !== 'pending') {
      return res.status(400).json({ error: 'Ergebnis wurde bereits eingetragen.' });
    }

    const { sets, winnerId } = req.body;

    if (!sets || !Array.isArray(sets) || sets.length === 0) {
      return res.status(400).json({ error: 'Satz-Ergebnisse sind erforderlich.' });
    }

    if (!winnerId) {
      return res.status(400).json({ error: 'Gewinner muss angegeben werden.' });
    }

    // Score-String generieren
    const scoreStr = sets.map(s => {
      let setStr = `${s.games_player1}:${s.games_player2}`;
      if (s.tiebreak_points_player1 !== undefined && s.tiebreak_points_player2 !== undefined) {
        const tbLoser = Math.min(s.tiebreak_points_player1, s.tiebreak_points_player2);
        setStr += `(${tbLoser})`;
      }
      return setStr;
    }).join(' ');

    // Prüfe ob der Reporter seinen eigenen Sieg meldet → Bestätigung nötig
    // Oder seine eigene Niederlage meldet → Auto-Bestätigung
    const winnerIdInt = parseInt(winnerId);
    const reporterReportsOwnWin = (winnerIdInt === req.user.id);

    // Confirmation-Token nur wenn Bestätigung nötig
    const confirmToken = reporterReportsOwnWin ? uuidv4() : null;
    const resultStatus = reporterReportsOwnWin ? 'reported' : 'confirmed';

    const setsP1 = sets.filter(s => s.games_player1 > s.games_player2).length;
    const setsP2 = sets.filter(s => s.games_player2 > s.games_player1).length;

    const transaction = db.transaction(() => {
      // Match aktualisieren
      db.prepare(`
        UPDATE matches 
        SET score = ?, winner_id = ?, sets_player1 = ?, sets_player2 = ?,
            result_status = ?, reported_by = ?, confirmation_token = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(scoreStr, winnerIdInt, setsP1, setsP2, resultStatus, req.user.id, confirmToken, match.id);

      // Satz-Details speichern
      db.prepare('DELETE FROM match_sets WHERE match_id = ?').run(match.id);
      const insertSet = db.prepare(
        'INSERT INTO match_sets (match_id, set_number, games_player1, games_player2, tiebreak_points_player1, tiebreak_points_player2) VALUES (?, ?, ?, ?, ?, ?)'
      );
      sets.forEach((s, idx) => {
        insertSet.run(match.id, idx + 1, s.games_player1, s.games_player2, s.tiebreak_points_player1 || null, s.tiebreak_points_player2 || null);
      });

      // Bei Auto-Bestätigung (Niederlage gemeldet): resultStatus ist 'confirmed'
      // Liga/KO wird nach der Transaktion aktualisiert
    });

    transaction();

    // Bei Auto-Bestätigung (eigene Niederlage gemeldet): Liga/KO/Doppel sofort aktualisieren
    if (!reporterReportsOwnWin) {
      if (match.tournament_type === 'league') {
        updateLeagueStandings(match.id);
      }
      if (match.tournament_type === 'ko') {
        advanceWinner(match.id);
      }
      if (match.tournament_type === 'tiebreak_ko') {
        advanceWinner(match.id);
      }
      if (match.tournament_type === 'one_point') {
        advanceOnePointWinner(match.id);
      }
      if (match.tournament_type === 'doubles') {
        updateDoublesStandings(match.id);
      }
    }

    if (reporterReportsOwnWin) {
      // E-Mail an Gegner senden zur Bestätigung
      const opponentEmail = isPlayer1 ? match.player2_email : match.player1_email;
      const opponentName = isPlayer1 ? match.player2_name : match.player1_name;
      const winnerName = winnerIdInt === match.player1_id ? match.player1_name : match.player2_name;

      try {
        await sendResultConfirmationEmail(opponentEmail, opponentName, {
          tournamentName: match.tournament_name,
          round: match.round_id ? `Runde` : '-',
          score: scoreStr,
          winnerName,
          reporterName: req.user.name || req.user.username
        }, confirmToken);
      } catch (emailErr) {
        console.error('E-Mail Fehler:', emailErr.message);
      }

      res.json({ message: 'Ergebnis eingetragen. Dein Gegner muss das Ergebnis bestätigen.' });
    } else {
      res.json({ message: 'Niederlage eingetragen und automatisch bestätigt.' });
    }
  } catch (err) {
    console.error('Ergebnis-Report Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === ERGEBNIS BESTÄTIGEN (über Match-ID, für UI) ===
router.post('/:matchId/confirm-result', authenticateUser, (req, res) => {
  try {
    const match = db.prepare(`
      SELECT m.*, t.type as tournament_type
      FROM matches m 
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = ?
    `).get(req.params.matchId);
    
    if (!match) return res.status(404).json({ error: 'Match nicht gefunden.' });
    if (match.result_status !== 'reported') return res.status(400).json({ error: 'Ergebnis kann nicht bestätigt werden.' });

    // Prüfe ob richtiger Spieler (Gegner des Reporters)
    const isOpponent = (match.reported_by === match.player1_id && req.user.id === match.player2_id) ||
                       (match.reported_by === match.player2_id && req.user.id === match.player1_id);
    if (!isOpponent) {
      return res.status(403).json({ error: 'Nur der Gegner kann das Ergebnis bestätigen.' });
    }

    db.prepare("UPDATE matches SET result_status = 'confirmed', confirmation_token = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(match.id);

    if (match.tournament_type === 'league') {
      updateLeagueStandings(match.id);
    }
    if (match.tournament_type === 'ko') {
      advanceWinner(match.id);
    }
    if (match.tournament_type === 'tiebreak_ko') {
      advanceWinner(match.id);
    }
    if (match.tournament_type === 'one_point') {
      advanceOnePointWinner(match.id);
    }
    if (match.tournament_type === 'doubles') {
      updateDoublesStandings(match.id);
    }

    res.json({ message: 'Ergebnis bestätigt!' });
  } catch (err) {
    console.error('Bestätigung Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === ERGEBNIS REKLAMIEREN (über Match-ID, für UI) ===
router.post('/:matchId/dispute-result', authenticateUser, async (req, res) => {
  try {
    const { reason } = req.body;

    const match = db.prepare(`
      SELECT m.*, t.name as tournament_name,
             u1.name as player1_name, u2.name as player2_name,
             rep.name as reporter_name
      FROM matches m 
      JOIN tournaments t ON m.tournament_id = t.id
      LEFT JOIN users u1 ON m.player1_id = u1.id
      LEFT JOIN users u2 ON m.player2_id = u2.id
      LEFT JOIN users rep ON m.reported_by = rep.id
      WHERE m.id = ?
    `).get(req.params.matchId);
    
    if (!match) return res.status(404).json({ error: 'Match nicht gefunden.' });
    if (match.result_status !== 'reported') return res.status(400).json({ error: 'Reklamation nicht möglich.' });

    // Prüfe ob richtiger Spieler (Gegner des Reporters)
    const isOpponent = (match.reported_by === match.player1_id && req.user.id === match.player2_id) ||
                       (match.reported_by === match.player2_id && req.user.id === match.player1_id);
    if (!isOpponent) {
      return res.status(403).json({ error: 'Nur der Gegner kann das Ergebnis reklamieren.' });
    }

    db.prepare("UPDATE matches SET result_status = 'disputed', dispute_reason = ?, updated_at = datetime('now') WHERE id = ?")
      .run(reason || null, match.id);

    try {
      await sendDisputeNotificationToAdmin({
        tournamentName: match.tournament_name,
        player1Name: match.player1_name,
        player2Name: match.player2_name,
        round: 'Runde',
        score: match.score,
        reporterName: match.reporter_name,
        disputerName: req.user.name || req.user.username,
        matchId: match.id
      }, reason);
    } catch (emailErr) {
      console.error('Dispute E-Mail Fehler:', emailErr.message);
    }

    res.json({ message: 'Ergebnis reklamiert. Der Admin wurde benachrichtigt.' });
  } catch (err) {
    console.error('Dispute Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === ERGEBNIS BESTÄTIGEN ===
router.post('/confirm', authenticateUser, (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token fehlt.' });

    const match = db.prepare(`
      SELECT m.*, t.type as tournament_type
      FROM matches m 
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.confirmation_token = ?
    `).get(token);
    
    if (!match) return res.status(404).json({ error: 'Match nicht gefunden.' });
    if (match.result_status !== 'reported') return res.status(400).json({ error: 'Ergebnis kann nicht bestätigt werden.' });

    // Prüfe ob richtiger Spieler
    const isOpponent = (match.reported_by === match.player1_id && req.user.id === match.player2_id) ||
                       (match.reported_by === match.player2_id && req.user.id === match.player1_id);
    if (!isOpponent) {
      return res.status(403).json({ error: 'Nur der Gegner kann das Ergebnis bestätigen.' });
    }

    db.prepare("UPDATE matches SET result_status = 'confirmed', confirmation_token = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(match.id);

    // Liga-Tabelle aktualisieren
    if (match.tournament_type === 'league') {
      updateLeagueStandings(match.id);
    }

    // KO: Gewinner in nächste Runde
    if (match.tournament_type === 'ko') {
      advanceWinner(match.id);
    }
    if (match.tournament_type === 'tiebreak_ko') {
      advanceWinner(match.id);
    }
    if (match.tournament_type === 'one_point') {
      advanceOnePointWinner(match.id);
    }

    // Doppel-Tabelle aktualisieren
    if (match.tournament_type === 'doubles') {
      updateDoublesStandings(match.id);
    }

    res.json({ message: 'Ergebnis bestätigt!' });
  } catch (err) {
    console.error('Bestätigung Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === ERGEBNIS REKLAMIEREN ===
router.post('/dispute', authenticateUser, async (req, res) => {
  try {
    const { token, reason } = req.body;
    if (!token) return res.status(400).json({ error: 'Token fehlt.' });

    const match = db.prepare(`
      SELECT m.*, t.name as tournament_name,
             u1.name as player1_name, u2.name as player2_name,
             rep.name as reporter_name
      FROM matches m 
      JOIN tournaments t ON m.tournament_id = t.id
      LEFT JOIN users u1 ON m.player1_id = u1.id
      LEFT JOIN users u2 ON m.player2_id = u2.id
      LEFT JOIN users rep ON m.reported_by = rep.id
      WHERE m.confirmation_token = ?
    `).get(token);
    
    if (!match) return res.status(404).json({ error: 'Match nicht gefunden.' });
    if (match.result_status !== 'reported') return res.status(400).json({ error: 'Reklamation nicht möglich.' });

    db.prepare("UPDATE matches SET result_status = 'disputed', dispute_reason = ?, updated_at = datetime('now') WHERE id = ?")
      .run(reason || null, match.id);

    // Admin benachrichtigen
    try {
      await sendDisputeNotificationToAdmin({
        tournamentName: match.tournament_name,
        player1Name: match.player1_name,
        player2Name: match.player2_name,
        round: 'Runde',
        score: match.score,
        reporterName: match.reporter_name,
        disputerName: req.user.name || req.user.username,
        matchId: match.id
      }, reason);
    } catch (emailErr) {
      console.error('Dispute E-Mail Fehler:', emailErr.message);
    }

    res.json({ message: 'Ergebnis reklamiert. Der Admin wurde benachrichtigt.' });
  } catch (err) {
    console.error('Dispute Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === MATCH-DETAILS ===
router.get('/:matchId', (req, res) => {
  try {
    const match = db.prepare(`
      SELECT m.*,
             t.name as tournament_name, t.type as tournament_type,
             u1.name as player1_name, u1.username as player1_username, u1.lk as player1_lk,
             u2.name as player2_name, u2.username as player2_username, u2.lk as player2_lk,
             p1.name as partner1_name, p2.name as partner2_name,
             w.name as winner_name,
             r.name as round_name
      FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      LEFT JOIN users u1 ON m.player1_id = u1.id
      LEFT JOIN users u2 ON m.player2_id = u2.id
      LEFT JOIN users p1 ON m.partner1_id = p1.id
      LEFT JOIN users p2 ON m.partner2_id = p2.id
      LEFT JOIN users w ON m.winner_id = w.id
      LEFT JOIN rounds r ON m.round_id = r.id
      WHERE m.id = ?
    `).get(req.params.matchId);

    if (!match) return res.status(404).json({ error: 'Match nicht gefunden.' });

    const sets = db.prepare('SELECT * FROM match_sets WHERE match_id = ? ORDER BY set_number').all(match.id);

    res.json({ match, sets });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

module.exports = router;
