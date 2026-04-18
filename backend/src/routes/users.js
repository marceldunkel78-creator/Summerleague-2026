const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { db } = require('../config/database');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// === PROFILFOTO HOCHLADEN ===
router.post('/profile-photo', authenticateUser, upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Kein Bild hochgeladen.' });
    }

    // Altes Bild löschen
    const user = db.prepare('SELECT profile_photo FROM users WHERE id = ?').get(req.user.id);
    if (user.profile_photo) {
      const oldPath = path.join(__dirname, '..', '..', 'uploads', 'profiles', user.profile_photo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    db.prepare('UPDATE users SET profile_photo = ? WHERE id = ?').run(req.file.filename, req.user.id);

    res.json({ 
      message: 'Profilfoto aktualisiert.',
      filename: req.file.filename
    });
  } catch (err) {
    console.error('Upload Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Hochladen.' });
  }
});

// === PROFILFOTO LÖSCHEN ===
router.delete('/profile-photo', authenticateUser, (req, res) => {
  try {
    const user = db.prepare('SELECT profile_photo FROM users WHERE id = ?').get(req.user.id);
    if (user.profile_photo) {
      const filePath = path.join(__dirname, '..', '..', 'uploads', 'profiles', user.profile_photo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      db.prepare('UPDATE users SET profile_photo = NULL WHERE id = ?').run(req.user.id);
    }
    res.json({ message: 'Profilfoto gelöscht.' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen.' });
  }
});

// === EIGENE TURNIERE ===
router.get('/my-tournaments', authenticateUser, (req, res) => {
  try {
    const tournaments = db.prepare(`
      SELECT t.*, tr.status as registration_status
      FROM tournament_registrations tr
      JOIN tournaments t ON tr.tournament_id = t.id
      WHERE tr.user_id = ?
      ORDER BY t.tournament_start DESC
    `).all(req.user.id);

    res.json({ tournaments });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === EIGENE MATCHES ===
router.get('/my-matches', authenticateUser, (req, res) => {
  try {
    const matches = db.prepare(`
      SELECT m.*, 
             t.name as tournament_name, t.type as tournament_type,
             r.name as round_name, r.round_number,
             u1.name as player1_name, u1.username as player1_username,
             u2.name as player2_name, u2.username as player2_username,
             p1.name as partner1_name, p2.name as partner2_name,
             w.name as winner_name
      FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      LEFT JOIN rounds r ON m.round_id = r.id
      LEFT JOIN users u1 ON m.player1_id = u1.id
      LEFT JOIN users u2 ON m.player2_id = u2.id
      LEFT JOIN users p1 ON m.partner1_id = p1.id
      LEFT JOIN users p2 ON m.partner2_id = p2.id
      LEFT JOIN users w ON m.winner_id = w.id
      WHERE m.player1_id = ? OR m.player2_id = ? OR m.partner1_id = ? OR m.partner2_id = ?
      ORDER BY m.created_at DESC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id);

    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

module.exports = router;
