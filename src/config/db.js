'use strict';

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

// On Railway/Production, the root folder is read-only. We force a writable path if none is provided.
const isProd = process.env.RAILWAY_ENVIRONMENT || process.env.PORT; 
const DEFAULT_DB = isProd ? '/tmp/finance.db' : './finance.db';
const DB_PATH = process.env.DB_PATH || DEFAULT_DB;

console.log(`📡 Database System: Using path ${path.resolve(DB_PATH)}`);

const db = new Database(path.resolve(DB_PATH), { timeout: 10000 });

// Use simple, robust settings for maximum compatibility on PAAS
db.pragma('journal_mode = DELETE');
db.pragma('synchronous = FULL');
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema.
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

// Global initialization
try {
  initializeSchema();
} catch (e) {
  console.error("Schema Init Error:", e);
}

module.exports = db;
