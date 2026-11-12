const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { HttpError, badRequest, asyncHandler } = require('../utils/errors');
const { validateBody } = require('../utils/validate');

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = validateBody(req.body, {
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'string', required: true, label: 'Password', max: 100 },
  });
  // The Terms and Conditions must be accepted at every sign-in; the server enforces it, not just the form
  if (req.body.accept_terms !== true) throw new HttpError(403, 'You must accept the Terms and Conditions to sign in', { code: 'TERMS_REQUIRED' });
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
  const user = rows[0];
  // same message for unknown email and wrong password (avoids user enumeration)
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new HttpError(401, 'Invalid email or password');
  await pool.query('UPDATE users SET terms_accepted_at = NOW(), terms_version = COALESCE(?, terms_version) WHERE id = ?', [String(req.body.terms_version || '').slice(0, 20) || null, user.id]);
  const payload = { id: user.id, role: user.role, name: user.full_name, email: user.email };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  res.json({ token, user: payload });
});

exports.me = (req, res) => res.json({ user: req.user });

// ---- Self-service sign-up ----------------------------------------------------------------------------------------
// Anyone can create a Sales account. An Administrator account needs the access code from ADMIN_SIGNUP_CODE, because
// an administrator can change prices, stock, vendors and every user. With no code configured, administrator sign-up is off.
const DEFAULT_ADMIN_CODE = 'batloung-admin-2026'; // the value shipped in .env.example; refused when NODE_ENV=production
const signupEnabled = () => process.env.ALLOW_SIGNUP !== 'false';
function adminCode() {
  const c = process.env.ADMIN_SIGNUP_CODE || '';
  if (process.env.NODE_ENV === 'production' && c === DEFAULT_ADMIN_CODE) return '';
  return c;
}
const sameSecret = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());

// GET /api/auth/signup-options (public): lets the sign-up page show only what is actually available
exports.signupOptions = (_req, res) => res.json({ enabled: signupEnabled(), adminEnabled: signupEnabled() && !!adminCode() });

exports.register = asyncHandler(async (req, res) => {
  if (!signupEnabled()) throw new HttpError(403, 'Self-service sign-up is switched off. Ask an administrator to create your account.', { code: 'SIGNUP_DISABLED' });
  const d = validateBody(req.body, {
    full_name: { type: 'string', required: true, max: 100, label: 'Full name' },
    email: { type: 'email', required: true, max: 150, label: 'Email' },
    password: { type: 'string', required: true, max: 72, label: 'Password' },
    role: { type: 'enum', values: ['administrator', 'sales'], required: true, label: 'Account type' },
    admin_code: { type: 'string', max: 200, label: 'Administrator access code' },
  });
  const problems = {};
  if (d.full_name.length < 2) problems.full_name = 'Full name must be at least 2 characters';
  if (d.password.length < 8 || !/[A-Za-z]/.test(d.password) || !/[0-9]/.test(d.password)) problems.password = 'Password must be at least 8 characters and include a letter and a number';
  else if (Buffer.byteLength(d.password) > 72) problems.password = 'Password is too long (72 bytes at most)';
  if (Object.keys(problems).length) throw badRequest('Validation failed', problems);
  if (req.body.accept_terms !== true) throw new HttpError(403, 'You must accept the Terms and Conditions to create an account', { code: 'TERMS_REQUIRED' });

  if (d.role === 'administrator') {
    const code = adminCode();
    if (!code) throw new HttpError(403, 'Administrator sign-up is not enabled on this server. Create a Sales account and ask an administrator to promote it.', { code: 'ADMIN_SIGNUP_DISABLED' });
    if (!d.admin_code || !sameSecret(d.admin_code, code)) throw new HttpError(403, 'That administrator access code is not correct', { code: 'ADMIN_CODE_INVALID' });
  }

  const email = d.email.toLowerCase();
  const [[taken]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (taken) throw new HttpError(409, 'An account with this email already exists. Try signing in instead.', { code: 'EMAIL_TAKEN' });

  const hash = await bcrypt.hash(d.password, 10);
  const [r] = await pool.query(
    'INSERT INTO users (full_name, email, password_hash, role, terms_version, terms_accepted_at) VALUES (?,?,?,?,?,NOW())',
    [d.full_name, email, hash, d.role, String(req.body.terms_version || '').slice(0, 20) || null]);
  const payload = { id: r.insertId, role: d.role, name: d.full_name, email };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  res.status(201).json({ token, user: payload });
});
