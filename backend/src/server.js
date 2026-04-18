require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Datenbank initialisieren
initializeDatabase();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100,
  message: { error: 'Zu viele Anfragen. Bitte warte einen Moment.' }
});
app.use('/api/auth', limiter);

// Statische Dateien (Profilfotos)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tournamentRoutes = require('./routes/tournaments');
const matchRoutes = require('./routes/matches');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/admin', adminRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Frontend statisch ausliefern (für Produktion)
const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Datei zu groß. Maximum: 5MB.' });
  }
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

app.listen(PORT, () => {
  console.log(`\n🎾 Summerleague Tennis Server läuft auf Port ${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
});

module.exports = app;
