/**
 * groq.js — shared Groq chat helper with rate-limit (429) backoff.
 *
 * Groq's free tier caps tokens-per-minute. A burst of requests (e.g. hitting
 * "Rebuild" repeatedly) returns HTTP 429 with a "try again in Ns" hint. This
 * helper waits the suggested time and retries, so callers succeed instead of
 * surfacing a raw rate-limit error.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How long to wait before retrying a 429, from the Retry-After header or the
// "try again in Ns" text in the body. Capped so we never hang too long.
function backoffMs(retryAfterHeader, bodyText, attempt) {
  const hdr = Number(retryAfterHeader);
  if (Number.isFinite(hdr) && hdr > 0) return Math.min(hdr * 1000 + 300, 22000);
  const m = (bodyText || '').match(/try again in ([\d.]+)\s*s/i);
  if (m) return Math.min(Math.ceil(parseFloat(m[1]) * 1000) + 300, 22000);
  return Math.min(1500 * (attempt + 1), 22000);
}

/**
 * POST a chat-completion body to Groq, retrying on 429.
 * Returns the raw Response (caller reads .json()/.status as needed).
 * @param {object} body  OpenAI-style chat body (model, messages, ...)
 * @param {object} [opts] { retries = 2 }
 */
export async function groqChatRaw(body, { retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_KEY}` },
      body: JSON.stringify(body),
    });
    if (res.status !== 429 || attempt >= retries) return res;
    // Rate-limited and we still have retries left — wait, then try again.
    const txt = await res.clone().text().catch(() => '');
    await sleep(backoffMs(res.headers.get('retry-after'), txt, attempt));
  }
}
