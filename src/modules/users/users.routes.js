'use strict';

const { Router } = require('express');
const { asyncHandler } = require('../../utils/errors');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const {
  listUsers,
  getUserById,
  updateUser,
  deactivateUser,
} = require('./users.service');

const router = Router();

// All user management routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

/**
 * @route   GET /api/users
 * @desc    List all users (with optional ?status= and ?role= filter, paginated)
 * @access  Admin
 */
router.get('/', asyncHandler(listUsers));

/**
 * @route   GET /api/users/:id
 * @desc    Get a single user
 * @access  Admin
 */
router.get('/:id', asyncHandler(getUserById));

/**
 * @route   PUT /api/users/:id
 * @desc    Update user role or status
 * @access  Admin
 */
router.put('/:id', asyncHandler(updateUser));

/**
 * @route   DELETE /api/users/:id
 * @desc    Deactivate a user (soft delete)
 * @access  Admin
 */
router.delete('/:id', asyncHandler(deactivateUser));

module.exports = router;
