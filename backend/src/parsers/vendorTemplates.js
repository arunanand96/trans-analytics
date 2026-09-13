/**
 * Vendor templates describe WHERE to find each field inside the raw text
 * that pdf-parse extracts. Since every vendor's PDF puts labels in slightly
 * different words/order, each vendor gets its own small regex map instead
 * of one fragile universal parser.
 *
 * HOW TO ADD A NEW TEXT-BASED VENDOR:
 * 1. Upload one sample PDF and log `rawText` (see routes/upload.js) to see
 *    exactly how pdf-parse renders it.
 * 2. Copy an existing template below, rename the key to the vendor name,
 *    and adjust the regexes to match that vendor's actual label wording.
 * 3. No other code changes needed — the same pipeline picks it up.
 *
 * This is intentionally simple regex matching, not a general NLP parser.
 * It's meant to be fast, free, and predictable for known layouts; anything
 * that doesn't match cleanly should fall through to review, not be guessed at.
 */

const GENERIC_FIELD_PATTERNS = {
  vehicleRegNumber: /(?:Vehicle\s*(?:Reg\.?|Registration)?\s*(?:No\.?|Number)?)\s*[:\-]?\s*([A-Z0-9\- ]{6,15})/i,
  driverName: /Driver(?:\s*Name)?\s*[:\-]?\s*([A-Za-z .]{3,40})/i,
  startLocation: /(?:From|Start(?:ing)? (?:Point|Location))\s*[:\-]?\s*([A-Za-z ,]{2,40})/i,
  endLocation: /(?:To|End(?:ing)? (?:Point|Location)|Destination)\s*[:\-]?\s*([A-Za-z ,]{2,40})/i,
  travelDate: /(?:Date|Travel\s*Date|Journey\s*Date)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
  totalBookedSeats: /(?:Total\s*)?Booked\s*Seats?\s*[:\-]?\s*(\d{1,3})/i,
  totalSeats: /Total\s*Seats?\s*[:\-]?\s*(\d{1,3})/i,
  vacantSeats: /Vacant\s*Seats?\s*[:\-]?\s*(\d{1,3})/i,
};

// Per-customer row pattern — assumes a table-like line per passenger.
// This is the piece MOST likely to need per-vendor tuning, since table
// column order/spacing varies a lot between PDF layouts.
const GENERIC_PASSENGER_ROW = new RegExp(
  [
    /(?<seatNo>[A-Z0-9]{1,4})\s+/, // seat number, e.g. "12" or "U3"
    /(?<pnr>[A-Z0-9]{5,12})\s+/, // PNR / booking reference
    /(?<name>[A-Za-z .]{2,40}?)\s+/, // passenger name
    /(?<age>\d{1,3})\s+/, // age
    /(?<gender>M|F|Male|Female|O|Other)\s+/i, // gender
    /(?<mobile>\d{10})\s+/, // mobile number (10-digit India format)
    /(?<boardingPoint>[A-Za-z ,]{2,40})/, // boarding point (rest of line)
  ]
    .map((r) => r.source)
    .join(''),
  'gim'
);

const VENDOR_TEMPLATES = {
  'Ashoka Travel & Logistics': {
    fields: GENERIC_FIELD_PATTERNS,
    passengerRow: GENERIC_PASSENGER_ROW,
  },
  'Golden Travel Agencies': {
    fields: {
      ...GENERIC_FIELD_PATTERNS,
      // Golden's sample PDF includes fare/revenue data per the handoff doc —
      // add a fare field once you confirm the exact label wording:
      fare: /Fare\s*[:\-]?\s*(?:Rs\.?|₹)?\s*(\d+(?:\.\d{1,2})?)/i,
    },
    passengerRow: GENERIC_PASSENGER_ROW,
  },
  // Kalpaka intentionally has NO template here — it has no text layer,
  // so it never reaches this file. It's routed to the Pass-2 (AI vision)
  // / manual-entry queue instead. See routes/upload.js.
};

module.exports = { VENDOR_TEMPLATES, GENERIC_FIELD_PATTERNS, GENERIC_PASSENGER_ROW };
