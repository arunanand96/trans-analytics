const { Pool } = require('pg');

// Managed Postgres on Railway/Render requires SSL, but their certs aren't
// always in the standard trust chain — rejectUnauthorized:false accepts
// that without failing the connection. Skip SSL entirely for local dev.
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres error on idle client', err);
});

module.exports = pool;
