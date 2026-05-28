/**
 * relations.js — Graph-RAG pipeline for word relations.
 *
 * Given a target word, retrieves the top-K nearest neighbors from the user's
 * deck via the Neo4j vector index, then asks Groq to classify each candidate
 * as synonym / antonym / form_of / unrelated with confidence. Edges above the
 * confidence threshold are written back to the graph.
 *
 * This is "Graph-RAG" — retrieval grounds the LLM in real words from the deck
 * (instead of hallucinating from training data), and the LLM output augments
 * the graph with new typed edges.
 */

import { runQuery } from './db.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const CLASSIFY_PROMPT = (target, candidates) => `You are a German linguistics expert. Classify each candidate word's relationship to the TARGET word.

TARGET: ${target.article ? target.article + ' ' : ''}${target.lemma}
Translation: ${target.translation || '(none)'}
Example: "${target.example || '(none)'}"

CANDIDATES:
${candidates.map((c, i) => `${i + 1}. ${c.article ? c.article + ' ' : ''}${c.lemma} — ${c.translation || '(no translation)'}`).join('\n')}

For each candidate, output ONE JSON object. Return ONLY a JSON array — no markdown, no prose:
[
  {"lemma":"<exact candidate lemma as given>","relation":"synonym"|"antonym"|"form_of"|"unrelated","confidence":0.0-1.0,"reason":"one short clause"}
]

DEFINITIONS:
- synonym  : near-identical meaning, often interchangeable in context
- antonym  : opposite meaning (groß ↔ klein, steigen ↔ fallen)
- form_of  : derived from the same root word (beschließen → Beschluss, Lehrer → Lehrerin, schnell → Schnelligkeit)
- unrelated: same topic but NOT a synonym/antonym/form

RULES:
- Be strict — most candidates will be "unrelated". Only confidence > 0.7 entries get saved.
- Base each judgment ONLY on the translations and examples shown above, not on memory.
- Match candidate lemma exactly (no spelling fixes).`;

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
    } catch { /* fall through */ }
  }
  throw new Error('Could not parse JSON array from LLM response');
}

const RELATION_TO_EDGE = {
  synonym: 'SYNONYM_OF',
  antonym: 'ANTONYM_OF',
  form_of: 'FORM_OF',
};

/**
 * Run the Graph-RAG classification for one word.
 *
 * @param {string} targetLemma - exact lemma to classify against
 * @param {string} userId - filters candidates to the user's deck
 * @param {object} [opts]
 * @param {number} [opts.minConfidence=0.7] - threshold for writing edges
 * @param {number} [opts.k=30] - candidate count to retrieve from vector index
 * @returns {Promise<{synonyms:[], antonyms:[], forms:[], debug:object}>}
 */
export async function classifyRelations(targetLemma, userId, opts = {}) {
  const minConfidence = opts.minConfidence ?? 0.7;
  const k = opts.k ?? 30;

  // 1. Fetch target word + embedding
  const targetRows = await runQuery(`
    MATCH (u:User {id: $userId})-[:ADDED]->(w:Word {lemma: $lemma})
    RETURN w.embedding AS embedding, w.article AS article,
           w.translation AS translation, w.example AS example
  `, { userId, lemma: targetLemma });

  if (!targetRows.length) {
    return { synonyms: [], antonyms: [], forms: [], error: 'word not in deck' };
  }
  const embedding = targetRows[0].get('embedding');
  if (!embedding) {
    return { synonyms: [], antonyms: [], forms: [], error: 'word not embedded yet — try again in a few seconds' };
  }

  const target = {
    lemma: targetLemma,
    article: targetRows[0].get('article') || '',
    translation: targetRows[0].get('translation') || '',
    example: targetRows[0].get('example') || '',
  };

  // 2. Retrieve candidates from user's deck (RAG: ground the LLM in real words)
  const candRows = await runQuery(`
    CALL db.index.vector.queryNodes('word_embeddings', $k, $embedding)
    YIELD node AS w, score
    MATCH (u:User {id: $userId})-[:ADDED]->(w)
    WHERE w.lemma <> $lemma AND score > 0.5
    RETURN w.lemma AS lemma, w.article AS article,
           w.translation AS translation, w.example AS example, score
    ORDER BY score DESC
    LIMIT 20
  `, { embedding, lemma: targetLemma, userId, k });

  const candidates = candRows.map(r => ({
    lemma: r.get('lemma'),
    article: r.get('article') || '',
    translation: r.get('translation') || '',
    example: r.get('example') || '',
    score: r.get('score'),
  }));

  if (candidates.length === 0) {
    return { synonyms: [], antonyms: [], forms: [], candidateCount: 0 };
  }

  // 3. Ask Groq to classify each candidate, grounded by translations
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: CLASSIFY_PROMPT(target, candidates) }],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  const classifications = parseJsonArray(raw);

  // 4. Write edges above the confidence threshold
  const written = { synonyms: [], antonyms: [], forms: [] };
  for (const c of classifications) {
    if (!c.lemma || c.relation === 'unrelated') continue;
    const edge = RELATION_TO_EDGE[c.relation];
    if (!edge) continue;
    const conf = Number(c.confidence) || 0;
    if (conf < minConfidence) continue;

    // Confirm candidate is in the retrieved set (anti-hallucination check)
    const cand = candidates.find(x => x.lemma === c.lemma);
    if (!cand) continue;

    await runQuery(`
      MATCH (a:Word {lemma: $target}), (b:Word {lemma: $candidate})
      MERGE (a)-[r:${edge}]->(b)
      SET r.confidence = $confidence, r.reason = $reason, r.updatedAt = timestamp()
    `, { target: targetLemma, candidate: c.lemma, confidence: conf, reason: c.reason || '' });

    const bucket = c.relation === 'synonym' ? 'synonyms' : c.relation === 'antonym' ? 'antonyms' : 'forms';
    written[bucket].push({
      lemma: cand.lemma,
      article: cand.article,
      translation: cand.translation,
      confidence: conf,
      reason: c.reason || '',
    });
  }

  return {
    ...written,
    debug: { candidateCount: candidates.length, classifiedCount: classifications.length },
  };
}
