// Run once after migrating: node src/config/seedAdmin.js admin@example.com yourpassword
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

async function seed() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: node src/config/seedAdmin.js <email> <password>');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2`,
    [email, hash]
  );

  console.log(`✅ Admin user ready: ${email}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Failed to seed admin:', err.message);
  process.exit(1);
});
