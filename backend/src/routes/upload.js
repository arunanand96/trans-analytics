const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { detectPdfType } = require('../parsers/detect');
const { detectVendor } = require('../parsers/vendorDetect');
const { parseGeneric } = require('../parsers/genericParser');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB cap per PDF
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are accepted'));
    cb(null, true);
  },
});

// A confidence below this threshold forces the record into the review queue
// even for text-based PDFs, on top of the automatic image->review rule.
const AUTO_APPROVE_THRESHOLD = 0.85;

router.post('/', requireAuth, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

  const client = await pool.connect();
  try {
    const buffer = fs.readFileSync(req.file.path);
    const detection = await detectPdfType(buffer);

    // No manual vendor selection — identify it from the PDF's own text.
    // Image-based PDFs have no text to detect from; vendor gets set to
    // "Unknown (image-based)" and resolved later by the AI vision module
    // or by staff during review.
    const detectedVendorName =
      detection.type === 'text' ? detectVendor(detection.text) : null;
    const vendorName = detectedVendorName || 'Unknown';

    // Find or create the vendor row
    const vendorRes = await client.query(
      `INSERT INTO vendors (name, pdf_type) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET pdf_type = EXCLUDED.pdf_type
       RETURNING id`,
      [vendorName, detection.type]
    );
    const vendorId = vendorRes.rows[0].id;

    if (detection.type === 'image') {
      // ── PASS 2 TERRITORY — not built yet ──────────────────────────
      // No text layer found (Kalpaka-style). Don't attempt anything
      // unreliable here (e.g. raw OCR) — just flag it clearly so staff
      // know this batch is waiting on the AI vision module and isn't
      // silently missing from the system.
      const batchRes = await client.query(
        `INSERT INTO trip_batches
           (vendor_id, original_filename, stored_path, extraction_method, review_status, raw_text)
         VALUES ($1, $2, $3, 'pending_ai', 'pending', $4)
         RETURNING id`,
        [vendorId, req.file.originalname, req.file.path, detection.text || '']
      );

      return res.status(202).json({
        status: 'awaiting_ai_module',
        message:
          'This PDF has no extractable text layer (image/vector-based). ' +
          'It has been saved and flagged — it will be processed once the AI vision module is enabled. ' +
          'No data was guessed or auto-entered.',
        batchId: batchRes.rows[0].id,
      });
    }

    // ── PASS 1 — text-based PDF, generic parser, no AI ────────────────
    // Runs on ANY vendor's text, known or brand-new — no per-vendor code
    // needed. Confidence score decides what happens next: high enough
    // auto-approves, otherwise it lands in the review queue where staff
    // can either hand-correct it or click "Extract with AI" to retry via
    // Haiku (see POST /api/batches/:id/extract-ai).
    const parsed = parseGeneric(detection.text);

    const reviewStatus = parsed.confidence >= AUTO_APPROVE_THRESHOLD ? 'approved' : 'pending';
    const sourceReliability = reviewStatus === 'approved' ? 'high' : 'needs_review';

    await client.query('BEGIN');

    const batchRes = await client.query(
      `INSERT INTO trip_batches
         (vendor_id, original_filename, stored_path, extraction_method, review_status, confidence_score,
          vehicle_reg_number, driver_name, start_location, end_location, travel_date,
          total_booked_seats, total_seats, vacant_seats, raw_text, uploaded_by)
       VALUES ($1,$2,$3,'text',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        vendorId,
        req.file.originalname,
        req.file.path,
        reviewStatus,
        parsed.confidence,
        parsed.trip.vehicleRegNumber,
        parsed.trip.driverName,
        parsed.trip.startLocation,
        parsed.trip.endLocation,
        parseFlexibleDate(parsed.trip.travelDate),
        toIntOrNull(parsed.trip.totalBookedSeats),
        toIntOrNull(parsed.trip.totalSeats),
        toIntOrNull(parsed.trip.vacantSeats),
        detection.text,
        req.user.sub,
      ]
    );
    const batchId = batchRes.rows[0].id;

    for (const p of parsed.passengers) {
      await client.query(
        `INSERT INTO passengers
           (trip_batch_id, seat_no, pnr, name, age, gender, mobile, boarding_point, source_reliability)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [batchId, p.seatNo, p.pnr, p.name, p.age, p.gender, p.mobile, p.boardingPoint, sourceReliability]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      status: 'processed',
      extraction_method: 'text',
      review_status: reviewStatus,
      confidence: parsed.confidence,
      detectedVendor: detectedVendorName,
      passengers_found: parsed.passengers.length,
      batchId,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Upload processing failed', detail: err.message });
  } finally {
    client.release();
  }
});

function toIntOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function parseFlexibleDate(v) {
  if (!v) return null;
  // Accepts DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY — adjust if a vendor uses MM/DD/YYYY
  const parts = v.split(/[\/\-.]/);
  if (parts.length !== 3) return null;
  let [d, m, y] = parts;
  if (y.length === 2) y = `20${y}`;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

module.exports = router;
