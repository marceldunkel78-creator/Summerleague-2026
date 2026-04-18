const bcrypt = require('bcryptjs');
const { db, initializeDatabase } = require('../config/database');

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

async function initAdmin() {
  initializeDatabase();

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'SummerLeague2026!';
  const email = process.env.ADMIN_EMAIL || 'marceldunkel78@gmail.com';

  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    console.log('Admin existiert bereits. Passwort wird aktualisiert...');
    const hash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE admins SET password_hash = ?, email = ? WHERE id = ?').run(hash, email, existing.id);
    console.log('Admin aktualisiert.');
  } else {
    const hash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO admins (username, email, password_hash) VALUES (?, ?, ?)').run(username, email, hash);
    console.log('Admin erstellt.');
  }

  console.log(`Username: ${username}`);
  console.log(`E-Mail: ${email}`);
  process.exit(0);
}

initAdmin().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
