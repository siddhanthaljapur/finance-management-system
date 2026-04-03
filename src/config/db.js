'use strict';

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './finance.db';

const db = new Database(path.resolve(DB_PATH));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema.
 * All tables are created with IF NOT EXISTS so this is safe to call on startup.
 */
function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      password_hash TEXT  NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer', 'analyst', 'admin')),
      status      TEXT    NOT NULL DEFAULT 'active'  CHECK(status IN ('active', 'inactive')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      REAL    NOT NULL CHECK(amount > 0),
      type        TEXT    NOT NULL CHECK(type IN ('income', 'expense')),
      category    TEXT    NOT NULL,
      date        TEXT    NOT NULL,
      notes       TEXT,
      created_by  INTEGER NOT NULL REFERENCES users(id),
      deleted_at  TEXT    DEFAULT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_type       ON records(type);
    CREATE INDEX IF NOT EXISTS idx_records_category   ON records(category);
    CREATE INDEX IF NOT EXISTS idx_records_date       ON records(date);
    CREATE INDEX IF NOT EXISTS idx_records_deleted_at ON records(deleted_at);
  `);
}

initializeSchema();

module.exports = db;
