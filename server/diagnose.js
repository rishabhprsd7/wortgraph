/**
 * diagnose.js — full-stack health check for Wortgraph.
 *
 * Run from the server/ directory (reads server/.env):
 *   node diagnose.js
 *
 * Checks env vars, Neo4j connectivity, graph contents, vector index,
 * Groq key, and Gemini key. Prints a report safe to share — no secrets
 * are ever printed.
 */

import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

const out = [];
const log = (s = '') => { out.push(s); console.log(s); };
const ok   = (label, detail = '') => log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
const bad  = (label, detail = '') => log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
const warn = (label, detail = '') => log(`  ⚠️  ${label}${detail ? ` — ${detail}` : ''}`);
const mask = v => (v ? `set (${String(v).length} chars, starts "${String(v).slice(0, 4)}…")` : 'MISSING');

const USER_ID = process.argv[2] || 'default';

log('═══════════════════════════════════════════════');
log(`Wortgraph diagnostics — ${new Date().toISOString()}`);
log(`Node ${process.version} · userId checked: "${USER_ID}"`);
log('═══════════════════════════════════════════════');

// ── 1. Environment ────────────────────────────────────────────────────────────
log('\n[1/4] Environment variables');
const env = {
  NEO4J_URI: process.env.NEO4J_URI,
  NEO4J_USER: process.env.NEO4J_USER,
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
  GROQ_KEY: process.env.GROQ_KEY,
  GEMINI_KEY: process.env.GEMINI_KEY,
  ADMIN_KEY: process.env.ADMIN_KEY,
  AURA_AGENT_ENDPOINT: process.env.AURA_AGENT_ENDPOINT,
  AURA_AGENT_KEY: process.env.AURA_AGENT_KEY,
};
for (const [k, v] of Object.entries(env)) {
  const optional = ['ADMIN_KEY', 'AURA_AGENT_ENDPOINT', 'AURA_AGENT_KEY', 'GEMINI_KEY'].includes(k);
  if (v) ok(k, mask(v));
  else (optional ? warn : bad)(k, optional ? 'not set (optional)' : 'MISSING — required');
}
if (env.NEO4J_URI && !/^neo4j\+s:\/\//.test(env.NEO4J_URI)) {
  warn('NEO4J_URI scheme', `expected neo4j+s:// for Aura, got "${env.NEO4J_URI.split('://')[0]}://"`);
}

