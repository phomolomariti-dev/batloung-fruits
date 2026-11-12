const { badRequest } = require('./errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9 ()-]{7,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rule format: { field: { type, required, max, min, values, label } }
 * types: string | email | phone | int | decimal | coordinate | date | enum | intArray
 * Returns a cleaned object or throws HttpError(400) listing every problem.
 */
function validateBody(body, rules, { partial = false } = {}) {
  const errors = {};
  const clean = {};
  body = body || {};
  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field;
    let v = body[field];
    const missing = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    if (missing) {
      if (rule.required && !partial) errors[field] = `${label} is required`;
      continue;
    }
    switch (rule.type) {
      case 'string':
      case 'email':
      case 'phone': {
        if (typeof v !== 'string') { errors[field] = `${label} must be text`; break; }
        v = v.trim();
        if (rule.type === 'email' && !EMAIL_RE.test(v)) errors[field] = `${label} must be a valid email address`;
        else if (rule.type === 'phone' && !PHONE_RE.test(v)) errors[field] = `${label} must be a valid telephone number`;
        else if (rule.max && v.length > rule.max) errors[field] = `${label} must be at most ${rule.max} characters`;
        else clean[field] = v;
        break;
      }
      case 'int': {
        const n = Number(v);
        if (!Number.isInteger(n)) errors[field] = `${label} must be a whole number`;
        else if (rule.min !== undefined && n < rule.min) errors[field] = `${label} must be at least ${rule.min}`;
        else clean[field] = n;
        break;
      }
      case 'decimal': {
        const n = Number(v);
        if (!Number.isFinite(n)) errors[field] = `${label} must be a number`;
        else if (rule.exclusiveMin !== undefined && n <= rule.exclusiveMin) errors[field] = `${label} must be greater than ${rule.exclusiveMin}`;
        else if (rule.min !== undefined && n < rule.min) errors[field] = `${label} must be at least ${rule.min}`;
        else clean[field] = Math.round(n * 100) / 100;
        break;
      }
      case 'coordinate': {
        const n = Number(v);
        if (!Number.isFinite(n) || n < rule.min || n > rule.max) errors[field] = `${label} must be between ${rule.min} and ${rule.max}`;
        else clean[field] = Math.round(n * 1e7) / 1e7;
        break;
      }
      case 'date': {
        if (typeof v !== 'string' || !DATE_RE.test(v) || Number.isNaN(Date.parse(v))) errors[field] = `${label} must be a valid date (YYYY-MM-DD)`;
        else clean[field] = v;
        break;
      }
      case 'enum': {
        if (!rule.values.includes(v)) errors[field] = `${label} must be one of: ${rule.values.join(', ')}`;
        else clean[field] = v;
        break;
      }
      case 'intArray': {
        if (!Array.isArray(v) || v.some((x) => !Number.isInteger(Number(x)))) errors[field] = `${label} must be a list of ids`;
        else clean[field] = [...new Set(v.map(Number))];
        break;
      }
      default:
        clean[field] = v;
    }
  }
  if (Object.keys(errors).length) throw badRequest('Validation failed', errors);
  return clean;
}

const parseId = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Invalid id');
  return n;
};

module.exports = { validateBody, parseId };
