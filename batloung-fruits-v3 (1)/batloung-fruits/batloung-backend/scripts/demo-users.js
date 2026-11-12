// Re-creates (or resets the password of) the two demo users WITHOUT touching any other data.
// Use it when "Incorrect email or password" appears for the demo logins:  npm run db:demo-users
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'batloung_fruits',
  });
  for (const [name, email, pw, role] of [
    ['Admin User', 'admin@batloung.co.ls', 'Admin@123', 'administrator'],
    ['Thabo Nkosi (Sales)', 'sales@batloung.co.ls', 'Sales@123', 'sales'],
  ]) {
    await conn.query(
      'INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?,?,?,?,1) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), is_active = 1',
      [name, email, await bcrypt.hash(pw, 10), role]);
  }
  console.log('Demo users ready:\n  admin@batloung.co.ls / Admin@123\n  sales@batloung.co.ls / Sales@123');
  await conn.end();
})().catch((e) => { console.error('Could not reach the database. Check DB_* in .env:', e.message); process.exit(1); });
