// OAuth provider definitions (authorization-code flow) for Google, GitHub, Apple and Facebook.
// Every provider is optional: it is "enabled" only when its keys are present in the environment.
// Settings are read at call time so .env changes and tests can take effect.
const jwt = require('jsonwebtoken');

const env = (k) => process.env[k] || '';
const mockBase = () => env('OAUTH_MOCK_BASE'); // TESTS ONLY: point every provider at a local fake server

const apiBase = () => (env('API_PUBLIC_URL') || `http://localhost:${env('PORT') || 5001}`).replace(/\/$/, '');
const redirectUri = (name) => `${apiBase()}/api/auth/oauth/${name}/callback`;

async function http(url, { method = 'GET', headers = {}, form } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...headers },
    body: form ? new URLSearchParams(form).toString() : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${new URL(url).host} -> ${res.status} ${data.error_description || data.error || ''}`.trim());
  return data;
}

const url = (name, real, path) => (mockBase() ? `${mockBase()}/${name}/${path}` : real);

const providers = {
  google: {
    label: 'Google',
    enabled: () => !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET')),
    authUrl: (state) => `${url('google', 'https://accounts.google.com/o/oauth2/v2/auth', 'authorize')}?${new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: redirectUri('google'), response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account',
    })}`,
    async profile(code) {
      const t = await http(url('google', 'https://oauth2.googleapis.com/token', 'token'), {
        method: 'POST',
        form: { code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: redirectUri('google'), grant_type: 'authorization_code' },
      });
      const u = await http(url('google', 'https://openidconnect.googleapis.com/v1/userinfo', 'userinfo'), { headers: { Authorization: `Bearer ${t.access_token}` } });
      return { id: String(u.sub), email: u.email, emailVerified: u.email_verified === true || u.email_verified === 'true', name: u.name, avatar: u.picture };
    },
  },

  github: {
    label: 'GitHub',
    enabled: () => !!(env('GITHUB_CLIENT_ID') && env('GITHUB_CLIENT_SECRET')),
    authUrl: (state) => `${url('github', 'https://github.com/login/oauth/authorize', 'authorize')}?${new URLSearchParams({
      client_id: env('GITHUB_CLIENT_ID'), redirect_uri: redirectUri('github'), scope: 'read:user user:email', state,
    })}`,
    async profile(code) {
      const t = await http(url('github', 'https://github.com/login/oauth/access_token', 'token'), {
        method: 'POST',
        form: { code, client_id: env('GITHUB_CLIENT_ID'), client_secret: env('GITHUB_CLIENT_SECRET'), redirect_uri: redirectUri('github') },
      });
      if (!t.access_token) throw new Error('GitHub returned no access token');
      const h = { Authorization: `Bearer ${t.access_token}`, 'User-Agent': 'batloung-fruits' };
      const u = await http(url('github', 'https://api.github.com/user', 'user'), { headers: h });
      // The public profile email may be empty; the verified primary email comes from /user/emails
      const emails = await http(url('github', 'https://api.github.com/user/emails', 'emails'), { headers: h }).catch(() => []);
      const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) : null;
      return { id: String(u.id), email: primary?.email, emailVerified: !!primary, name: u.name || u.login, avatar: u.avatar_url };
    },
  },

  facebook: {
    label: 'Facebook',
    enabled: () => !!(env('FACEBOOK_CLIENT_ID') && env('FACEBOOK_CLIENT_SECRET')),
    authUrl: (state) => `${url('facebook', 'https://www.facebook.com/v19.0/dialog/oauth', 'authorize')}?${new URLSearchParams({
      client_id: env('FACEBOOK_CLIENT_ID'), redirect_uri: redirectUri('facebook'), scope: 'email,public_profile', state, response_type: 'code',
    })}`,
    async profile(code) {
      const t = await http(`${url('facebook', 'https://graph.facebook.com/v19.0/oauth/access_token', 'token')}?${new URLSearchParams({
        client_id: env('FACEBOOK_CLIENT_ID'), client_secret: env('FACEBOOK_CLIENT_SECRET'), redirect_uri: redirectUri('facebook'), code,
      })}`);
      const u = await http(`${url('facebook', 'https://graph.facebook.com/me', 'me')}?${new URLSearchParams({ fields: 'id,name,email,picture', access_token: t.access_token })}`);
      // Facebook only returns an email address it has confirmed
      return { id: String(u.id), email: u.email, emailVerified: !!u.email, name: u.name, avatar: u.picture?.data?.url };
    },
  },

  apple: {
    label: 'Apple',
    enabled: () => !!(env('APPLE_CLIENT_ID') && env('APPLE_TEAM_ID') && env('APPLE_KEY_ID') && env('APPLE_PRIVATE_KEY')),
    authUrl: (state) => `${url('apple', 'https://appleid.apple.com/auth/authorize', 'authorize')}?${new URLSearchParams({
      client_id: env('APPLE_CLIENT_ID'), redirect_uri: redirectUri('apple'), response_type: 'code', response_mode: 'form_post', scope: 'name email', state,
    })}`,
    // Apple's "client secret" is a short-lived JWT signed with your private key
    clientSecret() {
      return jwt.sign({}, env('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n'), {
        algorithm: 'ES256', expiresIn: '5m', audience: 'https://appleid.apple.com', issuer: env('APPLE_TEAM_ID'), subject: env('APPLE_CLIENT_ID'), keyid: env('APPLE_KEY_ID'),
      });
    },
    async profile(code, extra = {}) {
      const secret = mockBase() ? 'mock-secret' : this.clientSecret();
      const t = await http(url('apple', 'https://appleid.apple.com/auth/token', 'token'), {
        method: 'POST',
        form: { code, client_id: env('APPLE_CLIENT_ID'), client_secret: secret, redirect_uri: redirectUri('apple'), grant_type: 'authorization_code' },
      });
      // The id_token comes straight from Apple's token endpoint over TLS, so decoding it is sufficient (OIDC Core 3.1.3.7)
      const claims = jwt.decode(t.id_token) || {};
      if (claims.aud !== env('APPLE_CLIENT_ID') || claims.iss !== 'https://appleid.apple.com') throw new Error('Apple id_token has the wrong audience or issuer');
      // Apple only sends the person's name on the very first sign-in, as a separate `user` form field
      let name;
      try { const n = JSON.parse(extra.user || '{}').name || {}; name = [n.firstName, n.lastName].filter(Boolean).join(' '); } catch { /* ignore */ }
      return { id: String(claims.sub), email: claims.email, emailVerified: claims.email_verified === true || claims.email_verified === 'true', name, avatar: null };
    },
  },
};

const names = Object.keys(providers);
const status = () => Object.fromEntries(names.map((n) => [n, providers[n].enabled()]));

module.exports = { providers, names, status, redirectUri };
