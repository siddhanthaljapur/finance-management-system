'use strict';

/**
 * Seed Script
 * -----------
 * Creates three demo users (one per role) and 60 realistic financial records
 * spread across the current and previous year.
 *
 * Usage:  node seed.js
 *
 * WARNING: Running this more than once will add duplicate records but skip
 * existing users (emails are unique). To start fresh, delete finance.db first.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/db');

// ── Helper ────────────────────────────────────────────────────────────────────
function randomBetween(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function randomDateIn(year) {
  const start = new Date(`${year}-01-01`).getTime();
  const end   = new Date(`${year}-12-31`).getTime();
  return new Date(start + Math.random() * (end - start))
    .toISOString()
    .slice(0, 10);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Seed users ────────────────────────────────────────────────────────────────
const USERS = [
  { name: 'Alice Admin',   email: 'admin@finance.dev',   password: 'admin123',   role: 'admin' },
  { name: 'Anna Analyst',  email: 'analyst@finance.dev', password: 'analyst123', role: 'analyst' },
  { name: 'Victor Viewer', email: 'viewer@finance.dev',  password: 'viewer123',  role: 'viewer' },
];

async function seedUsers() {
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, ?)`
  );

  const userIds = {};
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const result = insertUser.run(u.name, u.email, hash, u.role);
    // Get the inserted or existing ID
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    userIds[u.role] = existing.id;
    if (result.changes > 0) {
      console.log(`  ✓ Created user: ${u.name} (${u.role}) — ${u.email} / ${u.password}`);
    } else {
      console.log(`  - Skipped (already exists): ${u.email}`);
    }
  }
  return userIds;
}

// ── Seed records ──────────────────────────────────────────────────────────────
const INCOME_CATEGORIES  = ['salary', 'freelance', 'investments', 'rental', 'bonus', 'dividends'];
const EXPENSE_CATEGORIES = ['rent', 'utilities', 'groceries', 'transport', 'entertainment', 
                             'healthcare', 'insurance', 'dining', 'shopping', 'subscriptions'];

const NOTES_INCOME  = ['Monthly salary', 'Client payment', 'Stock dividend', 'Bonus payment', 
                        'Rental income', 'Side project', null];
const NOTES_EXPENSE = ['Monthly rent', 'Electricity bill', 'Weekly groceries', 'Uber rides', 
                        'Netflix/Spotify', 'Doctor visit', 'Car insurance', null];

const CURRENT_YEAR  = new Date().getFullYear();
const PREVIOUS_YEAR = CURRENT_YEAR - 1;

function generateRecords(userIds) {
  const insertRecord = db.prepare(
    `INSERT INTO records (amount, type, category, date, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const insertMany = db.transaction((records) => {
    for (const r of records) {
      insertRecord.run(r.amount, r.type, r.category, r.date, r.notes, r.created_by);
    }
  });

  const records = [];
  const creators = [userIds.admin, userIds.analyst];

  // 30 records for previous year
  for (let i = 0; i < 30; i++) {
    const isIncome = Math.random() > 0.45;
    records.push({
      amount:     isIncome ? randomBetween(500, 8000) : randomBetween(50, 3000),
      type:       isIncome ? 'income' : 'expense',
      category:   isIncome ? pick(INCOME_CATEGORIES) : pick(EXPENSE_CATEGORIES),
      date:       randomDateIn(PREVIOUS_YEAR),
      notes:      isIncome ? pick(NOTES_INCOME) : pick(NOTES_EXPENSE),
      created_by: pick(creators),
    });
  }

  // 30 records for current year
  for (let i = 0; i < 30; i++) {
    const isIncome = Math.random() > 0.45;
    records.push({
      amount:     isIncome ? randomBetween(500, 8000) : randomBetween(50, 3000),
      type:       isIncome ? 'income' : 'expense',
      category:   isIncome ? pick(INCOME_CATEGORIES) : pick(EXPENSE_CATEGORIES),
      date:       randomDateIn(CURRENT_YEAR),
      notes:      isIncome ? pick(NOTES_INCOME) : pick(NOTES_EXPENSE),
      created_by: pick(creators),
    });
  }

  insertMany(records);
  console.log(`  ✓ Inserted ${records.length} financial records`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📦 Seeding database...\n');
  console.log('Users:');
  const userIds = await seedUsers();
  console.log('\nFinancial Records:');
  generateRecords(userIds);
  console.log('\n✅ Seed complete!\n');
  console.log('Demo credentials:');
  console.log('  Admin:   admin@finance.dev   / admin123');
  console.log('  Analyst: analyst@finance.dev / analyst123');
  console.log('  Viewer:  viewer@finance.dev  / viewer123\n');
  process.exit(0);
}

module.exports = { seedUsers, generateRecords };

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
}
