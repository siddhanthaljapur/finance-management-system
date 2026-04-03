'use strict';

const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const { signToken } = require('../../middleware/auth');
const { createError } = require('../../utils/errors');
const { registerSchema, loginSchema } = require('../../utils/validators');

/**
 * POST /api/auth/register
 * Anyone can register; role defaults to 'viewer'.
 * Only an admin can explicitly set a role during registration.
 */
async function register(req, res) {
  const data = registerSchema.parse(req.body);

  // Only admins can assign non-viewer roles on registration
  const role =
    req.user?.role === 'admin' && data.role ? data.role : 'viewer';

  // Check duplicate email
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(data.email);
  if (existing) {
    throw createError.conflict('A user with this email address already exists.');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, ?)`
    )
    .run(data.name, data.email, passwordHash, role);

  const user = db
    .prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid);

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  res.status(201).json({
    status: 'success',
    message: 'Account created successfully.',
    data: { user, token },
  });
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const data = loginSchema.parse(req.body);

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(data.email);

  if (!user) {
    throw createError.unauthorized('Invalid email or password.');
  }

  if (user.status === 'inactive') {
    throw createError.forbidden('Your account has been deactivated. Contact an administrator.');
  }

  const passwordMatches = await bcrypt.compare(data.password, user.password_hash);
  if (!passwordMatches) {
    throw createError.unauthorized('Invalid email or password.');
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  const { password_hash, ...safeUser } = user;

  res.status(200).json({
    status: 'success',
    message: 'Logged in successfully.',
    data: { user: safeUser, token },
  });
}

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 */
function getMe(req, res) {
  const user = db
    .prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?')
    .get(req.user.id);

  res.status(200).json({
    status: 'success',
    data: { user },
  });
}

module.exports = { register, login, getMe };
