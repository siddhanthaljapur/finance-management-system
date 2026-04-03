'use strict';

const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const { createError } = require('../../utils/errors');
const { updateUserSchema } = require('../../utils/validators');

/**
 * GET /api/users
 * List all users with optional status filter. Admin only.
 */
function listUsers(req, res) {
  const { status, role, page = '1', limit = '20' } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  let where = [];
  let params = [];

  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (role) {
    where.push('role = ?');
    params.push(role);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`)
    .get(...params).count;

  const users = db
    .prepare(
      `SELECT id, name, email, role, status, created_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limitNum, offset);

  res.status(200).json({
    status: 'success',
    data: {
      users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
}

/**
 * GET /api/users/:id
 * Get a single user by ID. Admin only.
 */
function getUserById(req, res) {
  const user = db
    .prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?')
    .get(req.params.id);

  if (!user) {
    throw createError.notFound('User not found.');
  }

  res.status(200).json({ status: 'success', data: { user } });
}

/**
 * PUT /api/users/:id
 * Update a user's role or status. Admin only.
 * An admin cannot demote or deactivate their own account.
 */
function updateUser(req, res) {
  const targetId = parseInt(req.params.id, 10);

  // Prevent admins from modifying their own role/status through this endpoint
  if (targetId === req.user.id) {
    throw createError.forbidden(
      'You cannot modify your own account through this endpoint. Use profile settings.'
    );
  }

  const data = updateUserSchema.parse(req.body);

  const existing = db
    .prepare('SELECT id, name, email, role, status FROM users WHERE id = ?')
    .get(targetId);

  if (!existing) {
    throw createError.notFound('User not found.');
  }

  const updated = {
    name: data.name ?? existing.name,
    role: data.role ?? existing.role,
    status: data.status ?? existing.status,
  };

  db.prepare(
    'UPDATE users SET name = ?, role = ?, status = ? WHERE id = ?'
  ).run(updated.name, updated.role, updated.status, targetId);

  const user = db
    .prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?')
    .get(targetId);

  res.status(200).json({
    status: 'success',
    message: 'User updated successfully.',
    data: { user },
  });
}

/**
 * DELETE /api/users/:id
 * Soft-deactivate a user (sets status = inactive). Admin only.
 */
function deactivateUser(req, res) {
  const targetId = parseInt(req.params.id, 10);

  if (targetId === req.user.id) {
    throw createError.forbidden('You cannot deactivate your own account.');
  }

  const existing = db
    .prepare('SELECT id, status FROM users WHERE id = ?')
    .get(targetId);

  if (!existing) {
    throw createError.notFound('User not found.');
  }

  if (existing.status === 'inactive') {
    throw createError.badRequest('User is already inactive.');
  }

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run('inactive', targetId);

  res.status(200).json({
    status: 'success',
    message: 'User has been deactivated.',
  });
}

module.exports = { listUsers, getUserById, updateUser, deactivateUser };
