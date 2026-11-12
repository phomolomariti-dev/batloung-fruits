// Tests the whole social sign-in flow for Google, GitHub, Facebook and Apple WITHOUT real provider keys.
// It starts a fake identity provider, then starts the API three times (providers on, auto-create on, providers off).
// Run after `npm run db:setup`:  node scripts/oauth-test.js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecretvalue1234567890';
require('dotenv').config();
const path = require('path');
const { spawn } = require('child_process');
const { createMock } = require('./mock-provider');
const { pool } = require('../src/config/db');

const MOCK = 5056;
const mock = createMock(MOCK);
const CLIENT = 'http://localhost:5173';
let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };

// ---- helpers ---------------------------------------------------------------------------------------------------
const spawnApi = async (port, extra = {}) => {
  const env = {
    ...process.env, PORT: String(port), API_PUBLIC_URL: `http://localhost:${port}`, CLIENT_ORIGIN: CLIENT, OAUTH_MOCK_BASE: `http://localhost:${MOCK}`,
    GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's', GITHUB_CLIENT_ID: 'gh', GITHUB_CLIENT_SECRET: 's', FACEBOOK_CLIENT_ID: 'fb', FACEBOOK_CLIENT_SECRET: 's',
    APPLE_CLIENT_ID: 'apple-client', APPLE_TEAM_ID: 't', APPLE_KEY_ID: 'k', APPLE_PRIVATE_KEY: 'unused-in-mock', ...extra,
  };
  const child = spawn('node', ['src/index.js'], { cwd: path.join(__dirname, '..'), env, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) return child; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`API on ${port} did not start`);
};
const get = (url, cookie) => fetch(url, { redirect: 'manual', headers: cookie ? { cookie } : {} });
const loc = (r) => r.headers.get('location') || '';
const errOf = (r) => new URL(loc(r)).searchParams.get('error');
const tokenOf = (r) => decodeURIComponent((loc(r).split('#token=')[1] || ''));

// Walks one sign-in: start -> provider -> callback. `as` picks which fake person signs in at the provider.
async function signIn(api, provider, as, { terms = '1', tamper } = {}) {
  const start = await get(`${api}/api/auth/oauth/${provider}/start?terms=${terms}&v=2026-10-01`);
  if (start.status !== 302 || !loc(start).startsWith(`http://localhost:${MOCK}`)) return { start };
  const cookie = (start.headers.getSetCookie()[0] || '').split(';')[0];
  const authz = new URL(loc(start));
  const state = tamper ? `${authz.searchParams.get('state')}x` : authz.searchParams.get('state');
  const cb = `${api}/api/auth/oauth/${provider}/callback`;
  if (provider === 'apple') {
    const r = await fetch(cb, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams({ code: as, state, user: JSON.stringify({ name: { firstName: 'Nomsa', lastName: 'Newbie' } }) }) });
    return { start, cb: r, cookie, state };
  }
  return { start, cb: await get(`${cb}?code=${as}&state=${encodeURIComponent(state)}`, cookie), cookie, state };
}

