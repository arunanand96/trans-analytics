/**
 * Vendor-agnostic extraction. Instead of one regex set per vendor, this
 * looks for the field LABELS themselves anywhere in the text — "PNR",
 * "Vehicle Reg", "Mobile", etc. Most vendors describe the same booking
 * data with broadly similar wording, so this works on a brand-new
 * vendor's PDF on day one with zero code changes.
 *
 * Trade-off, stated plainly: this will be less accurate than a template
 * tuned to one exact layout, especially for the per-passenger table rows
 * where column order/spacing varies most between vendors. Low-confidence
 * results are expected and are exactly what the manual AI-assist button
 * (see aiExtract.js) and the review queue are for.
 */

const FIELD_PATTERNS = {
  vehicleRegNumber: /(?:Vehicle\s*(?:Reg\.?|Registration)?\s*(?:No\.?|Number)?)\s*[:\-]?\s*([A-Z0-9\- ]{6,15})/i,
  driverName: /Driver(?:\s*Name)?\s*[:\-]?\s*([A-Za-z .]{3,40})/i,
  startLocation: /(?:From|Start(?:ing)? (?:Point|Location))\s*[:\-]?\s*([A-Za-z ,]{2,40})/i,
  endLocation: /(?:To|End(?:ing)? (?:Point|Location)|Destination)\s*[:\-]?\s*([A-Za-z ,]{2,40})/i,
  travelDate: /(?:Date|Travel\s*Date|Journey\s*Date)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
  totalBookedSeats: /(?:Total\s*)?Booked\s*Seats?\s*[:\-]?\s*(\d{1,3})/i,
  totalSeats: /Total\s*Seats?\s*[:\-]?\s*(\d{1,3})/i,
  vacantSeats: /Vacant\s*Seats?\s*[:\-]?\s*(\d{1,3})/i,
};

// Per-passenger row pattern. This is the piece most likely to miss on an
// unfamiliar layout — that's expected and fine, it's what confidence
// scoring + the AI-assist button exist to catch.
const PASSENGER_ROW = new RegExp(
  [
    /(?<seatNo>[A-Z0-9]{1,4})\s+/,
    /(?<pnr>[A-Z0-9]{5,12})\s+/,
    /(?<name>[A-Za-z .]{2,40}?)\s+/,
    /(?<age>\d{1,3})\s+/,
    /(?<gender>M|F|Male|Female|O|Other)\s+/i,
    /(?<mobile>\d{10})\s+/,
    /(?<boardingPoint>[A-Za-z ,]{2,40})/,
  ]
    .map((r) => r.source)
    .join(''),
  'gim'
);

function parseGeneric(rawText) {
  const trip = {};
  let fieldsFound = 0;
  const fieldKeys = Object.keys(FIELD_PATTERNS);

  for (const key of fieldKeys) {
    const match = rawText.match(FIELD_PATTERNS[key]);
    if (match) {
      trip[key] = match[1].trim();
      fieldsFound += 1;
    } else {
      trip[key] = null;
    }
  }

  const passengers = [];
  let rowMatch;
  const rowRegex = new RegExp(PASSENGER_ROW.source, PASSENGER_ROW.flags);
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

  const fieldConfidence = fieldsFound / fieldKeys.length;
  const passengerConfidence = passengers.length > 0 ? 1 : 0;
  const confidence = Number((fieldConfidence * 0.5 + passengerConfidence * 0.5).toFixed(3));

  return { trip, passengers, confidence, fieldsFound, fieldsTotal: fieldKeys.length };
}

function normalizeGender(raw) {
  const g = raw.trim().toUpperCase();
  if (g.startsWith('M')) return 'M';
  if (g.startsWith('F')) return 'F';
  return 'O';
}

module.exports = { parseGeneric };
