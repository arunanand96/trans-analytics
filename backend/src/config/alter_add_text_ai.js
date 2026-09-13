// Run once against an already-existing database (that already ran the
// original schema.sql) to add 'text_ai' as an allowed extraction_method.
// Usage: node src/config/alter_add_text_ai.js
require('dotenv').config();
const pool = require('../db');

async function run() {
  console.log('Updating extraction_method constraint...');
  await pool.query(`
    ALTER TABLE trip_batches DROP CONSTRAINT trip_batches_extraction_method_check;
    ALTER TABLE trip_batches ADD CONSTRAINT trip_batches_extraction_method_check
      CHECK (extraction_method IN ('text', 'text_ai', 'vision', 'manual', 'pending_ai'));
  `);
  console.log('✅ Constraint updated.');
  await pool.end();
}

run().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
