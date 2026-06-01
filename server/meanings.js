/**
 * meanings.js — builds English "meaning" hubs over the user's German words.
 *
 * A (:Meaning {en}) node is a single English concept; every German word that
 * expresses that concept links to it via -[:MEANS]->. This turns a flat word
 * list into a hub-and-spoke semantic graph: one English meaning in the centre,
 * all the German ways to say it radiating out, interconnected by the synonym /
 * form edges the Graph-RAG pipeline already produced.
 *
 * Grounding: the LLM is given ONLY the user's real words + translations and is
 * told to cluster them. Every word it returns is whitelist-checked against the
 * deck before any edge is written, so it cannot invent words.
 */

import { runQuery } from './db.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const CLUSTER_PROMPT = (words) => `You are a German lexicographer. Group these German words by shared ENGLISH meaning.

A group is a set of German words that a learner could reach for to express the SAME core English concept (near-synonyms). A word may belong to more than one group if it has distinct senses. Single-word groups are allowed only if the word has no synonym in the list.

WORDS (lemma — English translation):
${words.map(w => `- ${w.lemma} — ${w.translation || '(no translation)'}`).join('\n')}

Return ONLY a JSON array, no markdown:
[
  {"en":"a short English label for the concept (1-2 words, lowercase)","words":["<exact lemma>","<exact lemma>"]}
]

RULES:
- Use ONLY lemmas exactly as given above. Never invent or respell a word.
- "en" must be a clean English concept, not a German word.
- Prefer concepts with 2+ German words — that is the interesting structure.
- It is fine to leave a word out of every group if it shares meaning with nothing.`;

function parseJsonArray(raw) {
  const text = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    const result = JSON.parse(text);
    if (Array.isArray(result)) return result;
  } catch { /* fall through */ }
  const start = text.indexOf('[');
  if (start === -1) throw new Error('No JSON array found in LLM response');
  for (let end = text.lastIndexOf(']'); end > start; end = text.lastIndexOf(']', end - 1)) {
    try {
      const result = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(result)) return result;
    } catch { /* keep walking back */ }
  }
  throw new Error('Could not parse JSON array from LLM response');
}

const slug = s => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Cluster the user's words into Meaning hubs and write -[:MEANS]-> edges.
 * Idempotent: re-running refreshes the grouping for the current deck.
 *
 * @param {string} userId
 * @returns {Promise<{meanings:number, edges:number, groups:Array}>}
 */
export async function buildMeanings(userId) {
  // 1. Pull the user's words + translations
  const rows = await runQuery(`
    MATCH (u:User {id: $userId})-[:ADDED]->(w:Word)
    WHERE coalesce(w.translation,'') <> ''
    RETURN w.lemma AS lemma, w.translation AS translation
    ORDER BY w.lemma
  `, { userId });

  const words = rows.map(r => ({ lemma: r.get('lemma'), translation: r.get('translation') }));
  if (words.length < 2) return { meanings: 0, edges: 0, groups: [], error: 'need at least 2 translated words' };

  const lemmaSet = new Set(words.map(w => w.lemma));

  // 2. Ask Groq to cluster by shared English meaning
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: CLUSTER_PROMPT(words) }],
      temperature: 0.1,
      max_tokens: 3000,
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const groups = parseJsonArray(data.choices[0].message.content.trim());

  // 3. Clear this user's existing Meaning links so the rebuild is clean.
  //    Meaning nodes are global; we only detach edges from THIS user's words,
  //    then drop any Meaning left with no incoming MEANS edge.
  await runQuery(`
    MATCH (u:User {id: $userId})-[:ADDED]->(w:Word)-[m:MEANS]->(:Meaning)
    DELETE m
  `, { userId });

  // 4. Write fresh Meaning nodes + MEANS edges
  let meaningsCount = 0, edgeCount = 0;
  const written = [];
  for (const g of groups) {
    const en = (g.en || '').trim();
    const valid = (g.words || []).filter(l => lemmaSet.has(l));
    if (!en || valid.length === 0) continue;
    const id = slug(en);
    if (!id) continue;

    await runQuery(`
      MERGE (m:Meaning {id: $id})
      ON CREATE SET m.en = $en, m.createdAt = timestamp()
      ON MATCH  SET m.en = $en
    `, { id, en });
    meaningsCount++;

    for (const lemma of valid) {
      await runQuery(`
        MATCH (m:Meaning {id: $id}), (w:Word {lemma: $lemma})
        MERGE (w)-[:MEANS]->(m)
      `, { id, lemma });
      edgeCount++;
    }
    written.push({ id, en, words: valid });
  }

  // 5. Garbage-collect orphan Meaning nodes (no incoming MEANS anywhere)
  await runQuery(`
    MATCH (m:Meaning) WHERE NOT ( ()-[:MEANS]->(m) ) DELETE m
  `);

  return { meanings: meaningsCount, edges: edgeCount, groups: written };
}