(async () => {
  await new Promise((r) => mock.listen(MOCK, r));
  const apis = [];
  try {
    const A = await spawnApi(5001, { ALLOW_SIGNUP: 'false' }); apis.push(A); const a = 'http://localhost:5001';
    const B = await spawnApi(5002, { ALLOW_SIGNUP: 'true' }); apis.push(B); const b = 'http://localhost:5002';
    const C = await spawnApi(5003, { GOOGLE_CLIENT_ID: '', GITHUB_CLIENT_ID: '', FACEBOOK_CLIENT_ID: '', APPLE_CLIENT_ID: '' }); apis.push(C); const c = 'http://localhost:5003';
    await pool.query("DELETE FROM users WHERE email = 'newbie@example.com'");

    // --- provider switches ---
    const on = await (await fetch(`${a}/api/auth/providers`)).json();
    ok('all four providers report enabled when keys are set', Object.values(on).length === 4 && Object.values(on).every(Boolean), JSON.stringify(on));
    const off = await (await fetch(`${c}/api/auth/providers`)).json();
    ok('providers report disabled when no keys are set', Object.values(off).every((v) => v === false), JSON.stringify(off));
    for (const p of ['google', 'github', 'apple', 'facebook']) {
      const r = await get(`${c}/api/auth/oauth/${p}/start?terms=1`);
      ok(`${p}: unconfigured provider redirects back with provider_not_configured`, r.status === 302 && errOf(r) === 'provider_not_configured');
    }
    ok('unknown provider -> unknown_provider', errOf(await get(`${a}/api/auth/oauth/myspace/start?terms=1`)) === 'unknown_provider');

    // --- terms gate ---
    for (const p of ['google', 'github', 'apple', 'facebook']) {
      const r = await get(`${a}/api/auth/oauth/${p}/start`);
      ok(`${p}: start without accepting terms is refused (terms_required)`, r.status === 302 && errOf(r) === 'terms_required');
    }

    // --- happy path for every provider (existing admin account, verified email) ---
    for (const p of ['google', 'github', 'facebook', 'apple']) {
      const s = await signIn(a, p, 'admin');
      const err = s.cb && loc(s.cb).includes('error=') ? errOf(s.cb) : '';
      ok(`${p}: full flow ends on ${CLIENT}/auth/callback with a token`, !!s.cb && loc(s.cb).startsWith(`${CLIENT}/auth/callback#token=`), `${s.cb && loc(s.cb)} ${err}`);
      const token = s.cb ? tokenOf(s.cb) : '';
      const me = token ? await (await fetch(`${a}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json() : {};
      ok(`${p}: token is valid and belongs to the right user`, me.user?.email === 'admin@batloung.co.ls' && me.user?.role === 'administrator', JSON.stringify(me));
      const [[row]] = await pool.query("SELECT COUNT(*) n FROM user_identities i JOIN users u ON u.id = i.user_id WHERE u.email = 'admin@batloung.co.ls' AND i.provider = ?", [p]);
      ok(`${p}: identity is linked in the database`, row.n === 1, String(row.n));
      const again = await signIn(a, p, 'admin');
      const [[row2]] = await pool.query("SELECT COUNT(*) n FROM user_identities i JOIN users u ON u.id = i.user_id WHERE u.email = 'admin@batloung.co.ls' AND i.provider = ?", [p]);
      ok(`${p}: signing in a second time reuses the identity`, loc(again.cb).includes('#token=') && row2.n === 1);
    }
    const [[u1]] = await pool.query("SELECT terms_version, terms_accepted_at FROM users WHERE email = 'admin@batloung.co.ls'");
    ok('terms acceptance (version + time) is recorded on sign-in', u1.terms_version === '2026-10-01' && !!u1.terms_accepted_at, JSON.stringify(u1));

    // --- security ---
    const bad = await signIn(a, 'google', 'admin', { tamper: true });
    ok('tampered state is rejected (invalid_state)', errOf(bad.cb) === 'invalid_state');
    const st = await get(`${a}/api/auth/oauth/google/start?terms=1`);
    const state = new URL(loc(st)).searchParams.get('state');
    const noCookie = await get(`${a}/api/auth/oauth/google/callback?code=admin&state=${encodeURIComponent(state)}`);
    ok('callback without the browser cookie is rejected (login CSRF)', errOf(noCookie) === 'invalid_state');
    const wrongProv = await get(`${a}/api/auth/oauth/github/callback?code=admin&state=${encodeURIComponent(state)}`, (st.headers.getSetCookie()[0] || '').split(';')[0]);
    ok('state issued for one provider cannot be used on another', errOf(wrongProv) === 'invalid_state');
    const denied = await get(`${a}/api/auth/oauth/google/callback?error=access_denied`);
    ok('pressing Cancel at the provider -> access_denied', errOf(denied) === 'access_denied');
    const unver = await signIn(a, 'google', 'unverified');
    ok('unverified provider email is refused (no account takeover)', errOf(unver.cb) === 'email_unverified');
    const stranger = await signIn(a, 'github', 'stranger');
    ok('unknown email with sign-up switched off -> no_account', errOf(stranger.cb) === 'no_account');
    const [[cnt]] = await pool.query("SELECT COUNT(*) n FROM users WHERE email = 'stranger@example.com'");
    ok('no user row is created when sign-up is switched off', cnt.n === 0);

    // --- auto-create (second API instance) ---
    const n1 = await signIn(b, 'google', 'newbie');
    const nt = n1.cb ? tokenOf(n1.cb) : '';
    const nme = nt ? await (await fetch(`${b}/api/auth/me`, { headers: { Authorization: `Bearer ${nt}` } })).json() : {};
    ok('sign-up on: a new person is signed in as Sales, never administrator', nme.user?.email === 'newbie@example.com' && nme.user?.role === 'sales', JSON.stringify(nme));
    const n2 = await signIn(b, 'apple', 'newbie');
    const [[nrow]] = await pool.query("SELECT COUNT(*) n, MIN(full_name) name FROM users WHERE email = 'newbie@example.com'");
    ok('sign-up on: second provider with the same email links to the same user', nrow.n === 1 && loc(n2.cb).includes('#token='), JSON.stringify(nrow));
    const nlogin = await fetch(`${b}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'newbie@example.com', password: '', accept_terms: true }) });
    ok('social-created account has no usable password', nlogin.status === 400 || nlogin.status === 401);

    // --- disabled account ---
    await pool.query("UPDATE users SET is_active = 0 WHERE email = 'sales@batloung.co.ls'");
    const dis = await signIn(a, 'google', 'sales');
    ok('deactivated account cannot sign in socially (account_disabled)', errOf(dis.cb) === 'account_disabled');
    await pool.query("UPDATE users SET is_active = 1 WHERE email = 'sales@batloung.co.ls'");
  } catch (e) {
    fail++; console.log('FAIL  test harness crashed:', e);
  } finally {
    apis.forEach((p) => p.kill());
    mock.close();
    await pool.query("DELETE FROM users WHERE email = 'newbie@example.com'");
    await pool.end();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
