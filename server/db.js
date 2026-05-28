/**
 * db.js — Neo4j connection, query helper, and Gemini embedding utilities.
 *
 * Graph schema:
 *   (:User)-[:ADDED {retention, reviewCount}]->(:Word)
 *   (:Word)-[:CO_OCCURS_WITH {strength}]-(:Word)
 *   (:Word)-[:BELONGS_TO]->(:Topic)
 *   (:Word)-[:EXTRACTED_FROM]->(:Source)
 *   (:Word)-[:SYNONYM_OF {confidence, reason}]->(:Word)   — Graph-RAG output
 *   (:Word)-[:ANTONYM_OF {confidence, reason}]->(:Word)   — Graph-RAG output
 *   (:Word)-[:FORM_OF    {confidence, reason}]->(:Word)   — Graph-RAG output
 */

import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

// ── Neo4j ─────────────────────────────────────────────────────────────────────

export const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

export async function runQuery(cypher, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

/** Create constraints and vector index on first boot. */
export async function initSchema() {
  try {
    await runQuery('CREATE CONSTRAINT word_unique  IF NOT EXISTS FOR (w:Word)  REQUIRE w.lemma IS UNIQUE');
    await runQuery('CREATE CONSTRAINT topic_unique IF NOT EXISTS FOR (t:Topic) REQUIRE t.name  IS UNIQUE');
    await runQuery('CREATE CONSTRAINT user_unique  IF NOT EXISTS FOR (u:User)  REQUIRE u.id    IS UNIQUE');

    if (process.env.GEMINI_KEY) {
      // gemini-embedding-001 produces 3072-dim vectors — recreate index to ensure correct dimensions.
      await runQuery('DROP INDEX word_embeddings IF EXISTS');
      await runQuery(`
        CREATE VECTOR INDEX word_embeddings IF NOT EXISTS
        FOR (w:Word) ON (w.embedding)
        OPTIONS { indexConfig: {
          \`vector.dimensions\`: 3072,
          \`vector.similarity_function\`: 'cosine'
        }}
      `);
      console.log('Neo4j vector index ready (3072-dim cosine)');
    }
    console.log('Neo4j schema ready');
  } catch (e) {
    console.error('Schema init error:', e.message);
  }
}

// ── Gemini Embeddings ─────────────────────────────────────────────────────────
// Used for semantic similarity search (find words by meaning, not keyword).
// Model: gemini-embedding-001, 3072 dimensions, free tier.

const GEMINI_KEY = process.env.GEMINI_KEY;

export async function getEmbedding(text) {
  if (!GEMINI_KEY) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini embed error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.embedding.values;
}

/** Build the text string used to embed a word (article + lemma + translation + example). */
export function wordEmbedText(w) {
  return `${w.article || ''} ${w.lemma || w.word}: ${w.translation || ''}${w.example ? '. ' + w.example : ''}`.trim();
}
