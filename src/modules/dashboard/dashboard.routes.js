'use strict';

const { Router } = require('express');
const { asyncHandler } = require('../../utils/errors');
const { authenticate } = require('../../middleware/auth');
const { requireMinRole } = require('../../middleware/rbac');
const {
  getSummary,
  getByCategory,
  getMonthlyTrends,
  getRecentActivity,
  getWeeklyTrends,
} = require('./dashboard.service');

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/dashboard/summary
 * @desc    Total income, expenses, net balance, record count
 * @access  All authenticated roles
 */
router.get('/summary', asyncHandler(getSummary));

/**
 * @route   GET /api/dashboard/by-category
 * @desc    Income and expense totals grouped by category
 * @access  All authenticated roles
 */
router.get('/by-category', asyncHandler(getByCategory));

/**
 * @route   GET /api/dashboard/trends
 * @desc    Monthly income/expense trends for a given year (?year=2024)
 * @access  Analyst, Admin
 */
router.get('/trends', requireMinRole('analyst'), asyncHandler(getMonthlyTrends));

/**
 * @route   GET /api/dashboard/recent
 * @desc    Most recent N transactions (?limit=10)
 * @access  All authenticated roles
 */
router.get('/recent', asyncHandler(getRecentActivity));

/**
 * @route   GET /api/dashboard/weekly-trends
 * @desc    Last 12 weeks of income/expense aggregated by week
 * @access  Analyst, Admin
 */
router.get('/weekly-trends', requireMinRole('analyst'), asyncHandler(getWeeklyTrends));

module.exports = router;
