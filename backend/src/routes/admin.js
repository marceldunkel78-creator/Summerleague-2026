const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const { sendRegistrationApprovedEmail } = require('../services/emailService');
const { generateRoundRobin, updateLeagueStandings, getLeagueStandings } = require('../services/leagueService');
const { generateKOBracket, advanceWinner, generateLKDayTournament, generateDoublesTournament, updateDoublesStandings } = require('../services/bracketService');

const router = express.Router();

// === ADMIN LOGIN ===
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich.' });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (!admin) {
      return res.status(401).json({ error: 'Ungültige Zugangsdaten.' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Ungültige Zugangsdaten.' });
    }

    const token = jwt.sign(
      { id: admin.id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, admin: { id: admin.id, username: admin.username, email: admin.email } });
  } catch (err) {
    console.error('Admin Login Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === DASHBOARD STATS ===
router.get('/dashboard', authenticateAdmin, (req, res) => {
  try {
    const stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt,
      activeUsers: db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_active = 1 AND email_verified = 1').get().cnt,
      totalTournaments: db.prepare('SELECT COUNT(*) as cnt FROM tournaments').get().cnt,
      activeTournaments: db.prepare("SELECT COUNT(*) as cnt FROM tournaments WHERE status IN ('registration_open', 'in_progress')").get().cnt,
      pendingRegistrations: db.prepare("SELECT COUNT(*) as cnt FROM tournament_registrations WHERE status = 'pending'").get().cnt,
      disputedMatches: db.prepare("SELECT COUNT(*) as cnt FROM matches WHERE result_status = 'disputed'").get().cnt
    };

    const recentUsers = db.prepare('SELECT id, username, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5').all();
    const recentTournaments = db.prepare('SELECT id, name, type, status, created_at FROM tournaments ORDER BY created_at DESC LIMIT 5').all();

    res.json({ stats, recentUsers, recentTournaments });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// =========================================
// === BENUTZER-VERWALTUNG (CRUD) ===
// =========================================

router.get('/users', authenticateAdmin, (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, username, email, name, dtb_id, lk, profile_photo, email_verified, is_active, data_consent, created_at FROM users';
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    const params = [];

    if (search) {
      const where = ' WHERE name LIKE ? OR username LIKE ? OR email LIKE ? OR dtb_id LIKE ?';
      query += where;
      countQuery += where;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    const total = db.prepare(countQuery).get(...params).total;
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const users = db.prepare(query).all(...params, parseInt(limit), offset);

    res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

router.get('/users/:id', authenticateAdmin, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, name, dtb_id, lk, profile_photo, email_verified, is_active, data_consent, data_consent_date, created_at FROM users WHERE id = ?')
      .get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

router.put('/users/:id', authenticateAdmin, (req, res) => {
  try {
    const { name, email, lk, is_active, dtb_id } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

    db.prepare(`
      UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), lk = COALESCE(?, lk), 
             is_active = COALESCE(?, is_active), dtb_id = COALESCE(?, dtb_id), updated_at = datetime('now')
      WHERE id = ?
    `).run(name, email, lk, is_active, dtb_id, user.id);

    res.json({ message: 'Benutzer aktualisiert.' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

router.delete('/users/:id', authenticateAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    res.json({ message: 'Benutzer gelöscht.' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// =========================================
// === TURNIER-VERWALTUNG ===
// =========================================

router.get('/tournaments', authenticateAdmin, (req, res) => {
  try {
    const tournaments = db.prepare(`
      SELECT t.*,
             (SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = t.id AND status = 'approved') as participant_count,
             (SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = t.id AND status = 'pending') as pending_count
      FROM tournaments t
      ORDER BY t.created_at DESC
    `).all();
    res.json({ tournaments });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

router.post('/tournaments', authenticateAdmin, (req, res) => {
  try {
    const {
      name, description, type, status, max_participants,
      points_win, points_loss, points_draw, lk_handicap_enabled, lk_handicap_factor,
      winning_sets, no_ad, match_tiebreak, match_tiebreak_at,
      doubles_rounds, doubles_random_partners, is_doubles,
      doubles_round_duration, doubles_start_time, doubles_courts,
      entry_fee, prize_description,
      self_reporting, dtb_id_required, registration_deadline, draw_date,
      tournament_start, tournament_end, location
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name und Typ sind erforderlich.' });
    }

    const validStatuses = ['draft', 'registration_open'];
    const initialStatus = validStatuses.includes(status) ? status : 'draft';

    const result = db.prepare(`
      INSERT INTO tournaments (name, description, type, max_participants, points_win, points_loss, points_draw,
        lk_handicap_enabled, lk_handicap_factor, winning_sets, no_ad, match_tiebreak, match_tiebreak_at,
        doubles_rounds, doubles_random_partners, is_doubles, doubles_round_duration, doubles_start_time, doubles_courts,
        entry_fee, prize_description,
        self_reporting, dtb_id_required, registration_deadline, draw_date,
        tournament_start, tournament_end, location, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, description || null, type, max_participants || 16,
      points_win || 3, points_loss || 0, points_draw || 1,
      lk_handicap_enabled ? 1 : 0, lk_handicap_factor || 0.5,
      winning_sets || 2, no_ad ? 1 : 0, match_tiebreak ? 1 : 0, match_tiebreak_at || '1:1',
      doubles_rounds || 3, doubles_random_partners ? 1 : 0, is_doubles ? 1 : 0,
      doubles_round_duration || null, doubles_start_time || null, doubles_courts || null,
      entry_fee || null, prize_description || null,
      self_reporting ? 1 : 0, dtb_id_required ? 1 : 0, registration_deadline || null, draw_date || null,
      tournament_start || null, tournament_end || null, location || null,
      req.admin.id, initialStatus
    );

    res.status(201).json({ message: 'Turnier erstellt.', id: result.lastInsertRowid });
  } catch (err) {
    console.error('Turnier erstellen Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

router.put('/tournaments/:id', authenticateAdmin, (req, res) => {
  try {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Turnier nicht gefunden.' });

    const fields = [
      'name', 'description', 'type', 'status', 'max_participants',
      'points_win', 'points_loss', 'points_draw', 'lk_handicap_enabled', 'lk_handicap_factor',
      'winning_sets', 'no_ad', 'match_tiebreak', 'match_tiebreak_at',
      'doubles_rounds', 'doubles_random_partners', 'is_doubles',
      'doubles_round_duration', 'doubles_start_time', 'doubles_courts',
      'entry_fee', 'prize_description',
      'self_reporting', 'dtb_id_required',
      'registration_deadline', 'draw_date', 'tournament_start', 'tournament_end', 'location'
    ];

    const updates = [];
    const params = [];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen.' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE tournaments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ message: 'Turnier aktualisiert.' });
  } catch (err) {
    console.error('Turnier Update Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

router.delete('/tournaments/:id', authenticateAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Turnier nicht gefunden.' });
    res.json({ message: 'Turnier gelöscht.' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// =========================================
// === ANMELDUNGEN VERWALTEN ===
// =========================================

router.get('/tournaments/:id/registrations', authenticateAdmin, (req, res) => {
  try {
    const registrations = db.prepare(`
      SELECT tr.*, u.name, u.username, u.email, u.dtb_id, u.lk, u.profile_photo,
             p.name as linked_partner_name
      FROM tournament_registrations tr
      JOIN users u ON tr.user_id = u.id
      LEFT JOIN users p ON tr.partner_id = p.id
      WHERE tr.tournament_id = ?
      ORDER BY tr.created_at ASC
    `).all(req.params.id);

    res.json({ registrations });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

router.put('/registrations/:regId', authenticateAdmin, async (req, res) => {
  try {
    const { status, seed_number } = req.body;
    const reg = db.prepare(`
      SELECT tr.*, u.name, u.email, t.name as tournament_name
      FROM tournament_registrations tr
      JOIN users u ON tr.user_id = u.id
      JOIN tournaments t ON tr.tournament_id = t.id
      WHERE tr.id = ?
    `).get(req.params.regId);

    if (!reg) return res.status(404).json({ error: 'Anmeldung nicht gefunden.' });

    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (seed_number !== undefined) { updates.push('seed_number = ?'); params.push(seed_number); }
    if (req.body.partner_id !== undefined) { updates.push('partner_id = ?'); params.push(req.body.partner_id); }
    updates.push("updated_at = datetime('now')");
    params.push(reg.id);

    db.prepare(`UPDATE tournament_registrations SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // E-Mail bei Genehmigung
    if (status === 'approved' && reg.status !== 'approved') {
      try {
        await sendRegistrationApprovedEmail(reg.email, reg.name, reg.tournament_name);
      } catch (e) {
        console.error('Approval E-Mail Fehler:', e.message);
      }
    }

    res.json({ message: 'Anmeldung aktualisiert.' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === AUTO-SETZLISTE FÜR LK-TAGESTURNIER ===
router.post('/tournaments/:id/auto-seed', authenticateAdmin, (req, res) => {
  try {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Turnier nicht gefunden.' });
    if (tournament.type !== 'lk_day') return res.status(400).json({ error: 'Auto-Setzliste nur für LK-Tagesturniere.' });

    const approved = db.prepare(`
      SELECT tr.id, u.lk FROM tournament_registrations tr
      JOIN users u ON tr.user_id = u.id
      WHERE tr.tournament_id = ? AND tr.status = 'approved'
      ORDER BY u.lk ASC
    `).all(tournament.id);

    // Bei gleicher LK: Zufallsreihenfolge
    const shuffled = [...approved];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // Stabil nach LK sortieren (niedrigste = beste = Setzplatz 1)
    shuffled.sort((a, b) => (a.lk || 99) - (b.lk || 99));

    const update = db.prepare('UPDATE tournament_registrations SET seed_number = ? WHERE id = ?');
    shuffled.forEach((r, i) => update.run(i + 1, r.id));

    res.json({ message: `Setzliste für ${shuffled.length} Spieler erstellt.` });
  } catch (err) {
    console.error('Auto-Seed Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// =========================================
// === AUSLOSUNG / DRAW ===
// =========================================

router.post('/tournaments/:id/draw', authenticateAdmin, (req, res) => {
  try {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Turnier nicht gefunden.' });

    let result;
    switch (tournament.type) {
      case 'league':
        result = generateRoundRobin(tournament.id);
        break;
      case 'ko':
        result = generateKOBracket(tournament.id);
        break;
      case 'lk_day':
        generateLKDayTournament(tournament.id);
        result = { success: true };
        break;
      case 'doubles':
        // Bei fester Partnerzuordnung: Prüfe ob alle zugelassenen Spieler einen verknüpften Partner haben
        if (!tournament.doubles_random_partners) {
          const unlinked = db.prepare(
            `SELECT tr.id, u.name FROM tournament_registrations tr
             JOIN users u ON tr.user_id = u.id
             WHERE tr.tournament_id = ? AND tr.status = 'approved' AND tr.partner_id IS NULL`
          ).all(tournament.id);
          if (unlinked.length > 0) {
            const names = unlinked.map(u => u.name).join(', ');
            return res.status(400).json({ error: `Folgende Spieler haben noch keinen verknüpften Partner: ${names}` });
          }
        }
        generateDoublesTournament(tournament.id);
        result = { success: true };
        break;
      default:
        return res.status(400).json({ error: 'Unbekannter Turniertyp.' });
    }

    db.prepare("UPDATE tournaments SET status = 'draw_complete', updated_at = datetime('now') WHERE id = ?").run(tournament.id);

    res.json({ message: 'Auslosung erstellt!', result });
  } catch (err) {
    console.error('Auslosung Fehler:', err);
    res.status(500).json({ error: err.message || 'Fehler bei der Auslosung.' });
  }
});

// =========================================
// === MATCH-VERWALTUNG (ADMIN) ===
// =========================================

// Admin-Endpunkt: Match-Spielplan (Datum, Uhrzeit, Ort) setzen
router.put('/matches/:matchId/schedule', authenticateAdmin, (req, res) => {
  try {
    const { scheduled_date, scheduled_time, court } = req.body;
    const match = db.prepare('SELECT id FROM matches WHERE id = ?').get(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match nicht gefunden.' });

    db.prepare(`
      UPDATE matches 
      SET scheduled_date = ?, scheduled_time = ?, court = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(scheduled_date || null, scheduled_time || null, court || null, match.id);

    res.json({ message: 'Spielplan aktualisiert.' });
  } catch (err) {
    console.error('Schedule Update Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// Admin-Endpunkt: Runden-Spielplan (Datum, Uhrzeit, Dauer, Ort) setzen
router.put('/rounds/:roundId/schedule', authenticateAdmin, (req, res) => {
  try {
    const { scheduled_date, scheduled_time, scheduled_duration, location } = req.body;
    const round = db.prepare('SELECT id FROM rounds WHERE id = ?').get(req.params.roundId);
    if (!round) return res.status(404).json({ error: 'Runde nicht gefunden.' });

    db.prepare(`
      UPDATE rounds 
      SET scheduled_date = ?, scheduled_time = ?, scheduled_duration = ?, location = ?
      WHERE id = ?
    `).run(scheduled_date || null, scheduled_time || null, scheduled_duration || null, location || null, round.id);

    res.json({ message: 'Rundenplan aktualisiert.' });
  } catch (err) {
    console.error('Round Schedule Update Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

router.get('/tournaments/:id/matches', authenticateAdmin, (req, res) => {
  try {
    const matches = db.prepare(`
      SELECT m.*,
             u1.name as player1_name, u1.lk as player1_lk,
             u2.name as player2_name, u2.lk as player2_lk,
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
    `).all(req.params.id);

    // Match-Sets laden und den Matches zuordnen
    const allSets = db.prepare(
      'SELECT * FROM match_sets WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = ?) ORDER BY match_id, set_number'
    ).all(req.params.id);
    const setsByMatchId = {};
    for (const s of allSets) {
      if (!setsByMatchId[s.match_id]) setsByMatchId[s.match_id] = [];
      setsByMatchId[s.match_id].push(s);
    }
    for (const m of matches) {
      m.sets = setsByMatchId[m.id] || [];
    }

    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// Admin setzt Ergebnis direkt
router.put('/matches/:matchId', authenticateAdmin, (req, res) => {
  try {
    const { winnerId, sets, score, walkover } = req.body;
    const match = db.prepare(`
      SELECT m.*, t.type as tournament_type
      FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = ?
    `).get(req.params.matchId);

    if (!match) return res.status(404).json({ error: 'Match nicht gefunden.' });

    let setsP1 = 0, setsP2 = 0;
    let scoreStr = score || '';

    const transaction = db.transaction(() => {
      if (sets && Array.isArray(sets)) {
        db.prepare('DELETE FROM match_sets WHERE match_id = ?').run(match.id);
        const insertSet = db.prepare(
          'INSERT INTO match_sets (match_id, set_number, games_player1, games_player2, tiebreak_points_player1, tiebreak_points_player2) VALUES (?, ?, ?, ?, ?, ?)'
        );
        sets.forEach((s, idx) => {
          insertSet.run(match.id, idx + 1, s.games_player1, s.games_player2, s.tiebreak_points_player1 || null, s.tiebreak_points_player2 || null);
          if (s.games_player1 > s.games_player2) setsP1++;
          else if (s.games_player2 > s.games_player1) setsP2++;
        });

        if (!score) {
          scoreStr = sets.map(s => {
            let setStr = `${s.games_player1}:${s.games_player2}`;
            if (s.tiebreak_points_player1 !== undefined && s.tiebreak_points_player2 !== undefined) {
              const tbLoser = Math.min(s.tiebreak_points_player1, s.tiebreak_points_player2);
              setStr += `(${tbLoser})`;
            }
            return setStr;
          }).join(' ');
        }
      }

      db.prepare(`
        UPDATE matches 
        SET winner_id = ?, score = ?, sets_player1 = ?, sets_player2 = ?,
            walkover = ?, result_status = 'admin_set', confirmation_token = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(winnerId || null, scoreStr, setsP1, setsP2, walkover ? 1 : 0, match.id);
    });

    transaction();

    // Liga/KO-Updates AUSSERHALB der Transaktion (diese haben eigene Transaktionen)
    if (match.tournament_type === 'league' && winnerId) {
      updateLeagueStandings(match.id);
    }
    if (match.tournament_type === 'ko' && winnerId) {
      advanceWinner(match.id);
    }
    if (match.tournament_type === 'doubles' && winnerId) {
      updateDoublesStandings(match.id);
    }
    res.json({ message: 'Match aktualisiert.' });
  } catch (err) {
    console.error('Match Update Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === LIGA-TABELLE ===
router.get('/tournaments/:id/standings', authenticateAdmin, (req, res) => {
  try {
    const standings = getLeagueStandings(req.params.id);
    res.json({ standings });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === STREITFALL KLÄREN ===
router.put('/matches/:matchId/resolve-dispute', authenticateAdmin, (req, res) => {
  try {
    const { winnerId, sets, score } = req.body;
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match nicht gefunden.' });

    // Delegiere an normale Match-Update Logik
    req.body.walkover = false;
    req.params.matchId = match.id;
    
    // Direkt die gleiche Logik wie PUT /matches/:matchId verwenden
    // (Vereinfacht: setze result_status auf admin_set)
    db.prepare("UPDATE matches SET result_status = 'admin_set', dispute_reason = NULL WHERE id = ?").run(match.id);
    
    res.json({ message: 'Streitfall gelöst.' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === E-MAIL LOG ===
router.get('/email-log', authenticateAdmin, (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM email_log ORDER BY sent_at DESC LIMIT 50').all();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

module.exports = router;
