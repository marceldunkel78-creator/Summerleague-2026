const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// === REGISTRIERUNG ===
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name, dtb_id, lk, data_consent } = req.body;

    // Validierung
    if (!username || !email || !password || !name) {
      return res.status(400).json({ error: 'Alle Pflichtfelder müssen ausgefüllt werden.' });
    }

    if (lk === undefined || lk === null || lk === '') {
      return res.status(400).json({ error: 'Leistungsklasse (LK) muss angegeben werden.' });
    }

    const lkNum = parseFloat(lk);
    if (isNaN(lkNum) || lkNum < 1 || lkNum > 25) {
      return res.status(400).json({ error: 'LK muss zwischen 1 und 25 liegen.' });
    }

    if (!data_consent) {
      return res.status(400).json({ error: 'Du musst der Datenverarbeitung zustimmen.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
    }

    // DTB-ID Format prüfen (optional)
    if (dtb_id && !/^\d{7,10}$/.test(dtb_id)) {
      return res.status(400).json({ error: 'DTB-ID muss 7-10 Ziffern haben (z.B. 17852782).' });
    }

    // Prüfe ob User bereits existiert
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Benutzername oder E-Mail bereits vergeben.' });
    }

    if (dtb_id) {
      const existingDtb = db.prepare('SELECT id FROM users WHERE dtb_id = ?').get(dtb_id);
      if (existingDtb) {
        return res.status(409).json({ error: 'Diese DTB-ID ist bereits registriert.' });
      }
    }

    // Passwort hashen
    const password_hash = await bcrypt.hash(password, 12);

    // Verifizierungscode generieren
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpires = Date.now() + 15 * 60 * 1000; // 15 Minuten

    // User erstellen
    const result = db.prepare(
      `INSERT INTO users (username, email, password_hash, name, dtb_id, lk, data_consent, data_consent_date, verification_code, verification_code_expires) 
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), ?, ?)`
    ).run(username, email, password_hash, name, dtb_id || null, lkNum, verificationCode, codeExpires);

    // Verifizierungs-E-Mail senden
    try {
      await sendVerificationEmail(email, name, verificationCode);
    } catch (emailErr) {
      console.error('E-Mail-Versand fehlgeschlagen:', emailErr.message);
      // User trotzdem erstellt, Code kann erneut angefordert werden
    }

    res.status(201).json({
      message: 'Registrierung erfolgreich! Bitte bestätige deine E-Mail.',
      userId: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Registrierung Fehler:', err);
    res.status(500).json({ error: 'Serverfehler bei der Registrierung.' });
  }
});

