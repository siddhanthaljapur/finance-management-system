'use strict';

const { createError } = require('../utils/errors');

/**
 * Role hierarchy — higher index = greater authority.
 * This allows ">= analyst" style checks.
 */
const ROLE_HIERARCHY = ['viewer', 'analyst', 'admin'];

/**
 * Returns middleware that allows access only to users with one of the
 * specified roles.
 *
 * Usage:
 *   router.post('/records', authenticate, requireRole('analyst', 'admin'), handler)
 *
 * @param {...string} roles  Allowed role names
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(
        createError.forbidden(
          `This action requires one of the following roles: ${roles.join(', ')}.`
        )
      );
    }
    next();
  };
}

/**
 * Returns middleware that allows access only to users whose role rank
 * is >= the specified minimum role.
 *
 * Usage:
 *   router.get('/trends', authenticate, requireMinRole('analyst'), handler)
 *
 * @param {string} minRole  Minimum required role
 */
function requireMinRole(minRole) {
  const minIndex = ROLE_HIERARCHY.indexOf(minRole);
  if (minIndex === -1) {
    throw new Error(`Invalid role in requireMinRole: "${minRole}"`);
  }

  return (req, res, next) => {
    if (!req.user) {
      return next(createError.unauthorized());
    }
    const userIndex = ROLE_HIERARCHY.indexOf(req.user.role);
    if (userIndex < minIndex) {
      return next(
        createError.forbidden(
          `This action requires at least the "${minRole}" role.`
        )
      );
    }
    next();
  };
}

module.exports = { requireRole, requireMinRole };
