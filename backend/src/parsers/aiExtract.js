/**
 * Manual AI-assist extraction. Called only when a staff member clicks
 * "Extract with AI" on a low-confidence batch in the review queue —
 * never automatically — so cost stays predictable and visible.
 *
 * Requires ANTHROPIC_API_KEY set in the environment (Railway/Render
 * variables), billed to your own Anthropic account.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const EXTRACTION_PROMPT = `You will be given raw text extracted from a bus booking PDF manifest. Extract the trip and passenger details as JSON only — no preamble, no markdown fences, just the raw JSON object.

Return exactly this shape:
{
  "trip": {
    "vehicleRegNumber": string or null,
    "driverName": string or null,
    "startLocation": string or null,
    "endLocation": string or null,
    "travelDate": string or null (format: YYYY-MM-DD),
    "totalBookedSeats": number or null,
    "totalSeats": number or null,
    "vacantSeats": number or null
  },
  "passengers": [
    {
      "seatNo": string or null,
      "pnr": string or null,
      "name": string or null,
      "age": number or null,
      "gender": "M" or "F" or "O" or null,
      "mobile": string or null,
      "boardingPoint": string or null
    }
  ]
}

Raw extracted text:
---
`;

async function extractWithAI(rawText) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in the environment.');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: EXTRACTION_PROMPT + rawText }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text content in Anthropic API response');

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse AI response as JSON: ${err.message}. Raw response: ${cleaned.slice(0, 300)}`);
  }

  return parsed;
}

module.exports = { extractWithAI };
