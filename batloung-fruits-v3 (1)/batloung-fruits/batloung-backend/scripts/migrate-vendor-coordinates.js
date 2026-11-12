require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const database = process.env.DB_NAME || 'batloung_fruits';
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('DB_NAME must contain only letters, numbers, and underscores');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
  });

  try {
    const [columns] = await conn.query('SHOW COLUMNS FROM street_vendors');
    const existing = new Set(columns.map((column) => column.Field));
    if (!existing.has('latitude')) {
      await conn.query('ALTER TABLE street_vendors ADD COLUMN latitude DECIMAL(10,7) NULL');
    }
    if (!existing.has('longitude')) {
      await conn.query('ALTER TABLE street_vendors ADD COLUMN longitude DECIMAL(10,7) NULL');
    }
    console.log(`Vendor coordinate columns are ready in "${database}".`);
  } finally {
    await conn.end();
  }
})().catch((error) => {
  console.error('Could not migrate vendor coordinates:', error);
  process.exitCode = 1;
});
