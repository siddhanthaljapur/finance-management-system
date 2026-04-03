'use strict';

const { Router } = require('express');
const { asyncHandler } = require('../../utils/errors');
const { authenticate } = require('../../middleware/auth');
const { register, login, getMe } = require('./auth.service');

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (default role: viewer)
 * @access  Public (or Admin to set custom role)
 */
router.post('/register', asyncHandler(register));

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT
 * @access  Public
 */
router.post('/login', asyncHandler(login));

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(getMe));

module.exports = router;
