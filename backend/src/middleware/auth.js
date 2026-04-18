const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

// JWT-Token verifizieren für User
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht autorisiert. Bitte einloggen.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'user') {
      return res.status(403).json({ error: 'Kein Benutzerzugang.' });
    }
    const user = db.prepare('SELECT id, username, email, name, dtb_id, lk, profile_photo, email_verified, is_active FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Benutzer nicht gefunden oder deaktiviert.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Ungültiger Token.' });
  }
}

// JWT-Token verifizieren für Admin
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht autorisiert. Bitte als Admin einloggen.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Kein Admin-Zugang.' });
    }
    const admin = db.prepare('SELECT id, username, email FROM admins WHERE id = ?').get(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: 'Admin nicht gefunden.' });
    }
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Ungültiger Token.' });
  }
}

// Optional: User oder nicht authentifiziert
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'user') {
      req.user = db.prepare('SELECT id, username, email, name, dtb_id, lk, profile_photo, email_verified, is_active FROM users WHERE id = ?').get(decoded.id);
    }
  } catch (err) {
    // Token ungültig, aber das ist OK bei optionalAuth
  }
  next();
}

module.exports = { authenticateUser, authenticateAdmin, optionalAuth };
