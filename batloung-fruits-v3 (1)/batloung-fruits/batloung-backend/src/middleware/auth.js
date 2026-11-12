const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { HttpError } = require('../utils/errors');

// Verifies the token, then loads the user so that role changes and deactivation take effect on the very next
// request instead of waiting for the token to expire. The role always comes from the database, never the token.
async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'Authentication required'));
  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
  try {
    const [[user]] = await pool.query('SELECT id, full_name, email, role, is_active FROM users WHERE id = ?', [claims.id]);
    if (!user || !user.is_active) return next(new HttpError(401, 'This account is no longer active'));
    req.user = { id: user.id, role: user.role, name: user.full_name, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

/** RBAC: allow only the listed roles */
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to perform this action'));
  next();
};

module.exports = { authenticate, authorize };