// ── 2. Neo4j ──────────────────────────────────────────────────────────────────
log('\n[2/4] Neo4j (AuraDB)');
let driver;
if (!env.NEO4J_URI || !env.NEO4J_PASSWORD) {
  bad('Skipped', 'missing connection env vars');
} else {
  try {
    driver = neo4j.driver(env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD));
    await driver.verifyConnectivity();
    ok('Connection', env.NEO4J_URI.replace(/\/\/.*@/, '//'));

    const run = async (q, p = {}) => {
      const s = driver.session();
      try { return (await s.run(q, p)).records; } finally { await s.close(); }
    };
    const n = v => (neo4j.isInt(v) ? v.toNumber() : v);

    // Node + relationship counts
    const counts = await run(`
      CALL () { MATCH (w:Word)    RETURN count(w) AS c } WITH c AS words
      CALL () { MATCH (u:User)    RETURN count(u) AS c } WITH words, c AS users
      CALL () { MATCH (t:Topic)   RETURN count(t) AS c } WITH words, users, c AS topics
      CALL () { MATCH (m:Meaning) RETURN count(m) AS c } WITH words, users, topics, c AS meanings
      CALL () { MATCH ()-[r:CO_OCCURS_WITH]-() RETURN count(r)/2 AS c } WITH words, users, topics, meanings, c AS cooc
      CALL () { MATCH ()-[r:SYNONYM_OF|ANTONYM_OF|FORM_OF]->() RETURN count(r) AS c }
      RETURN words, users, topics, meanings, cooc, c AS semrels
    `);
    const c = counts[0];
    const wordCount = n(c.get('words'));
    (wordCount > 0 ? ok : bad)('Graph contents',
      `${wordCount} Words · ${n(c.get('users'))} Users · ${n(c.get('topics'))} Topics · ` +
      `${n(c.get('meanings'))} Meanings · ${n(c.get('cooc'))} CO_OCCURS_WITH · ${n(c.get('semrels'))} syn/ant/form edges`);

    // Global embedding coverage (vector index is only useful for embedded words)
    const gemb = await run(`MATCH (w:Word) RETURN count(CASE WHEN w.embedding IS NOT NULL THEN 1 END) AS e, count(w) AS t`);
    const ge = n(gemb[0].get('e')), gt = n(gemb[0].get('t'));
    (ge === gt ? ok : warn)('Embedding coverage (all words)', `${ge}/${gt} embedded${ge < gt ? ' — run POST /api/embed/words to fill the rest' : ''}`);

    // Who actually owns the data? Critical: Aura Agent tools hardcode a userId.
    const userRows = await run(`
      MATCH (u:User) OPTIONAL MATCH (u)-[r:ADDED]->(w:Word)
      RETURN u.id AS id, count(w) AS deck,
             count(CASE WHEN r.reviewCount > 0 THEN 1 END) AS reviewed
      ORDER BY deck DESC`);
    log('  👤 Users in this database:');
    for (const r of userRows) {
      log(`       - "${r.get('id')}" → ${n(r.get('deck'))} words, ${n(r.get('reviewed'))} reviewed`);
    }
    if (!userRows.some(r => r.get('id') === USER_ID && n(r.get('deck')) > 0)) {
      warn('userId mismatch', `"${USER_ID}" has no deck — re-run as: node diagnose.js <userId-from-list-above>. The Aura Agent Cypher templates must use a userId that has data!`);
    }

    // This user's deck
    const deck = await run(
      `MATCH (:User {id:$u})-[r:ADDED]->(w:Word)
       RETURN count(w) AS total,
              count(CASE WHEN r.reviewCount > 0 THEN 1 END) AS reviewed,
              count(CASE WHEN w.embedding IS NOT NULL THEN 1 END) AS embedded`, { u: USER_ID });
    const d = deck[0];
    const total = n(d.get('total'));
    (total > 0 ? ok : bad)(`Deck for "${USER_ID}"`,
      `${total} words · ${n(d.get('reviewed'))} reviewed · ${n(d.get('embedded'))} embedded`);
    if (total > 0 && n(d.get('embedded')) < total) {
      warn('Embeddings incomplete', `${total - n(d.get('embedded'))} words lack embeddings — similarity search will miss them. Run POST /api/embed/words`);
    }

    // Vector index
    const idx = await run(`SHOW INDEXES YIELD name, type, state WHERE name = 'word_embeddings' RETURN type, state`);
    if (idx.length) {
      const state = idx[0].get('state');
      (state === 'ONLINE' ? ok : warn)('Vector index word_embeddings', `${idx[0].get('type')} · ${state}`);
    } else {
      bad('Vector index word_embeddings', 'not found — semantic search & Graph-RAG will fail');
    }

    // The money query: bridge words
    const bridges = await run(`
      MATCH (u:User {id:$u})-[:ADDED]->(known:Word)
      MATCH (known)-[r:CO_OCCURS_WITH]-(cand:Word)
      WHERE NOT EXISTS { (u)-[:ADDED]->(cand) }
      WITH cand, count(DISTINCT known) AS deg
      WHERE deg >= 2 RETURN count(cand) AS c`, { u: USER_ID });
    const bc = n(bridges[0].get('c'));
    (bc > 0 ? ok : warn)('Bridge words available', bc > 0
      ? `${bc} candidates — "Get Bridge Words" will return results`
      : 'ZERO — the star demo query returns nothing! Seed bridge candidates first (POST /api/admin/seed-bridges)');

    // Weak/reviewed data for coaching queries
    const weak = await run(
      `MATCH (:User {id:$u})-[r:ADDED]->(w) WHERE r.reviewCount > 0 AND r.retention < 65
       RETURN count(w) AS c`, { u: USER_ID });
    const wc = n(weak[0].get('c'));
    (wc > 0 ? ok : warn)('Weak words available', wc > 0
      ? `${wc} — weak-word/study-priority tools will answer`
      : 'none — review some flashcards so retention-based tools have data');
  } catch (e) {
    bad('Neo4j', e.message);
    if (/Unable to connect|routing/i.test(e.message)) {
      warn('Likely cause', 'AuraDB instance is PAUSED — resume it at console.neo4j.io');
    }
  } finally {
    if (driver) await driver.close();
  }
}

// ── 3. Groq ───────────────────────────────────────────────────────────────────
log('\n[3/4] Groq API key');
if (!env.GROQ_KEY) bad('Skipped', 'GROQ_KEY missing');
else {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${env.GROQ_KEY}` },
    });
    if (r.status === 200) {
      const models = (await r.json()).data?.map(m => m.id) || [];
      const has70b = models.includes('llama-3.3-70b-versatile');
      ok('Key valid', `${models.length} models visible`);
      (has70b ? ok : bad)('llama-3.3-70b-versatile', has70b ? 'available' : 'NOT in model list');
    } else if (r.status === 401) {
      bad('Key REJECTED (401)', 'invalid/revoked — extraction & chat fallback will fail. Fix GROQ_KEY.');
    } else {
      warn(`Unexpected status ${r.status}`, (await r.text()).slice(0, 120));
    }
  } catch (e) { bad('Request failed', e.message); }
}

// ── 4. Gemini ─────────────────────────────────────────────────────────────────
log('\n[4/4] Gemini API key (embeddings)');
if (!env.GEMINI_KEY) warn('Skipped', 'GEMINI_KEY missing — semantic search disabled');
else {
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${env.GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'models/gemini-embedding-001', content: { parts: [{ text: 'diagnose' }] } }),
      }
    );
    if (r.status === 200) {
      const dims = (await r.json()).embedding?.values?.length;
      (dims === 3072 ? ok : warn)('Key valid', `embedding dims: ${dims}${dims !== 3072 ? ' (expected 3072!)' : ''}`);
    } else if (r.status === 400 || r.status === 403) {
      bad(`Key REJECTED (${r.status})`, 'invalid/restricted — semantic search & embeddings will fail');
    } else {
      warn(`Unexpected status ${r.status}`, (await r.text()).slice(0, 120));
    }
  } catch (e) { bad('Request failed', e.message); }
}

log('\n═══════════════════════════════════════════════');
log('Done. Paste this entire output back to Claude.');
log('═══════════════════════════════════════════════');
