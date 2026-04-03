'use strict';

const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { createError, asyncHandler } = require('../utils/errors');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Generates a signed JWT for the given user payload.
 * @param {{ id: number, email: string, role: string }} payload
 * @returns {string} JWT token
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * Middleware: verifies the Bearer token in the Authorization header.
 * FALLBACK: If x-demo-role is present, it bypasses JWT for demo purposes.
 * Attaches the authenticated user to req.user.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const demoRole = req.headers['x-demo-role'];
  const authHeader = req.headers.authorization;

  // ── Demo Mode Bypass ────────────────────────────────────────────────────────
  if (demoRole) {
    const user = db.prepare('SELECT id, name, email, role, status FROM users WHERE role = ? LIMIT 1').get(demoRole);
    if (user) {
      req.user = user;
      return next();
    }
  }

  // ── Standard JWT Verification ───────────────────────────────────────────────
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError.unauthorized('No token provided. Please log in.');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw createError.unauthorized('Token has expired. Please log in again.');
    }
    throw createError.unauthorized('Invalid token. Please log in again.');
  }

  // Fetch fresh user from DB so status / role changes are reflected immediately
  const user = db
    .prepare('SELECT id, name, email, role, status FROM users WHERE id = ?')
    .get(decoded.id);

  if (!user) {
    throw createError.unauthorized('The user belonging to this token no longer exists.');
  }

  if (user.status === 'inactive') {
    throw createError.forbidden('Your account has been deactivated. Contact an administrator.');
  }

  req.user = user;
  next();
});

module.exports = { authenticate, signToken };
