/**
 * auraAgent.js — client for the published Wortgraph Coach Aura Agent.
 *
 * When AURA_AGENT_ENDPOINT + AURA_AGENT_KEY are set, /api/agent/chat routes
 * demo-user messages through the published agent (the hackathon showcase:
 * Cypher Templates + Similarity Search + Text2Cypher live in Aura). Any
 * failure falls back to the Groq + live-graph-context path in index.js.
 *
 * The invoke API response schema varies across Aura API versions, so
 * extractReply() handles every plausible shape and surfaces the raw body
 * in the error when none match — check the server log, then pin the parser.
 */

const ENDPOINT = () => process.env.AURA_AGENT_ENDPOINT;
const KEY = () => process.env.AURA_AGENT_KEY;

export const auraAgentConfigured = () => Boolean(ENDPOINT() && KEY());

export async function auraAgentChat(message) {
  const res = await fetch(ENDPOINT(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY()}`,
    },
    body: JSON.stringify({ input: message }),
    signal: AbortSignal.timeout(90_000), // multi-hop tool runs can be slow
  });

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Aura Agent ${res.status}: ${body}`);
  }

  const data = await res.json();
  const reply = extractReply(data);
  if (!reply) {
    throw new Error(`Aura Agent: unrecognised response shape: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return reply;
}

function extractReply(data) {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return null;

  const direct = data.output ?? data.content ?? data.answer ?? data.reply
    ?? data.text ?? data.response ?? data.result;
  if (typeof direct === 'string' && direct.trim()) return direct;
  if (direct && typeof direct === 'object') {
    const nested = extractReply(direct);
    if (nested) return nested;
  }

  if (typeof data.message?.content === 'string') return data.message.content;

  const choice = data.choices?.[0]?.message?.content;
  if (typeof choice === 'string' && choice.trim()) return choice;

  if (Array.isArray(data.messages) && data.messages.length) {
    const last = data.messages.at(-1);
    if (typeof last?.content === 'string' && last.content.trim()) return last.content;
  }

  // content-blocks shape: [{type:"text", text:"..."}]
  if (Array.isArray(data.content)) {
    const text = data.content
      .map(b => (typeof b === 'string' ? b : b?.text))
      .filter(Boolean).join('\n');
    if (text.trim()) return text;
  }

  return null;
}
