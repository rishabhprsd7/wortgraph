// Client-side Groq access goes through the server proxy so the API key is
// never shipped to the browser. Same call shape as the OpenAI chat API; the
// server attaches the key and forwards to Groq.
const API_URL = import.meta.env.VITE_API_URL || '';

// Groq features are available whenever the backend is configured. The actual
// key check happens server-side (returns 503 if GROQ_KEY is unset).
export const groqAvailable = !!API_URL;

// Send a chat-completion request through the proxy. `body` is the usual
// { messages, temperature, max_tokens, seed? } object. Returns the parsed
// Groq response (same shape as the direct API: { choices: [...] }).
export async function groqChat(body) {
  if (!API_URL) throw new Error('VITE_API_URL is not set');
  const res = await fetch(`${API_URL}/api/groq/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq proxy error ${res.status}: ${text}`);
  }
  return res.json();
}
