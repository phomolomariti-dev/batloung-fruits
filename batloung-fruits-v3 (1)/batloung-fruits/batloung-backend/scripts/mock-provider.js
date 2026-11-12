// A fake Google / GitHub / Facebook / Apple, so the social buttons can be tried and tested WITHOUT real provider keys.
//   node scripts/mock-provider.js      then start the API with the env vars it prints
// Used by scripts/oauth-test.js. Never use this in production: it lets anyone "sign in" as anybody listed below.
const http = require('http');
const jwt = require('jsonwebtoken');

const PEOPLE = {
  admin: { email: 'admin@batloung.co.ls', verified: true, name: 'Admin User' },
  sales: { email: 'sales@batloung.co.ls', verified: true, name: 'Sales User' },
  newbie: { email: 'newbie@example.com', verified: true, name: 'Nomsa Newbie' },
  unverified: { email: 'admin@batloung.co.ls', verified: false, name: 'Imposter (unverified email)' },
  stranger: { email: 'stranger@example.com', verified: true, name: 'Stranger (no account)' },
};
const who = (code, provider) => ({ ...PEOPLE[code], id: `${provider}-${code}` });

function createMock(port) {
  return http.createServer((req, res) => {
    const u = new URL(req.url, `http://localhost:${port}`);
    const [, provider, action] = u.pathname.split('/');
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      const bearer = (req.headers.authorization || '').replace('Bearer ', '');
      const form = new URLSearchParams(body);
      const code = form.get('code') || u.searchParams.get('code');
      if (action === 'authorize') {
        // A tiny "choose who you are" page standing in for the provider's real consent screen
        const redirect = u.searchParams.get('redirect_uri');
        const state = u.searchParams.get('state');
        const rows = Object.entries(PEOPLE).map(([key, p]) => (provider === 'apple'
          ? `<form method="post" action="${redirect}"><input type="hidden" name="code" value="${key}"><input type="hidden" name="state" value="${state}"><button>${p.name} (${p.email})</button></form>`
          : `<p><a href="${redirect}?code=${key}&state=${encodeURIComponent(state)}">${p.name} (${p.email})</a></p>`)).join('');
        res.setHeader('Content-Type', 'text/html');
        return res.end(`<!doctype html><meta charset="utf-8"><title>Fake ${provider}</title><body style="font:16px system-ui;max-width:520px;margin:40px auto;padding:0 16px"><h2>Fake ${provider} sign-in (testing only)</h2><p>Pick who is signing in:</p>${rows}<p><a href="${redirect}?error=access_denied&state=${encodeURIComponent(state)}">Cancel</a></p>`);
      }
      if (action === 'token') {
        const p = who(code, provider);
        if (provider === 'apple') return json({ id_token: jwt.sign({ sub: p.id, email: p.email, email_verified: String(p.verified), aud: process.env.APPLE_CLIENT_ID || 'apple-client', iss: 'https://appleid.apple.com' }, 'x') });
        return json({ access_token: code });
      }
      if (provider === 'google' && action === 'userinfo') { const p = who(bearer, 'google'); return json({ sub: p.id, email: p.email, email_verified: p.verified, name: p.name, picture: 'https://img.example/g.png' }); }
      if (provider === 'github' && action === 'user') { const p = who(bearer, 'github'); return json({ id: p.id, login: 'octo', name: p.name, avatar_url: 'https://img.example/gh.png' }); }
      if (provider === 'github' && action === 'emails') { const p = who(bearer, 'github'); return json([{ email: 'noise@example.com', primary: false, verified: true }, { email: p.email, primary: true, verified: p.verified }]); }
      if (provider === 'facebook' && action === 'me') { const p = who(u.searchParams.get('access_token'), 'facebook'); return json({ id: p.id, name: p.name, ...(p.verified ? { email: p.email } : {}), picture: { data: { url: 'https://img.example/fb.png' } } }); }
      res.statusCode = 404; return json({ error: 'not found' });
    });
  });
}

module.exports = { createMock, PEOPLE };

if (require.main === module) {
  const port = Number(process.env.MOCK_PORT || 5056);
  createMock(port).listen(port, () => {
    console.log(`Fake identity provider on http://localhost:${port}\n\nStart the API like this (second terminal):\n`);
    console.log(`  OAUTH_MOCK_BASE=http://localhost:${port} GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x GITHUB_CLIENT_ID=x GITHUB_CLIENT_SECRET=x \\`);
    console.log('  FACEBOOK_CLIENT_ID=x FACEBOOK_CLIENT_SECRET=x APPLE_CLIENT_ID=apple-client APPLE_TEAM_ID=x APPLE_KEY_ID=x APPLE_PRIVATE_KEY=x npm start\n');
  });
}
