const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'summerleague.db');

// Stelle sicher, dass das Verzeichnis existiert
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// WAL-Modus für bessere Performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    -- Benutzer-Tabelle
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      dtb_id TEXT,
      lk REAL DEFAULT 25.0,
      profile_photo TEXT,
      email_verified INTEGER DEFAULT 0,
      verification_code TEXT,
      verification_code_expires INTEGER,
      reset_token TEXT,
      reset_token_expires INTEGER,
      data_consent INTEGER DEFAULT 0,
      data_consent_date TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Admin-Tabelle
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Turniere
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('league', 'ko', 'lk_day', 'doubles', 'one_point', 'tiebreak_ko')),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'registration_open', 'registration_closed', 'draw_complete', 'in_progress', 'completed', 'cancelled')),
      max_participants INTEGER NOT NULL DEFAULT 16,
      
      -- Liga-Modus Einstellungen
      points_win INTEGER DEFAULT 3,
      points_loss INTEGER DEFAULT 0,
      points_draw INTEGER DEFAULT 1,
      lk_handicap_enabled INTEGER DEFAULT 0,
      lk_handicap_factor REAL DEFAULT 0.5,
      
      -- Spielregeln
      winning_sets INTEGER DEFAULT 2 CHECK(winning_sets IN (2, 3)),
      no_ad INTEGER DEFAULT 0,
      match_tiebreak INTEGER DEFAULT 0,
      match_tiebreak_at TEXT DEFAULT '1:1',
      
      -- Doppel-Einstellungen
      doubles_rounds INTEGER DEFAULT 3,
      doubles_random_partners INTEGER DEFAULT 0,
      is_doubles INTEGER DEFAULT 0,
      doubles_round_duration INTEGER,
      doubles_start_time TEXT,
      doubles_courts TEXT,
      
      -- Ergebnis-Einstellungen
      entry_fee TEXT,
      prize_description TEXT,
      self_reporting INTEGER DEFAULT 0,
      dtb_id_required INTEGER DEFAULT 0,
      
      -- Termine
      registration_deadline TEXT,
      draw_date TEXT,
      tournament_start TEXT,
      tournament_end TEXT,
      start_time TEXT,
      location TEXT,
      
      created_by INTEGER REFERENCES admins(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Turnier-Anmeldungen
    CREATE TABLE IF NOT EXISTS tournament_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'withdrawn')),
      seed_number INTEGER,
      partner_name TEXT,
      partner_id INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tournament_id, user_id)
    );

    -- Runden
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      name TEXT,
      scheduled_date TEXT,
      scheduled_time TEXT,
      scheduled_duration INTEGER,
      location TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Matches/Spiele
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      round_id INTEGER REFERENCES rounds(id) ON DELETE CASCADE,
      match_number INTEGER,
      
      -- Einzel
      player1_id INTEGER REFERENCES users(id),
      player2_id INTEGER REFERENCES users(id),
      
      -- Doppel
      partner1_id INTEGER REFERENCES users(id),
      partner2_id INTEGER REFERENCES users(id),
      
      -- KO-Baum
      bracket_position INTEGER,
      next_match_id INTEGER REFERENCES matches(id),
      
      -- Ergebnis
      score TEXT,
      sets_player1 INTEGER DEFAULT 0,
      sets_player2 INTEGER DEFAULT 0,
      winner_id INTEGER REFERENCES users(id),
      walkover INTEGER DEFAULT 0,
      
      -- Ergebnis-Status
      result_status TEXT DEFAULT 'pending' CHECK(result_status IN ('pending', 'reported', 'confirmed', 'disputed', 'admin_set')),
      reported_by INTEGER REFERENCES users(id),
      confirmation_token TEXT,
      dispute_reason TEXT,
      
      scheduled_date TEXT,
      scheduled_time TEXT,
      court TEXT,
      server_id INTEGER REFERENCES users(id),
      
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Liga-Tabelle
    CREATE TABLE IF NOT EXISTS league_standings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      points REAL DEFAULT 0,
      matches_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      sets_won INTEGER DEFAULT 0,
      sets_lost INTEGER DEFAULT 0,
      games_won INTEGER DEFAULT 0,
      games_lost INTEGER DEFAULT 0,
      bonus_points REAL DEFAULT 0,
      UNIQUE(tournament_id, user_id)
    );

    -- Match-Satz-Details
    CREATE TABLE IF NOT EXISTS match_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      games_player1 INTEGER DEFAULT 0,
      games_player2 INTEGER DEFAULT 0,
      tiebreak_points_player1 INTEGER,
      tiebreak_points_player2 INTEGER,
      UNIQUE(match_id, set_number)
    );

    -- Doppel-Tabelle (Rangliste)
    CREATE TABLE IF NOT EXISTS doubles_standings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      partner_id INTEGER REFERENCES users(id),
      match_points INTEGER DEFAULT 0,
      matches_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      games_won INTEGER DEFAULT 0,
      games_lost INTEGER DEFAULT 0,
      UNIQUE(tournament_id, user_id)
    );

    -- E-Mail-Log
    CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      type TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'sent'
    );

    -- Indices für Performance
    CREATE INDEX IF NOT EXISTS idx_tournament_reg_tournament ON tournament_registrations(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_reg_user ON tournament_registrations(user_id);
    CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_matches_players ON matches(player1_id, player2_id);
    CREATE INDEX IF NOT EXISTS idx_league_standings_tournament ON league_standings(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_rounds_tournament ON rounds(tournament_id);
  `);

  // Migrations for existing databases
  const migrations = [
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('rounds') WHERE name='scheduled_time'", sql: "ALTER TABLE rounds ADD COLUMN scheduled_time TEXT" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('rounds') WHERE name='scheduled_duration'", sql: "ALTER TABLE rounds ADD COLUMN scheduled_duration INTEGER" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('rounds') WHERE name='location'", sql: "ALTER TABLE rounds ADD COLUMN location TEXT" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('tournaments') WHERE name='is_doubles'", sql: "ALTER TABLE tournaments ADD COLUMN is_doubles INTEGER DEFAULT 0" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('tournaments') WHERE name='doubles_round_duration'", sql: "ALTER TABLE tournaments ADD COLUMN doubles_round_duration INTEGER" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('tournaments') WHERE name='doubles_start_time'", sql: "ALTER TABLE tournaments ADD COLUMN doubles_start_time TEXT" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('tournaments') WHERE name='doubles_courts'", sql: "ALTER TABLE tournaments ADD COLUMN doubles_courts TEXT" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('tournament_registrations') WHERE name='partner_name'", sql: "ALTER TABLE tournament_registrations ADD COLUMN partner_name TEXT" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('tournament_registrations') WHERE name='partner_id'", sql: "ALTER TABLE tournament_registrations ADD COLUMN partner_id INTEGER REFERENCES users(id)" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('tournaments') WHERE name='entry_fee'", sql: "ALTER TABLE tournaments ADD COLUMN entry_fee TEXT" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('tournaments') WHERE name='prize_description'", sql: "ALTER TABLE tournaments ADD COLUMN prize_description TEXT" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('users') WHERE name='phone'", sql: "ALTER TABLE users ADD COLUMN phone TEXT" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('matches') WHERE name='server_id'", sql: "ALTER TABLE matches ADD COLUMN server_id INTEGER REFERENCES users(id)" },
    { check: "SELECT COUNT(*) as cnt FROM pragma_table_info('tournaments') WHERE name='start_time'", sql: "ALTER TABLE tournaments ADD COLUMN start_time TEXT" },
  ];
  for (const m of migrations) {
    if (db.prepare(m.check).get().cnt === 0) {
      db.exec(m.sql);
    }
  }

  // Migrate tournaments table CHECK constraint for new types
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tournaments'").get();
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('one_point')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        ALTER TABLE tournaments RENAME TO tournaments_old;
      `);
      // Recreate with updated CHECK
      db.exec(`
        CREATE TABLE tournaments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL CHECK(type IN ('league', 'ko', 'lk_day', 'doubles', 'one_point', 'tiebreak_ko')),
          status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'registration_open', 'registration_closed', 'draw_complete', 'in_progress', 'completed', 'cancelled')),
          max_participants INTEGER NOT NULL DEFAULT 16,
          points_win INTEGER DEFAULT 3,
          points_loss INTEGER DEFAULT 0,
          points_draw INTEGER DEFAULT 1,
          lk_handicap_enabled INTEGER DEFAULT 0,
          lk_handicap_factor REAL DEFAULT 0.5,
          winning_sets INTEGER DEFAULT 2 CHECK(winning_sets IN (2, 3)),
          no_ad INTEGER DEFAULT 0,
          match_tiebreak INTEGER DEFAULT 0,
          match_tiebreak_at TEXT DEFAULT '1:1',
          doubles_rounds INTEGER DEFAULT 3,
          doubles_random_partners INTEGER DEFAULT 0,
          is_doubles INTEGER DEFAULT 0,
          doubles_round_duration INTEGER,
          doubles_start_time TEXT,
          doubles_courts TEXT,
          entry_fee TEXT,
          prize_description TEXT,
          self_reporting INTEGER DEFAULT 0,
          dtb_id_required INTEGER DEFAULT 0,
          registration_deadline TEXT,
          draw_date TEXT,
          tournament_start TEXT,
          tournament_end TEXT,
          start_time TEXT,
          location TEXT,
          created_by INTEGER REFERENCES admins(id),
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
      db.exec(`INSERT INTO tournaments (
          id, name, description, type, status, max_participants,
          points_win, points_loss, points_draw, lk_handicap_enabled, lk_handicap_factor,
          winning_sets, no_ad, match_tiebreak, match_tiebreak_at,
          doubles_rounds, doubles_random_partners, is_doubles,
          doubles_round_duration, doubles_start_time, doubles_courts,
          entry_fee, prize_description, self_reporting, dtb_id_required,
          registration_deadline, draw_date, tournament_start, tournament_end,
          location, created_by, created_at, updated_at
        ) SELECT
          id, name, description, type, status, max_participants,
          points_win, points_loss, points_draw, lk_handicap_enabled, lk_handicap_factor,
          winning_sets, no_ad, match_tiebreak, match_tiebreak_at,
          doubles_rounds, doubles_random_partners, is_doubles,
          doubles_round_duration, doubles_start_time, doubles_courts,
          entry_fee, prize_description, self_reporting, dtb_id_required,
          registration_deadline, draw_date, tournament_start, tournament_end,
          location, created_by, created_at, updated_at
        FROM tournaments_old`);
      db.exec(`DROP TABLE tournaments_old`);
      db.pragma('foreign_keys = ON');
    }
  } catch (e) {
    console.log('Tournament type migration skipped:', e.message);
    try { db.pragma('foreign_keys = ON'); } catch {}
  }

  // Create doubles_standings table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS doubles_standings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      partner_id INTEGER REFERENCES users(id),
      match_points INTEGER DEFAULT 0,
      matches_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      games_won INTEGER DEFAULT 0,
      games_lost INTEGER DEFAULT 0,
      UNIQUE(tournament_id, user_id)
    )
  `);

  console.log('Datenbank initialisiert.');
}

module.exports = { db, initializeDatabase };
