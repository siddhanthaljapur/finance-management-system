'use strict';

const db = require('../../config/db');
const { trendQuerySchema } = require('../../utils/validators');

/**
 * GET /api/dashboard/summary
 * Overall financial summary: total income, expenses, net balance.
 * All authenticated roles can access this.
 */
function getSummary(req, res) {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount
                           WHEN type = 'expense' THEN -amount END), 0)       AS net_balance,
         COUNT(*)                                                              AS total_records
       FROM records
       WHERE deleted_at IS NULL`
    )
    .get();

  res.status(200).json({
    status: 'success',
    data: { summary: row },
  });
}

/**
 * GET /api/dashboard/by-category
 * Breakdown of totals by category (income and expense separately).
 */
function getByCategory(req, res) {
  const rows = db
    .prepare(
      `SELECT
         category,
         type,
         COUNT(*)         AS count,
         SUM(amount)      AS total,
         AVG(amount)      AS average,
         MIN(amount)      AS minimum,
         MAX(amount)      AS maximum
       FROM records
       WHERE deleted_at IS NULL
       GROUP BY category, type
       ORDER BY total DESC`
    )
    .all();

  // Structure as { category: { income: {...}, expense: {...} } }
  const categoryMap = {};
  for (const row of rows) {
    if (!categoryMap[row.category]) {
      categoryMap[row.category] = { category: row.category };
    }
    categoryMap[row.category][row.type] = {
      count: row.count,
      total: row.total,
      average: parseFloat(row.average.toFixed(2)),
      min: row.minimum,
      max: row.maximum,
    };
  }

  res.status(200).json({
    status: 'success',
    data: {
      categories: Object.values(categoryMap),
      raw: rows,
    },
  });
}

/**
 * GET /api/dashboard/trends
 * Monthly income and expense totals for a given year (?year=2024).
 * Analyst and Admin only — requires deeper insight access.
 */
function getMonthlyTrends(req, res) {
  const { year } = trendQuerySchema.parse(req.query);

  const rows = db
    .prepare(
      `SELECT
         strftime('%m', date)                                                  AS month,
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount
                           WHEN type = 'expense' THEN -amount END), 0)       AS net
       FROM records
       WHERE deleted_at IS NULL
         AND strftime('%Y', date) = ?
       GROUP BY strftime('%m', date)
       ORDER BY month`
    )
    .all(String(year));

  // Fill in months with no data so the frontend always gets 12 data points
  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const fullYear = MONTHS.map((name, idx) => {
    const monthStr = String(idx + 1).padStart(2, '0');
    const found = rows.find((r) => r.month === monthStr);
    return {
      month: monthStr,
      month_name: name,
      income: found ? found.income : 0,
      expense: found ? found.expense : 0,
      net: found ? found.net : 0,
    };
  });

  res.status(200).json({
    status: 'success',
    data: { year, trends: fullYear },
  });
}

/**
 * GET /api/dashboard/recent
 * The N most recent transactions (?limit=10, default 10).
 */
function getRecentActivity(req, res) {
  const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const records = db
    .prepare(
      `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes, r.created_at,
              u.name AS creator_name
       FROM records r
       JOIN users u ON r.created_by = u.id
       WHERE r.deleted_at IS NULL
       ORDER BY r.date DESC, r.created_at DESC
       LIMIT ?`
    )
    .all(limitNum);

  res.status(200).json({
    status: 'success',
    data: { records },
  });
}

/**
 * GET /api/dashboard/weekly-trends
 * Last 12 weeks of income/expense aggregated by ISO week.
 */
function getWeeklyTrends(req, res) {
  const rows = db
    .prepare(
      `SELECT
         strftime('%Y-W%W', date)                                              AS week,
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount
                           WHEN type = 'expense' THEN -amount END), 0)       AS net
       FROM records
       WHERE deleted_at IS NULL
         AND date >= date('now', '-84 days')
       GROUP BY strftime('%Y-W%W', date)
       ORDER BY week`
    )
    .all();

  res.status(200).json({
    status: 'success',
    data: { weeks: rows },
  });
}

module.exports = {
  getSummary,
  getByCategory,
  getMonthlyTrends,
  getRecentActivity,
  getWeeklyTrends,
};
