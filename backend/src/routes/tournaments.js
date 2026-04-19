const express = require('express');
const { authenticateUser, optionalAuth } = require('../middleware/auth');
const { db } = require('../config/database');
const { sendRegistrationNotificationToAdmin, sendChallengeEmail } = require('../services/emailService');

const router = express.Router();

// === ALLE TURNIERE (öffentlich) ===
router.get('/', optionalAuth, (req, res) => {
  try {
    const tournaments = db.prepare(`
      SELECT t.*, 
             (SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = t.id AND status = 'approved') as participant_count,
             (SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = t.id AND status = 'pending') as pending_count
      FROM tournaments t
      WHERE t.status != 'draft'
      ORDER BY t.tournament_start DESC
    `).all();

    // Wenn User eingeloggt, Anmeldestatus hinzufügen
    if (req.user) {
      for (const t of tournaments) {
        const reg = db.prepare('SELECT status FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?')
          .get(t.id, req.user.id);
        t.my_registration = reg ? reg.status : null;
      }
    }

    res.json({ tournaments });
  } catch (err) {
    console.error('Turniere laden Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === EINZELNES TURNIER ===
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const tournament = db.prepare(`
      SELECT t.*,
             (SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = t.id AND status = 'approved') as participant_count
      FROM tournaments t WHERE t.id = ?
    `).get(req.params.id);

    if (!tournament) {
      return res.status(404).json({ error: 'Turnier nicht gefunden.' });
    }

    // Teilnehmer laden
    const participants = db.prepare(`
      SELECT u.id, u.name, u.username, u.lk, u.profile_photo, tr.status, tr.seed_number
      FROM tournament_registrations tr
      JOIN users u ON tr.user_id = u.id
      WHERE tr.tournament_id = ? AND tr.status = 'approved'
      ORDER BY tr.seed_number ASC, u.lk ASC
    `).all(tournament.id);

    // Runden laden
    const rounds = db.prepare('SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number').all(tournament.id);

    // Matches laden
    const matches = db.prepare(`
      SELECT m.*,
             u1.name as player1_name, u1.username as player1_username, u1.lk as player1_lk, u1.profile_photo as player1_photo,
             u2.name as player2_name, u2.username as player2_username, u2.lk as player2_lk, u2.profile_photo as player2_photo,
             p1.name as partner1_name, p2.name as partner2_name,
             w.name as winner_name,
             r.name as round_name, r.round_number,
             tr1.seed_number as player1_seed,
             tr2.seed_number as player2_seed
      FROM matches m
      LEFT JOIN users u1 ON m.player1_id = u1.id
      LEFT JOIN users u2 ON m.player2_id = u2.id
      LEFT JOIN users p1 ON m.partner1_id = p1.id
      LEFT JOIN users p2 ON m.partner2_id = p2.id
      LEFT JOIN users w ON m.winner_id = w.id
      LEFT JOIN rounds r ON m.round_id = r.id
      LEFT JOIN tournament_registrations tr1 ON tr1.tournament_id = m.tournament_id AND tr1.user_id = m.player1_id
      LEFT JOIN tournament_registrations tr2 ON tr2.tournament_id = m.tournament_id AND tr2.user_id = m.player2_id
      WHERE m.tournament_id = ?
      ORDER BY r.round_number, m.match_number
    `).all(tournament.id);

    // Match-Sets laden und den Matches zuordnen
    const allSets = db.prepare(
      'SELECT * FROM match_sets WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = ?) ORDER BY match_id, set_number'
    ).all(tournament.id);
    const setsByMatchId = {};
    for (const s of allSets) {
      if (!setsByMatchId[s.match_id]) setsByMatchId[s.match_id] = [];
      setsByMatchId[s.match_id].push(s);
    }
    for (const m of matches) {
      m.sets = setsByMatchId[m.id] || [];
    }

    // Liga-Tabelle wenn Liga-Modus
    let standings = [];
    if (tournament.type === 'league') {
      standings = db.prepare(`
        SELECT ls.*, u.name, u.username, u.lk, u.profile_photo
        FROM league_standings ls
        JOIN users u ON ls.user_id = u.id
        WHERE ls.tournament_id = ?
        ORDER BY (ls.points + ls.bonus_points) DESC, (ls.sets_won - ls.sets_lost) DESC, (ls.games_won - ls.games_lost) DESC
      `).all(tournament.id);
    }

    // Doppel-Tabelle wenn Doppel-Modus
    let doublesStandings = [];
    if (tournament.type === 'doubles') {
      doublesStandings = db.prepare(`
        SELECT ds.*, u.name, u.username, u.lk, u.profile_photo,
               p.name as partner_name
        FROM doubles_standings ds
        JOIN users u ON ds.user_id = u.id
        LEFT JOIN users p ON ds.partner_id = p.id
        WHERE ds.tournament_id = ?
        ORDER BY ds.match_points DESC, (ds.games_won - ds.games_lost) DESC
      `).all(tournament.id);
    }

    // Eigene Anmeldung
    let myRegistration = null;
    if (req.user) {
      myRegistration = db.prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?')
        .get(tournament.id, req.user.id);
    }

    res.json({ tournament, participants, rounds, matches, standings, doublesStandings, myRegistration });
  } catch (err) {
    console.error('Turnier laden Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === FÜR TURNIER ANMELDEN ===
router.post('/:id/register', authenticateUser, async (req, res) => {
  try {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Turnier nicht gefunden.' });
    }

    if (tournament.status !== 'registration_open') {
      return res.status(400).json({ error: 'Anmeldung ist nicht geöffnet.' });
    }

    // Frist prüfen
    if (tournament.registration_deadline && new Date(tournament.registration_deadline) < new Date()) {
      return res.status(400).json({ error: 'Anmeldefrist abgelaufen.' });
    }

    // Maximale Teilnehmer prüfen
    const count = db.prepare('SELECT COUNT(*) as cnt FROM tournament_registrations WHERE tournament_id = ? AND status IN (?, ?)').get(tournament.id, 'approved', 'pending');
    if (count.cnt >= tournament.max_participants) {
      return res.status(400).json({ error: 'Turnier ist voll.' });
    }

    // DTB-ID prüfen wenn Turnier es erfordert
    if (tournament.dtb_id_required) {
      const user = db.prepare('SELECT dtb_id FROM users WHERE id = ?').get(req.user.id);
      if (!user || !user.dtb_id) {
        return res.status(400).json({ error: 'Für dieses Turnier ist eine DTB-ID erforderlich. Bitte trage deine DTB-ID in deinem Profil nach.' });
      }
    }

    // Bereits angemeldet?
    const existing = db.prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?')
      .get(tournament.id, req.user.id);
    if (existing) {
      if (existing.status === 'withdrawn') {
        db.prepare('UPDATE tournament_registrations SET status = ? WHERE id = ?').run('pending', existing.id);
        return res.json({ message: 'Erneut angemeldet. Wartet auf Bestätigung.' });
      }
      return res.status(400).json({ error: 'Bereits angemeldet.' });
    }

    db.prepare('INSERT INTO tournament_registrations (tournament_id, user_id, partner_name) VALUES (?, ?, ?)')
      .run(tournament.id, req.user.id, req.body.partner_name || null);

    // Admin per E-Mail benachrichtigen
    try {
      await sendRegistrationNotificationToAdmin(
        req.user.name || req.user.username,
        req.user.email,
        tournament.name,
        tournament.id
      );
    } catch (emailErr) {
      console.error('Admin-Benachrichtigung Fehler:', emailErr.message);
    }

    res.status(201).json({ message: 'Anmeldung erfolgreich. Wartet auf Bestätigung durch den Admin.' });
  } catch (err) {
    console.error('Turnier-Anmeldung Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === TURNIER-ANMELDUNG ZURÜCKZIEHEN ===
router.delete('/:id/register', authenticateUser, (req, res) => {
  try {
    const reg = db.prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    
    if (!reg) {
      return res.status(404).json({ error: 'Keine Anmeldung gefunden.' });
    }

    const tournament = db.prepare('SELECT status FROM tournaments WHERE id = ?').get(req.params.id);
    if (tournament && (tournament.status === 'in_progress' || tournament.status === 'draw_complete')) {
      return res.status(400).json({ error: 'Turnier bereits gestartet, Abmeldung nicht mehr möglich.' });
    }

    db.prepare('UPDATE tournament_registrations SET status = ? WHERE id = ?').run('withdrawn', reg.id);
    res.json({ message: 'Anmeldung zurückgezogen.' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === HERAUSFORDERUNG SENDEN ===
router.post('/:id/challenge', authenticateUser, async (req, res) => {
  try {
    const { opponentId, location, proposedDate, proposedTime, message } = req.body;

    if (!opponentId || !location || !proposedDate || !proposedTime) {
      return res.status(400).json({ error: 'Ort, Datum und Uhrzeit sind erforderlich.' });
    }

    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Turnier nicht gefunden.' });
    }

    if (tournament.type !== 'league') {
      return res.status(400).json({ error: 'Herausforderungen sind nur im Liga-Modus möglich.' });
    }

    if (parseInt(opponentId) === req.user.id) {
      return res.status(400).json({ error: 'Du kannst dich nicht selbst herausfordern.' });
    }

    // Prüfe ob beide Spieler im Turnier sind
    const myReg = db.prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ? AND user_id = ? AND status = ?')
      .get(tournament.id, req.user.id, 'approved');
    const oppReg = db.prepare('SELECT * FROM tournament_registrations WHERE tournament_id = ? AND user_id = ? AND status = ?')
      .get(tournament.id, parseInt(opponentId), 'approved');

    if (!myReg || !oppReg) {
      return res.status(400).json({ error: 'Beide Spieler müssen für das Turnier zugelassen sein.' });
    }

    const opponent = db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(parseInt(opponentId));
    if (!opponent) {
      return res.status(404).json({ error: 'Gegner nicht gefunden.' });
    }

    // Sanitize message to prevent XSS in email
    const safeMessage = message ? message.replace(/[<>]/g, '') : '';

    await sendChallengeEmail(opponent.email, opponent.name, {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      challengerName: req.user.name,
      challengerEmail: req.user.email,
      challengerPhone: req.user.phone,
      location: location.replace(/[<>]/g, ''),
      proposedDate: new Date(proposedDate).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
      proposedTime: proposedTime,
      message: safeMessage
    });

    res.json({ message: `Herausforderung an ${opponent.name} gesendet!` });
  } catch (err) {
    console.error('Herausforderung Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Senden der Herausforderung.' });
  }
});

module.exports = router;
