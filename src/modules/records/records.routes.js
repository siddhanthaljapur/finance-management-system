'use strict';

const { Router } = require('express');
const { asyncHandler } = require('../../utils/errors');
const { authenticate } = require('../../middleware/auth');
const { requireRole, requireMinRole } = require('../../middleware/rbac');
const {
  listRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
} = require('./records.service');

const router = Router();

// All record routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/records
 * @desc    List records. Supports ?type, ?category, ?from, ?to, ?search, ?page, ?limit
 * @access  All authenticated roles
 */
router.get('/', asyncHandler(listRecords));

/**
 * @route   GET /api/records/:id
 * @desc    Get a single financial record
 * @access  All authenticated roles
 */
router.get('/:id', asyncHandler(getRecordById));

/**
 * @route   POST /api/records
 * @desc    Create a new financial record
 * @access  Analyst, Admin
 */
router.post('/', requireMinRole('analyst'), asyncHandler(createRecord));

/**
 * @route   PUT /api/records/:id
 * @desc    Update an existing financial record
 * @access  Analyst, Admin
 */
router.put('/:id', requireMinRole('analyst'), asyncHandler(updateRecord));

/**
 * @route   DELETE /api/records/:id
 * @desc    Soft-delete a financial record
 * @access  Admin only
 */
router.delete('/:id', requireRole('admin'), asyncHandler(deleteRecord));

module.exports = router;
