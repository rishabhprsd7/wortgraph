import { groqChat, groqAvailable } from '../groqClient';

export const plannerAvailable = groqAvailable;

// Turns a natural-language message into { reply, gameId }.
// The agent only picks from the registered games it's given.
export async function planGame(message, games, history = []) {
  const catalog = games.map(g => `- ${g.id}: ${g.label} — ${g.blurb}`).join('\n');
  const sys = `You are the Arena coach inside a German vocabulary learning app. You help the learner choose a game to play.

Available games:
${catalog}

Respond with ONLY a JSON object, no markdown:
{"reply":"one short friendly sentence to the learner","game":"<one game id from the list, or null>"}

Rules:
- If the learner asks to play or describes what they want (e.g. "test my weak words", "something with synonyms", "quick game", "I want a crossword"), choose the best-matching game id.
- If they're vague or just chatting, set game to null and ask one short clarifying question or suggest two options by name.
- reply must be under 28 words, warm, and must NOT mention JSON or game ids.`;

  const data = await groqChat({
    temperature: 0.3,
    max_tokens: 200,
    messages: [{ role: 'system', content: sys }, ...history.slice(-4), { role: 'user', content: message }],
  });
  const txt = (data?.choices?.[0]?.message?.content || '').trim();
  let parsed;
  try {
    const m = txt.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { reply: txt, game: null };
  } catch {
    parsed = { reply: txt || "Pick a game below and let's go.", game: null };
  }
  const valid = games.find(g => g.id === parsed.game);
  return {
    reply: parsed.reply || "Let's play — pick a game below.",
    gameId: valid ? parsed.game : null,
  };
}
