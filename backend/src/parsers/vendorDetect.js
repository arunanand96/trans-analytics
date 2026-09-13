// Keywords to look for in the extracted text to identify which vendor a
// PDF came from — checked in order, first match wins. Add a line here
// whenever a new text-based vendor template is added to vendorTemplates.js.
const VENDOR_SIGNATURES = [
  { name: 'Ashoka Travel & Logistics', pattern: /ashoka\s*travel/i },
  { name: 'Golden Travel Agencies', pattern: /golden\s*travel/i },
];

/**
 * Identifies which vendor a PDF belongs to purely from its extracted text
 * — no manual selection needed. Returns null if no known signature matches,
 * which means either a brand-new vendor (needs a template added) or a
 * layout variation that doesn't contain the expected name string.
 *
 * For image-based PDFs (no text layer), this can't run — vendor identity
 * for those either waits on the AI vision module or gets set manually by
 * staff during review.
 */
function detectVendor(text) {
  for (const { name, pattern } of VENDOR_SIGNATURES) {
    if (pattern.test(text)) return name;
  }
  return null;
}

module.exports = { detectVendor, VENDOR_SIGNATURES };
