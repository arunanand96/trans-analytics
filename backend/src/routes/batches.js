const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// List batches, optionally filtered by review_status or extraction_method.
// Frontend uses this to build both the "review queue" and the
// "modules pending AI" list from the same endpoint.
router.get('/', requireAuth, async (req, res) => {
  const { review_status, extraction_method } = req.query;
  const conditions = [];
  const values = [];

  if (review_status) {
    values.push(review_status);
    conditions.push(`tb.review_status = $${values.length}`);
  }
  if (extraction_method) {
    values.push(extraction_method);
    conditions.push(`tb.extraction_method = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT tb.id, tb.original_filename, tb.extraction_method, tb.review_status,
            tb.confidence_score, tb.travel_date, tb.vehicle_reg_number,
            v.name AS vendor_name, tb.uploaded_at
     FROM trip_batches tb
     JOIN vendors v ON v.id = tb.vendor_id
     ${where}
     ORDER BY tb.uploaded_at DESC
     LIMIT 200`,
    values
  );

  res.json(rows);
});

// Staff approves/corrects a batch sitting in the review queue.
router.patch('/:id/approve', requireAuth, requireRole('admin', 'analyst'), async (req, res) => {
  await pool.query(
    `UPDATE trip_batches SET review_status = 'approved' WHERE id = $1`,
    [req.params.id]
  );
  await pool.query(
    `UPDATE passengers SET source_reliability = 'high' WHERE trip_batch_id = $1`,
    [req.params.id]
  );
  res.json({ status: 'approved' });
});

// Example analytics query: frequent co-travellers for a given mobile number.
// Finds other passengers who have shared a trip_batch with this person
// more than once — a starting point, refine the "same trip" definition
// (same route + close departure time) once real data volume exists.
router.get('/co-travellers/:mobile', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p2.name, p2.mobile, COUNT(*) AS shared_trips
     FROM passengers p1
     JOIN passengers p2
       ON p1.trip_batch_id = p2.trip_batch_id AND p1.mobile != p2.mobile
     WHERE p1.mobile = $1
     GROUP BY p2.name, p2.mobile
     HAVING COUNT(*) > 1
     ORDER BY shared_trips DESC`,
    [req.params.mobile]
  );
  res.json(rows);
});

module.exports = router;
