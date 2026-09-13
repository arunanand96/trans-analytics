// Run with: npm run migrate
// Applies schema.sql to the database pointed to by DATABASE_URL in .env
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Check that it is linked in Railway/Render variables.');
  }
  console.log('Connecting with DATABASE_URL host:', new URL(process.env.DATABASE_URL).hostname);

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying schema.sql ...');
  await pool.query(sql);
  console.log('✅ Schema applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('❌ Migration failed. Full error details below:');
  console.error('Error object:', err);
  console.error('Message:', err && err.message);
  console.error('Code:', err && err.code);
  console.error('Stack:', err && err.stack);
  process.exit(1);
});
