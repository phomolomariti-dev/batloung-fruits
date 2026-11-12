const app = require('./app');
const port = Number(process.env.PORT || 5001);
app.listen(port, () => {
  console.log(`Batloung Fruits API listening on http://localhost:${port}`);
  if (process.env.ALLOW_SIGNUP !== 'false' && process.env.ADMIN_SIGNUP_CODE === 'batloung-admin-2026') {
    console.warn('WARNING: ADMIN_SIGNUP_CODE is still the example value. Change it in .env before sharing this app.');
  }
});
