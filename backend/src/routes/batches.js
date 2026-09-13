const express = require('express');
const fs = require('fs');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { extractWithAI } = require('../parsers/aiExtract');

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

// Full detail for one batch — trip fields + passengers — used by the
// review queue's detail screen.
router.get('/:id', requireAuth, async (req, res) => {
  const batchRes = await pool.query(
    `SELECT tb.*, v.name AS vendor_name
     FROM trip_batches tb
     JOIN vendors v ON v.id = tb.vendor_id
     WHERE tb.id = $1`,
    [req.params.id]
  );
  if (!batchRes.rows[0]) return res.status(404).json({ error: 'Batch not found' });

  const passengersRes = await pool.query(
    `SELECT * FROM passengers WHERE trip_batch_id = $1 ORDER BY seat_no`,
    [req.params.id]
  );

  res.json({ ...batchRes.rows[0], passengers: passengersRes.rows });
});

// Streams the original uploaded PDF so the review screen can show it
// next to the extracted fields.
router.get('/:id/pdf', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT stored_path, original_filename FROM trip_batches WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Batch not found' });
  if (!fs.existsSync(rows[0].stored_path)) {
    return res.status(404).json({ error: 'Stored PDF file no longer exists on disk' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${rows[0].original_filename}"`);
  fs.createReadStream(rows[0].stored_path).pipe(res);
});

// Manual correction of trip-level fields — staff editing what the parser
// (regex or AI) got wrong before approving.
router.patch('/:id', requireAuth, requireRole('admin', 'analyst'), async (req, res) => {
  const fields = [
    'vehicle_reg_number', 'driver_name', 'start_location', 'end_location',
    'travel_date', 'total_booked_seats', 'total_seats', 'vacant_seats',
  ];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      values.push(req.body[f] === '' ? null : req.body[f]);
      updates.push(`${f} = $${values.length}`);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.id);
  await pool.query(
    `UPDATE trip_batches SET ${updates.join(', ')} WHERE id = $${values.length}`,
    values
  );
  res.json({ status: 'updated' });
});

// Manual correction of a single passenger row.
router.patch('/:id/passengers/:passengerId', requireAuth, requireRole('admin', 'analyst'), async (req, res) => {
  const fields = ['seat_no', 'pnr', 'name', 'age', 'gender', 'mobile', 'boarding_point'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      values.push(req.body[f] === '' ? null : req.body[f]);
      updates.push(`${f} = $${values.length}`);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.passengerId, req.params.id);
  await pool.query(
    `UPDATE passengers SET ${updates.join(', ')} WHERE id = $${values.length - 1} AND trip_batch_id = $${values.length}`,
    values
  );
  res.json({ status: 'updated' });
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

// Debug helper: view the raw text pdf-parse extracted for a given batch,
// so parsing templates can be tuned against what a PDF actually contains
// instead of guessing. Remove or lock this down further before go-live.
router.get('/:id/raw-text', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT original_filename, raw_text FROM trip_batches WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Batch not found' });
  res.json(rows[0]);
});

// Manually triggered AI-assist re-extraction — called when staff click
// "Extract with AI" on a low-confidence batch in the review queue. Never
// runs automatically, so API cost only happens when someone chooses it.
router.post('/:id/extract-ai', requireAuth, requireRole('admin', 'analyst'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT raw_text FROM trip_batches WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Batch not found' });
    if (!rows[0].raw_text) {
      return res.status(400).json({ error: 'No extracted text available for this batch — cannot AI-assist an image-based PDF here (that goes through the vision pipeline instead).' });
    }

    const result = await extractWithAI(rows[0].raw_text);
    const trip = result.trip || {};
    const passengers = result.passengers || [];

    await client.query('BEGIN');

    await client.query(
      `UPDATE trip_batches SET
         extraction_method = 'text_ai',
         review_status = 'pending',
         confidence_score = 0.95,
         vehicle_reg_number = $1, driver_name = $2, start_location = $3, end_location = $4,
         travel_date = $5, total_booked_seats = $6, total_seats = $7, vacant_seats = $8
       WHERE id = $9`,
      [
        trip.vehicleRegNumber || null,
        trip.driverName || null,
        trip.startLocation || null,
        trip.endLocation || null,
        trip.travelDate || null,
        trip.totalBookedSeats || null,
        trip.totalSeats || null,
        trip.vacantSeats || null,
        req.params.id,
      ]
    );

    // Replace whatever the generic parser found with the AI's version —
    // still lands as 'needs_review' since a human should confirm AI output
    // before it counts as verified data.
    await client.query(`DELETE FROM passengers WHERE trip_batch_id = $1`, [req.params.id]);
    for (const p of passengers) {
      await client.query(
        `INSERT INTO passengers
           (trip_batch_id, seat_no, pnr, name, age, gender, mobile, boarding_point, source_reliability)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'needs_review')`,
        [req.params.id, p.seatNo, p.pnr, p.name, p.age, p.gender, p.mobile, p.boardingPoint]
      );
    }

    await client.query('COMMIT');

    res.json({
      status: 'ai_extracted',
      passengers_found: passengers.length,
      message: 'Re-extracted with AI. Still marked for human review before final approval.',
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'AI extraction failed', detail: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
