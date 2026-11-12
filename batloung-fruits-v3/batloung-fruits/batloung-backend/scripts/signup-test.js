// Tests account creation (Sales / Administrator) and user management. It starts its own API instances, so the normal API
// does not need to be running. Run after `npm run db:setup`:  node scripts/signup-test.js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecretvalue1234567890';
require('dotenv').config();
const path = require('path');
const { spawn } = require('child_process');
const { pool } = require('../src/config/db');

const CODE = 'test-code-123';
let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };

const spawnApi = async (port, extra = {}) => {
  const env = { ...process.env, PORT: String(port), ALLOW_SIGNUP: 'true', ADMIN_SIGNUP_CODE: CODE, ...extra };
  const child = spawn('node', ['src/index.js'], { cwd: path.join(__dirname, '..'), env, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) return child; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`API on ${port} did not start`);
};
const mk = (port) => async (method, p, token, body) => {
  const r = await fetch(`http://localhost:${port}/api${p}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const person = (n, extra = {}) => ({ full_name: `Test Person ${n}`, email: `p${n}@signup-test.example`, password: 'Passw0rdTest', role: 'sales', accept_terms: true, terms_version: 'test', ...extra });

(async () => {
  const procs = [];
  try {
    await pool.query("DELETE FROM users WHERE email LIKE '%@signup-test.example'");
    procs.push(await spawnApi(5011));
    procs.push(await spawnApi(5012, { ALLOW_SIGNUP: 'false' }));
    procs.push(await spawnApi(5013, { ADMIN_SIGNUP_CODE: '' }));
    procs.push(await spawnApi(5014, { NODE_ENV: 'production', ADMIN_SIGNUP_CODE: 'batloung-admin-2026' }));
    const A = mk(5011); const B = mk(5012); const C = mk(5013); const D = mk(5014);

    // ---- what the sign-up page is told ----
    ok('options: sign-up on + admin code set -> both available', JSON.stringify((await A('GET', '/auth/signup-options')).data) === '{"enabled":true,"adminEnabled":true}');
    ok('options: ALLOW_SIGNUP=false -> nothing available', JSON.stringify((await B('GET', '/auth/signup-options')).data) === '{"enabled":false,"adminEnabled":false}');
    ok('options: no admin code -> Sales only', JSON.stringify((await C('GET', '/auth/signup-options')).data) === '{"enabled":true,"adminEnabled":false}');
    ok('options: example code is refused in production', (await D('GET', '/auth/signup-options')).data.adminEnabled === false);

    // ---- Sales sign-up ----
    const s1 = await A('POST', '/auth/register', null, person(1));
    ok('Sales sign-up -> 201 with a token and role sales', s1.status === 201 && s1.data.user?.role === 'sales' && !!s1.data.token, JSON.stringify(s1.data));
    const me = await A('GET', '/auth/me', s1.data.token);
    ok('new Sales token works and says sales', me.status === 200 && me.data.user.role === 'sales');
    const login = await A('POST', '/auth/login', null, { email: 'p1@signup-test.example', password: 'Passw0rdTest', accept_terms: true });
    ok('the new account can sign in with email and password', login.status === 200 && login.data.user.role === 'sales', JSON.stringify(login.data));
    const [[row]] = await pool.query("SELECT password_hash, terms_version, terms_accepted_at FROM users WHERE email = 'p1@signup-test.example'");
    ok('password is stored hashed, never as typed', row.password_hash.startsWith('$2') && !row.password_hash.includes('Passw0rdTest'));
    ok('terms version and time are recorded at sign-up', row.terms_version === 'test' && !!row.terms_accepted_at);
    ok('Sales account cannot reach administrator data', (await A('GET', '/suppliers', s1.data.token)).status === 403 && (await A('GET', '/users', s1.data.token)).status === 403);
    const mixed = await A('POST', '/auth/register', null, person(2, { email: 'MixedCase2@Signup-Test.example' }));
    const [[mrow]] = await pool.query("SELECT email FROM users WHERE email = 'mixedcase2@signup-test.example'");
    ok('email is stored in lower case', mixed.status === 201 && mrow?.email === 'mixedcase2@signup-test.example');

    // ---- validation and abuse ----
    const dup = await A('POST', '/auth/register', null, person(1));
    ok('duplicate email -> 409 EMAIL_TAKEN', dup.status === 409 && dup.data.details?.code === 'EMAIL_TAKEN');
    ok('duplicate email check ignores letter case', (await A('POST', '/auth/register', null, person(9, { email: 'P1@SIGNUP-TEST.EXAMPLE' }))).status === 409);
    const noTerms = await A('POST', '/auth/register', null, person(3, { accept_terms: undefined }));
    const [[c3]] = await pool.query("SELECT COUNT(*) n FROM users WHERE email = 'p3@signup-test.example'");
    ok('no terms -> 403 TERMS_REQUIRED and nothing created', noTerms.status === 403 && noTerms.data.details?.code === 'TERMS_REQUIRED' && c3.n === 0);
    ok('accept_terms must be literally true', (await A('POST', '/auth/register', null, person(3, { accept_terms: 'true' }))).status === 403);
    for (const [label, body, field] of [
      ['password too short', { password: 'abc1' }, 'password'], ['password with no number', { password: 'onlyletters' }, 'password'],
      ['password with no letter', { password: '12345678' }, 'password'], ['password longer than 72 characters', { password: `a1${'x'.repeat(75)}` }, 'password'],
      ['invalid email', { email: 'nope' }, 'email'], ['name too short', { full_name: 'A' }, 'full_name'],
    ]) {
      const r = await A('POST', '/auth/register', null, person(4, body));
      ok(`validation: ${label} -> 400`, r.status === 400 && !!r.data.details?.[field], JSON.stringify(r.data));
    }
    ok('validation: unknown role -> 400', (await A('POST', '/auth/register', null, person(4, { role: 'superuser' }))).status === 400);
    ok('validation: missing role -> 400', (await A('POST', '/auth/register', null, person(4, { role: undefined }))).status === 400);
    const sneaky = await A('POST', '/auth/register', null, person(5, { is_active: 0, id: 1, is_admin: true, terms_version: 'x' }));
    ok('extra fields cannot change role or status', sneaky.status === 201 && sneaky.data.user.role === 'sales' && sneaky.data.user.id !== 1);

    // ---- Administrator sign-up needs the access code ----
    const noCode = await A('POST', '/auth/register', null, person(6, { role: 'administrator' }));
    ok('administrator without a code -> 403 ADMIN_CODE_INVALID', noCode.status === 403 && noCode.data.details?.code === 'ADMIN_CODE_INVALID');
    const wrong = await A('POST', '/auth/register', null, person(6, { role: 'administrator', admin_code: 'guess' }));
    ok('administrator with a wrong code -> 403', wrong.status === 403 && wrong.data.details?.code === 'ADMIN_CODE_INVALID');
    const [[c6]] = await pool.query("SELECT COUNT(*) n FROM users WHERE email = 'p6@signup-test.example'");
    ok('a refused administrator sign-up creates no account at all', c6.n === 0);
    ok('the code is not accepted for the Sales role path to escalate', (await A('POST', '/auth/register', null, person(7, { role: 'sales', admin_code: CODE }))).data.user?.role === 'sales');
    const adm = await A('POST', '/auth/register', null, person(8, { role: 'administrator', admin_code: CODE }));
    ok('administrator with the right code -> 201 role administrator', adm.status === 201 && adm.data.user.role === 'administrator', JSON.stringify(adm.data));
    ok('new administrator can use administrator endpoints', (await A('GET', '/suppliers', adm.data.token)).status === 200 && (await A('GET', '/users', adm.data.token)).status === 200);
    const none = await C('POST', '/auth/register', null, person(10, { role: 'administrator', admin_code: 'anything' }));
    ok('no code configured -> administrator sign-up refused (ADMIN_SIGNUP_DISABLED)', none.status === 403 && none.data.details?.code === 'ADMIN_SIGNUP_DISABLED');
    ok('no code configured -> Sales sign-up still works', (await C('POST', '/auth/register', null, person(10))).status === 201);
    const prod = await D('POST', '/auth/register', null, person(11, { role: 'administrator', admin_code: 'batloung-admin-2026' }));
    ok('production refuses the example code', prod.status === 403 && prod.data.details?.code === 'ADMIN_SIGNUP_DISABLED');
    const off = await B('POST', '/auth/register', null, person(12));
    ok('ALLOW_SIGNUP=false -> 403 SIGNUP_DISABLED', off.status === 403 && off.data.details?.code === 'SIGNUP_DISABLED');

    // ---- Users and access (administrator page) ----
    const list = await A('GET', '/users', adm.data.token);
    ok('administrator can list users; no password hash is exposed', list.status === 200 && list.data.length >= 5 && !JSON.stringify(list.data).includes('password_hash') && Array.isArray(list.data[0].providers));
    const target = list.data.find((u) => u.email === 'p1@signup-test.example');
    ok('Sales cannot change users (403)', (await A('PUT', `/users/${target.id}`, s1.data.token, { role: 'administrator' })).status === 403);
    const promo = await A('PUT', `/users/${target.id}`, adm.data.token, { role: 'administrator' });
    ok('administrator promotes a Sales user', promo.status === 200 && promo.data.role === 'administrator');
    ok('the promotion works immediately on their existing token', (await A('GET', '/suppliers', s1.data.token)).status === 200);
    await A('PUT', `/users/${target.id}`, adm.data.token, { role: 'sales' });
    ok('demotion works immediately on their existing token', (await A('GET', '/suppliers', s1.data.token)).status === 403);
    const off1 = await A('PUT', `/users/${target.id}`, adm.data.token, { is_active: false });
    ok('deactivated user is shut out at once (401)', off1.status === 200 && (await A('GET', '/auth/me', s1.data.token)).status === 401);
    ok('deactivated user cannot sign in again', (await A('POST', '/auth/login', null, { email: 'p1@signup-test.example', password: 'Passw0rdTest', accept_terms: true })).status === 401);
    await A('PUT', `/users/${target.id}`, adm.data.token, { is_active: true });
    ok('reactivated user can sign in', (await A('POST', '/auth/login', null, { email: 'p1@signup-test.example', password: 'Passw0rdTest', accept_terms: true })).status === 200);
    ok('an administrator cannot change themselves (409)', (await A('PUT', `/users/${adm.data.user.id}`, adm.data.token, { role: 'sales' })).status === 409);
    ok('invalid role -> 400', (await A('PUT', `/users/${target.id}`, adm.data.token, { role: 'god' })).status === 400);
    ok('empty change -> 400', (await A('PUT', `/users/${target.id}`, adm.data.token, {})).status === 400);
    ok('unknown user -> 404', (await A('PUT', '/users/999999', adm.data.token, { role: 'sales' })).status === 404);
  } catch (e) {
    fail++; console.log('FAIL  test harness crashed:', e);
  } finally {
    procs.forEach((p) => p.kill());
    await pool.query("DELETE FROM users WHERE email LIKE '%@signup-test.example'");
    await pool.end();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
