const pdfParse = require('pdf-parse');

/**
 * Runs a fast, cheap check on a PDF buffer to decide whether it has a
 * real, extractable text layer (like Ashoka / Golden) or is effectively
 * image/vector-based (like Kalpaka), where every "letter" is drawn as a
 * shape rather than a text object.
 *
 * This mirrors what pdfplumber's extract_text() would tell you in Python —
 * pdf-parse is the Node equivalent for this purpose.
 */
async function detectPdfType(buffer) {
  let data;
  try {
    data = await pdfParse(buffer);
  } catch (err) {
    // A parse-level crash almost always means a malformed or heavily
    // vector-based PDF. Treat it the same as "no usable text".
    return { type: 'image', text: '', reason: `pdf-parse threw: ${err.message}` };
  }

  const text = (data.text || '').trim();

  // Heuristic: a real per-page text layer for a booking manifest should
  // contain a reasonable density of alphanumeric characters. A PDF that's
  // pure vector/outline "text" typically returns an empty string, or a
  // tiny handful of stray characters picked up from page furniture.
  const meaningfulChars = text.replace(/\s/g, '').length;
  const isTextBased = meaningfulChars > 40; // tune this threshold against real samples

  return {
    type: isTextBased ? 'text' : 'image',
    text,
    numPages: data.numpages,
    meaningfulChars,
  };
}

module.exports = { detectPdfType };
