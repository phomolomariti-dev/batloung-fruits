// Creates the schema, loads reference/sample data and creates the two demo users.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const database = process.env.DB_NAME || 'batloung_fruits';
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('DB_NAME must contain only letters, numbers, and underscores');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', multipleStatements: true,
  });
  const dir = path.join(__dirname, '..', 'database');
  const applyDatabaseName = (file) => fs.readFileSync(path.join(dir, file), 'utf8').replace(/\bbatloung_fruits\b/g, database);
  await conn.query(applyDatabaseName('schema.sql'));
  await conn.query(applyDatabaseName('seed.sql'));
  console.log(`Database "${database}" ready. Demo logins:\n  admin@batloung.co.ls / Admin@123\n  sales@batloung.co.ls / Sales@123`);
  await conn.end();
})().catch((e) => { console.error(e); process.exit(1); });
