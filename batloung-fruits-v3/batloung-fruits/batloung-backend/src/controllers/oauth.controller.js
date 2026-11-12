const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, withTransaction } = require('../config/db');
const { providers, names, status } = require('../config/oauth');

const clientUrl = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
const secure = () => (process.env.API_PUBLIC_URL || '').startsWith('https://');
const COOKIE = 'bf_oauth';

// Errors are sent back to the sign-in page as ?error=<code>, which the page turns into a message
const fail = (res, code, provider) => res.redirect(`${clientUrl()}/login?${new URLSearchParams({ error: code, ...(provider ? { provider } : {}) })}`);

const readCookie = (req, name) => {
  const m = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
};
// Apple posts the callback cross-site, so its cookie needs SameSite=None (which needs https). Everyone else uses Lax.
const setNonce = (res, nonce) => res.append('Set-Cookie', `${COOKIE}=${nonce}; Max-Age=600; Path=/api/auth/oauth; HttpOnly; ${secure() ? 'Secure; SameSite=None' : 'SameSite=Lax'}`);
const clearNonce = (res) => res.append('Set-Cookie', `${COOKIE}=; Max-Age=0; Path=/api/auth/oauth; HttpOnly; ${secure() ? 'Secure; SameSite=None' : 'SameSite=Lax'}`);

// GET /api/auth/providers - which social buttons are switched on
exports.providers = (_req, res) => res.json(status());

// GET /api/auth/oauth/:provider/start?terms=1&v=<terms version>
exports.start = (req, res) => {
  const name = req.params.provider;
  const p = providers[name];
  if (!p) return fail(res, 'unknown_provider');
  if (!p.enabled()) return fail(res, 'provider_not_configured', name);
  // The Terms must be accepted before leaving for the provider, and the server enforces it (not just the page)
  if (req.query.terms !== '1') return fail(res, 'terms_required', name);

  const nonce = crypto.randomBytes(16).toString('hex');
  const version = String(req.query.v || '').slice(0, 20) || null;
  const state = jwt.sign({ n: nonce, p: name, v: version }, process.env.JWT_SECRET, { expiresIn: '10m' });
  setNonce(res, nonce);
  res.redirect(p.authUrl(state));
};

async function resolveUser(name, profile) {
  return withTransaction(async (conn) => {
    const [[ident]] = await conn.query(
      'SELECT u.* FROM user_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = ? AND i.provider_user_id = ?', [name, profile.id]);
    if (ident) return ident;

    // First time with this provider: link to an existing account that owns the same VERIFIED email
    const [[byEmail]] = await conn.query('SELECT * FROM users WHERE email = ?', [profile.email]);
    let user = byEmail;
    if (!user) {
      if (process.env.ALLOW_SIGNUP === 'false') return null; // sign-up switched off: an administrator must create the account first
      const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10); // unusable password
      const [r] = await conn.query(
        "INSERT INTO users (full_name, email, password_hash, role, avatar_url) VALUES (?,?,?,'sales',?)", // social sign-up is never an administrator
        [(profile.name || profile.email.split('@')[0]).slice(0, 100), profile.email, hash, profile.avatar || null]);
      [[user]] = await conn.query('SELECT * FROM users WHERE id = ?', [r.insertId]);
    }
    await conn.query('INSERT INTO user_identities (user_id, provider, provider_user_id) VALUES (?,?,?)', [user.id, name, profile.id]);
    if (profile.avatar && !user.avatar_url) await conn.query('UPDATE users SET avatar_url = ? WHERE id = ?', [profile.avatar, user.id]);
    return user;
  });
}

// GET (Google, GitHub, Facebook) and POST (Apple form_post) /api/auth/oauth/:provider/callback
exports.callback = async (req, res) => {
  const name = req.params.provider;
  const p = providers[name];
  if (!p || !p.enabled()) return fail(res, 'provider_not_configured', name);
  const src = { ...req.query, ...(req.body || {}) };
  clearNonce(res);

  if (src.error) return fail(res, 'access_denied', name); // the person pressed Cancel at the provider
  let state;
  try { state = jwt.verify(String(src.state || ''), process.env.JWT_SECRET); } catch { return fail(res, 'invalid_state', name); }
  const nonce = readCookie(req, COOKIE);
  if (state.p !== name || !nonce || nonce !== state.n) return fail(res, 'invalid_state', name);
  if (!src.code) return fail(res, 'oauth_failed', name);

  try {
    const profile = await p.profile(String(src.code), src);
    if (!profile.id) return fail(res, 'oauth_failed', name);
    if (!profile.email || !profile.emailVerified) return fail(res, 'email_unverified', name);
    profile.email = String(profile.email).toLowerCase();

    const user = await resolveUser(name, profile);
    if (!user) return fail(res, 'no_account', name);
    if (!user.is_active) return fail(res, 'account_disabled', name);

    await pool.query('UPDATE users SET terms_accepted_at = NOW(), terms_version = COALESCE(?, terms_version) WHERE id = ?', [state.v, user.id]);
    const payload = { id: user.id, role: user.role, name: user.full_name, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    // The token travels in the URL fragment, which browsers never send to any server or log
    res.redirect(`${clientUrl()}/auth/callback#token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error(`OAuth ${name} failed:`, err.message);
    fail(res, 'oauth_failed', name);
  }
};

exports.names = names;
