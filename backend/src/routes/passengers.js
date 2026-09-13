const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Search passengers by name, mobile, or PNR — the general
// cross-referencing view the client asked for. Every search is logged
// to audit_log since this touches PII.
router.get('/', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Provide a search term of at least 2 characters (q=...)' });
  }
  const term = `%${q.trim()}%`;

  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.age, p.gender, p.mobile, p.pnr, p.seat_no,
            p.boarding_point, p.dropping_point, p.source_reliability,
            tb.id AS trip_batch_id, tb.travel_date, tb.start_location, tb.end_location,
            v.name AS vendor_name
     FROM passengers p
     JOIN trip_batches tb ON tb.id = p.trip_batch_id
     JOIN vendors v ON v.id = tb.vendor_id
     WHERE p.name ILIKE $1 OR p.mobile ILIKE $1 OR p.pnr ILIKE $1
     ORDER BY tb.travel_date DESC NULLS LAST
     LIMIT 100`,
    [term]
  );

  await pool.query(
    `INSERT INTO audit_log (user_id, action, detail) VALUES ($1, 'search', $2)`,
    [req.user.sub, JSON.stringify({ query: q, results: rows.length })]
  );

  res.json(rows);
});

// Full travel history for one passenger by mobile number — the
// "individual travel logs" view from the project brief.
router.get('/travel-log/:mobile', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.name, p.age, p.gender, p.pnr, p.seat_no, p.boarding_point, p.dropping_point,
            p.source_reliability, tb.travel_date, tb.start_location, tb.end_location,
            tb.vehicle_reg_number, v.name AS vendor_name
     FROM passengers p
     JOIN trip_batches tb ON tb.id = p.trip_batch_id
     JOIN vendors v ON v.id = tb.vendor_id
     WHERE p.mobile = $1
     ORDER BY tb.travel_date DESC NULLS LAST`,
    [req.params.mobile]
  );

  await pool.query(
    `INSERT INTO audit_log (user_id, action, detail) VALUES ($1, 'view_travel_log', $2)`,
    [req.user.sub, JSON.stringify({ mobile: req.params.mobile })]
  );

  res.json(rows);
});

// Frequent co-travellers for a given mobile number — other passengers
// who have shared a trip_batch with this person more than once. A
// starting point; refine "same trip" (same route + close departure time)
// once real data volume exists.
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
