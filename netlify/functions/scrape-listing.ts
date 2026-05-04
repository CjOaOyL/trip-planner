import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are an extraction assistant. Given the HTML of a single booking/lodging/travel listing page, extract structured details and return them by calling the extract_booking_details tool exactly once.

Rules:
- Only extract values that are clearly stated on the page. If a field is not present or unclear, omit it.
- For prices, return the numeric value only (no currency symbol). Put the ISO currency code in "currency".
- "totalPrice" is the price for the entire stay if shown; "pricePerNight" is the per-night rate.
- "location" should be the most specific human-readable place shown (address, neighborhood, or city).
- For amenities, return a short list of the most notable ones (max ~10).
- For "imageUrl", return the primary listing photo if one is clearly visible.
- "title" should be the listing/property name (not the page title or site name).
`;

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_booking_details',
  description: 'Return structured details extracted from a booking/lodging listing page.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Listing title or property name' },
      totalPrice: { type: 'number', description: 'Total price for the full stay' },
      currency: { type: 'string', description: 'ISO currency code, e.g. USD, EUR' },
      pricePerNight: { type: 'number', description: 'Per-night rate' },
      location: { type: 'string', description: 'Address, neighborhood, or city' },
      beds: { type: 'number', description: 'Total number of beds' },
      bedrooms: { type: 'number' },
      bathrooms: { type: 'number' },
      guests: { type: 'number', description: 'Maximum guest capacity' },
      amenities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Notable amenities (e.g. WiFi, Pool, Kitchen)',
      },
      imageUrl: { type: 'string', description: 'Primary listing photo URL' },
      notes: { type: 'string', description: 'Other relevant details worth noting' },
    },
  },
};

const HTML_CHAR_LIMIT = 80_000;
const FETCH_TIMEOUT_MS = 15_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: 'ANTHROPIC_API_KEY not configured' };
  }

  let payload: { url?: unknown; category?: unknown };
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  const { url, category } = payload;
  if (typeof url !== 'string' || !url) {
    return { statusCode: 400, body: '"url" is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { statusCode: 400, body: 'Invalid URL' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { statusCode: 400, body: 'URL must be http or https' };
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; TripPlannerBot/1.0; +https://tripplanner.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) {
      return { statusCode: 502, body: `Upstream returned ${res.status}` };
    }
    html = await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { statusCode: 502, body: `Fetch failed: ${message}` };
  }

  const trimmed = stripHtml(html).slice(0, HTML_CHAR_LIMIT);
  const truncated = html.length > HTML_CHAR_LIMIT;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_booking_details' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Source URL: ${url}\n` +
                `Listing category: ${typeof category === 'string' ? category : 'unknown'}\n` +
                `HTML${truncated ? ' (truncated)' : ''}:\n\n${trimmed}`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { statusCode: 502, body: `Anthropic API error (${err.status}): ${err.message}` };
    }
    const m = err instanceof Error ? err.message : 'unknown error';
    return { statusCode: 500, body: `Model call failed: ${m}` };
  }

  const toolUse = message.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return { statusCode: 502, body: 'Model returned no structured output' };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(toolUse.input as Record<string, unknown>),
      scrapedAt: new Date().toISOString(),
    }),
  };
};