// === E-MAIL VERIFIZIERUNG ===
router.post('/verify-email', (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'E-Mail und Code sind erforderlich.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'E-Mail bereits verifiziert.' });
    }

    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Ungültiger Verifizierungscode.' });
    }

    if (Date.now() > user.verification_code_expires) {
      return res.status(400).json({ error: 'Verifizierungscode abgelaufen. Bitte neuen anfordern.' });
    }

    db.prepare('UPDATE users SET email_verified = 1, verification_code = NULL, verification_code_expires = NULL WHERE id = ?').run(user.id);

    res.json({ message: 'E-Mail erfolgreich verifiziert! Du kannst dich jetzt einloggen.' });
  } catch (err) {
    console.error('Verifizierung Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === NEUEN VERIFIZIERUNGSCODE ANFORDERN ===
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    if (user.email_verified) return res.status(400).json({ error: 'Bereits verifiziert.' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 15 * 60 * 1000;

    db.prepare('UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?').run(code, expires, user.id);

    await sendVerificationEmail(user.email, user.name, code);
    res.json({ message: 'Neuer Verifizierungscode gesendet.' });
  } catch (err) {
    console.error('Resend Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === LOGIN ===
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: 'Benutzername/E-Mail und Passwort sind erforderlich.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
    if (!user) {
      return res.status(401).json({ error: 'Ungültige Zugangsdaten.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Dein Konto wurde deaktiviert.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Zugangsdaten.' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ 
        error: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
        needsVerification: true,
        email: user.email
      });
    }

    const token = jwt.sign(
      { id: user.id, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        dtb_id: user.dtb_id,
        lk: user.lk,
        profile_photo: user.profile_photo
      }
    });
  } catch (err) {
    console.error('Login Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === PASSWORT VERGESSEN ===
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-Mail ist erforderlich.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      // Aus Sicherheitsgründen gleiche Antwort
      return res.json({ message: 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link gesendet.' });
    }

    const resetToken = uuidv4();
    const expires = Date.now() + 60 * 60 * 1000; // 1 Stunde

    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
      .run(resetToken, expires, user.id);

    await sendPasswordResetEmail(user.email, user.name, resetToken);

    res.json({ message: 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link gesendet.' });
  } catch (err) {
    console.error('Forgot-Password Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === PASSWORT ZURÜCKSETZEN ===
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token und neues Passwort sind erforderlich.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
    if (!user) {
      return res.status(400).json({ error: 'Ungültiger Reset-Link.' });
    }

    if (Date.now() > user.reset_token_expires) {
      return res.status(400).json({ error: 'Reset-Link abgelaufen.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?')
      .run(password_hash, user.id);

    res.json({ message: 'Passwort erfolgreich geändert.' });
  } catch (err) {
    console.error('Reset-Password Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === PROFIL ABRUFEN ===
router.get('/me', authenticateUser, (req, res) => {
  res.json({ user: req.user });
});

// === PROFIL AKTUALISIEREN ===
router.put('/me', authenticateUser, async (req, res) => {
  try {
    const { name, lk } = req.body;
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (lk !== undefined) { updates.push('lk = ?'); params.push(lk); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen angegeben.' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT id, username, email, name, dtb_id, lk, profile_photo FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: updated });
  } catch (err) {
    console.error('Profil-Update Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === PASSWORT ÄNDERN ===
router.put('/change-password', authenticateUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort sind erforderlich.' });
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Aktuelles Passwort ist falsch.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);

    res.json({ message: 'Passwort erfolgreich geändert.' });
  } catch (err) {
    console.error('Change-Password Fehler:', err);
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

// === LK-ABFRAGE über nuLiga (DTB) ===
router.get('/lk-lookup/:dtbId', async (req, res) => {
  try {
    const { dtbId } = req.params;
    if (!/^\d{7,10}$/.test(dtbId)) {
      return res.status(400).json({ error: 'Ungültige DTB-ID.' });
    }

    // nuLiga-Spielersuche über die öffentliche Webseite
    const searchUrl = `https://liga.tennis.de/cgi-bin/WebObjects/nuLigaTennis.woa/wa/playerSearch?federation=WTB&playerID=${dtbId}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    const html = await response.text();
    
    // LK aus der Ergebnisseite extrahieren
    // nuLiga zeigt LK in der Spielerdetails-Tabelle an
    let lk = null;
    let name = null;

    // Versuche LK zu finden (Format: "LK 15" oder "LK 8.2" etc.)
    const lkMatch = html.match(/(?:LK|Leistungsklasse)[:\s]*(\d{1,2}(?:[.,]\d)?)/i);
    if (lkMatch) {
      lk = parseFloat(lkMatch[1].replace(',', '.'));
    }

    // Versuche den Spielernamen zu finden
    const nameMatch = html.match(/<td[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)</i) 
      || html.match(/class="playerName"[^>]*>([^<]+)/i)
      || html.match(/<h[1-4][^>]*>([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)<\/h/);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    if (lk) {
      res.json({ lk, name, source: 'nuLiga' });
    } else {
      // Fallback: Prüfe ob die Seite überhaupt Ergebnisse hat
      const hasResults = html.includes('playerDetail') || html.includes('Spielerdetail');
      res.json({ 
        lk: null, 
        name: name || null, 
        message: hasResults 
          ? 'Spieler gefunden, aber LK konnte nicht automatisch ausgelesen werden.' 
          : 'Kein Spieler mit dieser DTB-ID gefunden.',
        source: 'nuLiga'
      });
    }
  } catch (err) {
    console.error('LK-Lookup Fehler:', err.message);
    res.json({ 
      lk: null, 
      name: null, 
      message: 'LK-Abfrage fehlgeschlagen. Der DTB-Service ist möglicherweise nicht erreichbar.',
      source: 'nuLiga'
    });
  }
});

module.exports = router;
