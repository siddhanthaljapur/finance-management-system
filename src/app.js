'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Initialize DB (runs schema migration on startup)
require('./config/db');

const authRoutes      = require('./modules/auth/auth.routes');
const userRoutes      = require('./modules/users/users.routes');
const recordRoutes    = require('./modules/records/records.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const { globalErrorHandler } = require('./utils/errors');

const app = express();

// ── Security & parsing middleware ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc:       ["'self'", "fonts.gstatic.com"],
      imgSrc:        ["'self'", "data:"],
      connectSrc:    ["'self'"],
    },
  },
}));
app.use(cors());     // Enable CORS for all origins (tighten in production)
app.use(express.json({ limit: '10kb' }));        // Block huge payloads
app.use(express.urlencoded({ extended: false }));

// ── Frontend static files ─────────────────────────────────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'health.html'));
  }

  // Diagnostic: count users
  let userCount = 0;
  try {
    const res = db.prepare('SELECT COUNT(*) as count FROM users').get();
    userCount = res.count;
  } catch (e) { /* ignore */ }

  res.status(200).json({
    status: 'ok',
    service: 'Finance Management API',
    version: '1.0.0',
    userCount,
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/records',   recordRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── API info endpoint ─────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'api-info.html'));
  }
  res.status(200).json({
    status: 'success',
    message: 'Finance Management API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login':    'Login and get JWT token',
        'GET /api/auth/me':        'Get current user profile [auth]',
      },
      users: {
        'GET /api/users':          'List all users [admin]',
        'GET /api/users/:id':      'Get user by ID [admin]',
        'PUT /api/users/:id':      'Update user role/status [admin]',
        'DELETE /api/users/:id':   'Deactivate user [admin]',
      },
      records: {
        'GET /api/records':        'List records with filters [all]',
        'GET /api/records/:id':    'Get single record [all]',
        'POST /api/records':       'Create record [analyst, admin]',
        'PUT /api/records/:id':    'Update record [analyst, admin]',
        'DELETE /api/records/:id': 'Delete record [admin]',
      },
      dashboard: {
        'GET /api/dashboard/summary':       'Total income, expense, net [all]',
        'GET /api/dashboard/by-category':   'Category-wise breakdown [all]',
        'GET /api/dashboard/trends':        'Monthly trends ?year= [analyst, admin]',
        'GET /api/dashboard/recent':        'Recent transactions ?limit= [all]',
        'GET /api/dashboard/weekly-trends': 'Last 12 weeks trends [analyst, admin]',
      },
    },
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(globalErrorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  console.log(`\n🚀 Finance Management API running on http://localhost:${PORT}`);
  
  // ── Auto-Seed check ──
  try {
    const res = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (res.count === 0) {
      console.log('📦 Database is empty. Running auto-seed...');
      const { seedUsers, generateRecords } = require('../seed');
      const userIds = await seedUsers();
      generateRecords(userIds);
      console.log('✅ Auto-seed complete!');
    }
  } catch (e) {
    console.error('⚠️ Auto-seed failed:', e.message);
  }

  console.log(`   → Health:    http://localhost:${PORT}/health`);
  console.log(`   → API info:  http://localhost:${PORT}/api`);
  console.log(`   → Mode:      ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = server;
