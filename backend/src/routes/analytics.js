const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Demo-honest scope: counts and breakdowns that are actually supportable
// with current data volume. Route/boarding pattern analysis and 6-month
// trend views need more real data before they'd say anything meaningful —
// building those out is a later pass.
router.get('/summary', requireAuth, async (req, res) => {
  const [totals, vendorBreakdown, statusBreakdown] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM trip_batches) AS total_batches,
        (SELECT COUNT(*) FROM passengers) AS total_passengers
    `),
    pool.query(`
      SELECT v.name AS vendor_name, COUNT(tb.id) AS batch_count
      FROM trip_batches tb
      JOIN vendors v ON v.id = tb.vendor_id
      GROUP BY v.name
      ORDER BY batch_count DESC
    `),
    pool.query(`
      SELECT review_status, COUNT(*) AS count
      FROM trip_batches
      GROUP BY review_status
    `),
  ]);

  res.json({
    totalBatches: Number(totals.rows[0].total_batches),
    totalPassengers: Number(totals.rows[0].total_passengers),
    byVendor: vendorBreakdown.rows,
    byReviewStatus: statusBreakdown.rows,
  });
});

module.exports = router;
