'use strict';

const db = require('../../config/db');
const { createError } = require('../../utils/errors');
const {
  createRecordSchema,
  updateRecordSchema,
  recordFilterSchema,
} = require('../../utils/validators');

/**
 * GET /api/records
 * List records with filtering, search, and pagination.
 * Soft-deleted records are excluded.
 */
function listRecords(req, res) {
  const filters = recordFilterSchema.parse(req.query);
  const { type, category, from, to, page, limit, search } = filters;
  const offset = (page - 1) * limit;

  const conditions = ['r.deleted_at IS NULL'];
  const params = [];

  if (type) {
    conditions.push('r.type = ?');
    params.push(type);
  }
  if (category) {
    conditions.push('r.category = ?');
    params.push(category);
  }
  if (from) {
    conditions.push('r.date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('r.date <= ?');
    params.push(to);
  }
  if (search) {
    conditions.push('(r.notes LIKE ? OR r.category LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const total = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM records r
       ${where}`
    )
    .get(...params).count;

  const records = db
    .prepare(
      `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
              r.created_at, r.updated_at,
              u.id as creator_id, u.name as creator_name, u.email as creator_email
       FROM records r
       JOIN users u ON r.created_by = u.id
       ${where}
       ORDER BY r.date DESC, r.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.status(200).json({
    status: 'success',
    data: {
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
}

/**
 * GET /api/records/:id
 * Get a single record by ID.
 */
function getRecordById(req, res) {
  const record = db
    .prepare(
      `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
              r.created_at, r.updated_at,
              u.id as creator_id, u.name as creator_name
       FROM records r
       JOIN users u ON r.created_by = u.id
       WHERE r.id = ? AND r.deleted_at IS NULL`
    )
    .get(req.params.id);

  if (!record) {
    throw createError.notFound('Financial record not found.');
  }

  res.status(200).json({ status: 'success', data: { record } });
}

/**
 * POST /api/records
 * Create a new financial record. Analyst or Admin only.
 */
function createRecord(req, res) {
  const data = createRecordSchema.parse(req.body);

  const result = db
    .prepare(
      `INSERT INTO records (amount, type, category, date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(data.amount, data.type, data.category, data.date, data.notes ?? null, req.user.id);

  const record = db
    .prepare(
      `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
              r.created_at, r.updated_at,
              u.name as creator_name
       FROM records r
       JOIN users u ON r.created_by = u.id
       WHERE r.id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json({
    status: 'success',
    message: 'Financial record created successfully.',
    data: { record },
  });
}

/**
 * PUT /api/records/:id
 * Update an existing record. Analyst or Admin only.
 */
function updateRecord(req, res) {
  const data = updateRecordSchema.parse(req.body);
  const recordId = parseInt(req.params.id, 10);

  const existing = db
    .prepare('SELECT * FROM records WHERE id = ? AND deleted_at IS NULL')
    .get(recordId);

  if (!existing) {
    throw createError.notFound('Financial record not found.');
  }

  const updated = {
    amount: data.amount ?? existing.amount,
    type: data.type ?? existing.type,
    category: data.category ?? existing.category,
    date: data.date ?? existing.date,
    notes: data.notes !== undefined ? data.notes : existing.notes,
  };

  db.prepare(
    `UPDATE records
     SET amount = ?, type = ?, category = ?, date = ?, notes = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(updated.amount, updated.type, updated.category, updated.date, updated.notes, recordId);

  const record = db
    .prepare(
      `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
              r.created_at, r.updated_at,
              u.name as creator_name
       FROM records r
       JOIN users u ON r.created_by = u.id
       WHERE r.id = ?`
    )
    .get(recordId);

  res.status(200).json({
    status: 'success',
    message: 'Financial record updated successfully.',
    data: { record },
  });
}

/**
 * DELETE /api/records/:id
 * Soft-delete a record (sets deleted_at). Admin only.
 * Preserves financial history.
 */
function deleteRecord(req, res) {
  const recordId = parseInt(req.params.id, 10);

  const existing = db
    .prepare('SELECT id FROM records WHERE id = ? AND deleted_at IS NULL')
    .get(recordId);

  if (!existing) {
    throw createError.notFound('Financial record not found.');
  }

  db.prepare(
    `UPDATE records SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(recordId);

  res.status(200).json({
    status: 'success',
    message: 'Financial record deleted successfully.',
  });
}

module.exports = { listRecords, getRecordById, createRecord, updateRecord, deleteRecord };
