const { VENDOR_TEMPLATES } = require('./vendorTemplates');

/**
 * Parses raw extracted text into structured trip + passenger data using
 * a vendor's regex template. Returns a confidence score based on how many
 * of the expected fields were actually found — this feeds the review
 * queue logic (low confidence => forced human review).
 */
function parseWithTemplate(rawText, vendorName) {
  const template = VENDOR_TEMPLATES[vendorName];
  if (!template) {
    return {
      matched: false,
      reason: `No template registered for vendor "${vendorName}". Add one in vendorTemplates.js.`,
    };
  }

  const trip = {};
  let fieldsFound = 0;
  const fieldKeys = Object.keys(template.fields);

  for (const key of fieldKeys) {
    const match = rawText.match(template.fields[key]);
    if (match) {
      trip[key] = match[1].trim();
      fieldsFound += 1;
    } else {
      trip[key] = null;
    }
  }

  const passengers = [];
  let rowMatch;
  const rowRegex = new RegExp(template.passengerRow.source, template.passengerRow.flags);
  while ((rowMatch = rowRegex.exec(rawText)) !== null) {
    const g = rowMatch.groups || {};
    passengers.push({
      seatNo: g.seatNo || null,
      pnr: g.pnr || null,
      name: g.name ? g.name.trim() : null,
      age: g.age ? parseInt(g.age, 10) : null,
      gender: g.gender ? normalizeGender(g.gender) : null,
      mobile: g.mobile || null,
      boardingPoint: g.boardingPoint ? g.boardingPoint.trim() : null,
    });
  }

  // Confidence: weighted mix of "did trip-level fields resolve" and
  // "did we find at least one passenger row". Tune thresholds once you
  // see real match rates against actual sample PDFs.
  const fieldConfidence = fieldsFound / fieldKeys.length;
  const passengerConfidence = passengers.length > 0 ? 1 : 0;
  const confidence = Number((fieldConfidence * 0.5 + passengerConfidence * 0.5).toFixed(3));

  return {
    matched: true,
    trip,
    passengers,
    confidence,
    fieldsFound,
    fieldsTotal: fieldKeys.length,
  };
}

function normalizeGender(raw) {
  const g = raw.trim().toUpperCase();
  if (g.startsWith('M')) return 'M';
  if (g.startsWith('F')) return 'F';
  return 'O';
}

module.exports = { parseWithTemplate };
