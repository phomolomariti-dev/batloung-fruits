class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
const badRequest = (m, d) => new HttpError(400, m, d);
const notFound = (m = 'Resource not found') => new HttpError(404, m);
const conflict = (m) => new HttpError(409, m);

// Wrap async route handlers so rejected promises reach the error middleware
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, badRequest, notFound, conflict, asyncHandler };
