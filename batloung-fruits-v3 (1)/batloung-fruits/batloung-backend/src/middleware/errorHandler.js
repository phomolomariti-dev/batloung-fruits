const { HttpError } = require('../utils/errors');

const notFoundHandler = (req, _res, next) => next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// Translate MySQL errors into meaningful HTTP responses
function mapDbError(err) {
  switch (err.code) {
    case 'ER_DUP_ENTRY': return new HttpError(409, 'A record with the same unique value already exists');
    case 'ER_ROW_IS_REFERENCED_2': return new HttpError(409, 'This record is in use by other records and cannot be removed');
    case 'ER_NO_REFERENCED_ROW_2': return new HttpError(400, 'A referenced record does not exist');
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
    case 'ER_CONSTRAINT_FAILED': return new HttpError(400, 'A value violates a data integrity rule');
    default: return null;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.parse.failed') err = new HttpError(400, 'Malformed JSON body');
  const mapped = err.code && String(err.code).startsWith('ER_') ? mapDbError(err) : null;
  const e = mapped || err;
  const status = e instanceof HttpError ? e.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : e.message,
    ...(e.details ? { details: e.details } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
