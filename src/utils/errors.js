'use strict';

/**
 * Base application error class.
 * All thrown errors should use this or a subclass so our error handler
 * can distinguish operational errors (safe to send to client) from
 * programming errors (should not be exposed).
 */
class AppError extends Error {
  /**
   * @param {string} message   Human-readable description
   * @param {number} statusCode HTTP status code
   * @param {object} [details] Optional extra context (validation errors, etc.)
   */
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // flag: safe to send to client
    Error.captureStackTrace(this, this.constructor);
  }
}

// Convenience factories
const createError = {
  badRequest: (msg, details) => new AppError(msg, 400, details),
  unauthorized: (msg = 'Authentication required') => new AppError(msg, 401),
  forbidden: (msg = 'You do not have permission to perform this action') =>
    new AppError(msg, 403),
  notFound: (msg = 'Resource not found') => new AppError(msg, 404),
  conflict: (msg) => new AppError(msg, 409),
  internal: (msg = 'Internal server error') => new AppError(msg, 500),
};

/**
 * Central Express error-handling middleware.
 * Must be registered as the LAST middleware in app.js.
 */
function globalErrorHandler(err, req, res, next) {
  // Zod validation errors
  if (err.name === 'ZodError') {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details,
    });
  }

  // Operational AppErrors: safe to expose to client
  if (err.isOperational) {
    const body = {
      status: 'error',
      message: err.message,
    };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  // Programming / unknown errors: log and return generic message
  console.error('Unexpected error:', err);
  return res.status(500).json({
    status: 'error',
    message: err.message || 'An unexpected error occurred.',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    debug: err.stack, // FORCE debug info even in prod for this phase
  });
}

/**
 * Wraps an async route handler so errors propagate to Express error handler.
 * Usage:  router.get('/', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { AppError, createError, globalErrorHandler, asyncHandler };
