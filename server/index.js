/**
 * index.js — Express API server for Wortgraph.
 *
 * Routes overview:
 *   GET  /health                   — liveness check
 *   POST /api/words                — save extracted words to graph
 *   GET  /api/words                — fetch user's deck (optionally filtered by source)
 *   GET  /api/sources              — list sources with word counts
 *   POST /api/review               — record a flashcard review result
 *   GET  /api/weak                 — words with retention < 65%
 *   GET  /api/graph                — nodes + edges for graph visualisation
 *   GET  /api/search/similar       — semantic similarity search (Gemini embeddings)
 *   POST /api/embed/words          — bulk-embed unembedded words
 *   GET  /api/agent/insight        — 7 graph insight cards (see cypher.js)
 *   GET  /api/agent/suggest        — simple CEFR-based study suggestion
 *   POST /api/agent/chat           — conversational AI coach (Groq LLaMA + Neo4j context)
 *   POST /api/backfill             — repair CO_OCCURS_WITH / BELONGS_TO edges
 *   DELETE /api/admin/clear        — wipe all data (seed script only)
 *   POST /api/admin/seed-bridges   — insert bridge-word candidates (seed script only)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { driver, runQuery, getEmbedding, wordEmbedText, initSchema } from './db.js';
import { INSIGHT_CYPHERS, CHAT_CONTEXT, buildSystemPrompt } from './cypher.js';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS: ' + origin));
  }
}));
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────

const num = (v) => v?.toNumber?.() ?? v ?? 0;

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true }));

// ── Admin (seed script only) ──────────────────────────────────────────────────

app.delete('/api/admin/clear', async (req, res) => {
  try {
    await runQuery('MATCH (n) DETACH DELETE n');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/seed-bridges', async (req, res) => {
  const { bridges } = req.body;
  if (!Array.isArray(bridges)) return res.status(400).json({ error: 'bridges array required' });
  try {
    let created = 0;
    for (const b of bridges) {
      await runQuery(`
        MERGE (w:Word {lemma: $lemma})
        ON CREATE SET w.article = $article, w.cefr = $cefr,
                      w.translation = $translation, w.example = $example,
                      w.exampleTranslation = $exampleTranslation
      `, { lemma: b.word, article: b.article || '', cefr: b.cefr || 'B2',
           translation: b.translation || '', example: b.example || '',
           exampleTranslation: b.exampleTranslation || '' });
      for (const related of (b.relatedTo || [])) {
        await runQuery(`
          MATCH (w:Word {lemma: $lemma}), (r:Word {lemma: $related})
          MERGE (w)-[e:CO_OCCURS_WITH]-(r)
          ON CREATE SET e.strength = 2, e.firstSeen = timestamp()
          ON MATCH  SET e.strength = e.strength + 1
        `, { lemma: b.word, related });
      }
      created++;
    }
    res.json({ created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Words ─────────────────────────────────────────────────────────────────────

// Save a batch of extracted words. Builds the graph:
//   User -[:ADDED]-> Word -[:EXTRACTED_FROM]-> Source
//   Word -[:BELONGS_TO]-> Topic
//   Word -[:CO_OCCURS_WITH {strength}]- Word  (all pairs from this source)
app.post('/api/words', async (req, res) => {
  const { words, source = 'Unknown', snippet = '', userId = 'default', grammarTopics = [] } = req.body;
  if (!Array.isArray(words) || words.length === 0)
    return res.status(400).json({ error: 'words array required' });

  try {
    await runQuery('MERGE (u:User {id: $userId}) ON CREATE SET u.createdAt = timestamp()', { userId });

    const sourceId = `${source}-${Date.now()}`;
    const grammarJson = JSON.stringify(grammarTopics);
    await runQuery(
      'MERGE (s:Source {id: $sourceId}) ON CREATE SET s.type = $type, s.snippet = $snippet, s.grammarTopics = $grammarJson, s.addedAt = timestamp()',
      { sourceId, type: source, snippet, grammarJson }
    );
    await runQuery('MERGE (t:Topic {name: $topic}) ON CREATE SET t.createdAt = timestamp()', { topic: source });

    for (const w of words) {
      await runQuery(`
        MERGE (word:Word {lemma: $lemma})
        ON CREATE SET word.article = $article, word.cefr = $cefr,
                      word.translation = $translation, word.example = $example,
                      word.exampleTranslation = $exampleTranslation, word.addedAt = timestamp()
        ON MATCH  SET word.cefr = $cefr, word.translation = $translation,
                      word.example = $example, word.exampleTranslation = $exampleTranslation
        WITH word
        MATCH (u:User {id: $userId}), (s:Source {id: $sourceId}), (t:Topic {name: $topic})
        MERGE (u)-[r:ADDED]->(word)
        ON CREATE SET r.addedAt = timestamp(), r.reviewCount = 0, r.retention = 0
        MERGE (word)-[:EXTRACTED_FROM]->(s)
        MERGE (word)-[:BELONGS_TO]->(t)
      `, { lemma: w.word, article: w.article || '', cefr: w.cefr || 'B1',
           translation: w.translation || '', example: w.example || '',
           exampleTranslation: w.exampleTranslation || '', userId, sourceId, topic: source });

      // Auto-embed with Gemini (fire-and-forget — doesn't block response)
      if (process.env.GEMINI_KEY) {
        getEmbedding(wordEmbedText({ ...w, lemma: w.word }))
          .then(emb => emb && runQuery(
            'MATCH (word:Word {lemma: $lemma}) SET word.embedding = $embedding',
            { lemma: w.word, embedding: emb }
          ))
          .catch(e => console.error(`Embed failed for ${w.word}:`, e.message));
      }
    }

    // CO_OCCURS_WITH: connect every pair of words from this batch.
    // Strength increments each time the same pair appears in a new source.
    const lemmas = words.map(w => w.word);
    if (lemmas.length >= 2) {
      await runQuery(`
        UNWIND $lemmas AS a
        UNWIND $lemmas AS b
        WITH a, b WHERE a < b
        MATCH (wa:Word {lemma: a}), (wb:Word {lemma: b})
        MERGE (wa)-[r:CO_OCCURS_WITH]-(wb)
        ON CREATE SET r.strength = 1, r.firstSeen = timestamp()
        ON MATCH  SET r.strength = r.strength + 1
      `, { lemmas });
    }

    res.json({ saved: words.length, edges: lemmas.length * (lemmas.length - 1) / 2 });
  } catch (e) {
    console.error('Save words error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/words', async (req, res) => {
  const { userId = 'default', sourceId } = req.query;
  try {
    const cypher = sourceId
      ? `MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)-[:EXTRACTED_FROM]->(s:Source {id: $sourceId})
         RETURN w.lemma AS word, w.article AS article, w.cefr AS cefr,
                coalesce(w.translation,'') AS translation, coalesce(w.example,'') AS example,
                coalesce(w.exampleTranslation,'') AS exampleTranslation,
                r.reviewCount AS reviewCount, r.retention AS retention, r.addedAt AS addedAt
         ORDER BY r.addedAt DESC`
      : `MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
         RETURN w.lemma AS word, w.article AS article, w.cefr AS cefr,
                coalesce(w.translation,'') AS translation, coalesce(w.example,'') AS example,
                coalesce(w.exampleTranslation,'') AS exampleTranslation,
                r.reviewCount AS reviewCount, r.retention AS retention, r.addedAt AS addedAt
         ORDER BY r.addedAt DESC`;
    const records = await runQuery(cypher, { userId, sourceId });
    res.json(records.map(r => ({
      word: r.get('word'), article: r.get('article'), cefr: r.get('cefr'),
      translation: r.get('translation'), example: r.get('example'),
      exampleTranslation: r.get('exampleTranslation'),
      reviewCount: num(r.get('reviewCount')), retention: num(r.get('retention')),
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sources', async (req, res) => {
  const { userId = 'default' } = req.query;
  try {
    const records = await runQuery(`
      MATCH (u:User {id: $userId})-[:ADDED]->(w:Word)-[:EXTRACTED_FROM]->(s:Source)
      RETURN s.id AS id, s.type AS type, s.snippet AS snippet, s.grammarTopics AS grammarTopics,
             s.addedAt AS addedAt, count(DISTINCT w) AS wordCount
      ORDER BY s.addedAt DESC
    `, { userId });
    res.json(records.map(r => {
      let grammarTopics = [];
      try { grammarTopics = JSON.parse(r.get('grammarTopics') || '[]'); } catch {}
      return {
        id: r.get('id'), type: r.get('type'), snippet: r.get('snippet') || '',
        grammarTopics, addedAt: num(r.get('addedAt')), wordCount: num(r.get('wordCount')),
      };
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update grammar topics for a source (for sources added before grammar extraction)
app.patch('/api/sources/:id/grammar', async (req, res) => {
  const { id } = req.params;
  const { grammarTopics = [] } = req.body;
  try {
    await runQuery(
      'MATCH (s:Source {id: $id}) SET s.grammarTopics = $grammarJson',
      { id, grammarJson: JSON.stringify(grammarTopics) }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Reviews & retention ───────────────────────────────────────────────────────

// Update ADDED relationship: +5 retention on correct, -10 on incorrect (floor 0, ceil 100).
app.post('/api/review', async (req, res) => {
  const { userId = 'default', word, correct } = req.body;
  try {
    await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word {lemma: $word})
      SET r.reviewCount = coalesce(r.reviewCount, 0) + 1,
          r.lastReviewed = timestamp(),
          r.retention = CASE
            WHEN $correct THEN toInteger(CASE WHEN coalesce(r.retention,0) < 95 THEN r.retention + 5 ELSE 100 END)
            ELSE            toInteger(CASE WHEN coalesce(r.retention,0) > 10 THEN r.retention - 10 ELSE 0 END)
          END
    `, { userId, word, correct });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/weak', async (req, res) => {
  const { userId = 'default' } = req.query;
  try {
    const records = await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
      WHERE r.reviewCount > 0 AND r.retention < 65
      RETURN w.lemma AS word, w.article AS article, w.cefr AS cefr, r.retention AS retention
      ORDER BY r.retention ASC LIMIT 10
    `, { userId });
    res.json(records.map(r => ({
      word: r.get('word'), article: r.get('article'),
      cefr: r.get('cefr'), retention: num(r.get('retention')),
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Graph visualisation ───────────────────────────────────────────────────────

app.get('/api/graph', async (req, res) => {
  const { userId = 'default' } = req.query;
  const minStrength = parseInt(req.query.minStrength || '1', 10);
  try {
    const [nodeRecords, edgeRecords] = await Promise.all([
      runQuery(`
        MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
        OPTIONAL MATCH (w)-[:BELONGS_TO]->(t:Topic)
        RETURN w.lemma AS lemma, w.article AS article, w.cefr AS cefr,
               coalesce(w.translation,'') AS translation,
               coalesce(r.retention,0) AS retention, coalesce(r.reviewCount,0) AS reviews,
               collect(DISTINCT t.name) AS topics
      `, { userId }),
      runQuery(`
        MATCH (u:User {id: $userId})-[:ADDED]->(a:Word)-[r:CO_OCCURS_WITH]-(b:Word)<-[:ADDED]-(u)
        WHERE id(a) < id(b) AND r.strength >= $minStrength
        RETURN a.lemma AS source, b.lemma AS target, r.strength AS strength
      `, { userId, minStrength }),
    ]);
    res.json({
      nodes: nodeRecords.map(r => ({
        id: r.get('lemma'), article: r.get('article'), cefr: r.get('cefr'),
        translation: r.get('translation'), retention: num(r.get('retention')),
        reviews: num(r.get('reviews')), topics: r.get('topics') || [],
      })),
      edges: edgeRecords.map(r => ({
        source: r.get('source'), target: r.get('target'), strength: num(r.get('strength')),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Semantic similarity search ────────────────────────────────────────────────

app.get('/api/search/similar', async (req, res) => {
  const { q, userId = 'default', limit = 8 } = req.query;
  if (!q) return res.status(400).json({ error: 'q required' });
  if (!process.env.GEMINI_KEY) return res.status(503).json({ error: 'GEMINI_KEY not configured' });
  try {
    const embedding = await getEmbedding(q);
    const records = await runQuery(`
      CALL db.index.vector.queryNodes('word_embeddings', $limit, $embedding)
      YIELD node AS w, score
      OPTIONAL MATCH (u:User {id: $userId})-[r:ADDED]->(w)
      RETURN w.lemma AS lemma, w.article AS article, w.translation AS translation,
             w.cefr AS cefr, w.example AS example, w.exampleTranslation AS exampleTranslation,
             score, (r IS NOT NULL) AS inDeck
      ORDER BY score DESC
    `, { embedding, limit: parseInt(limit), userId });
    res.json(records.map(r => ({
      word: r.get('lemma'), article: r.get('article'), translation: r.get('translation'),
      cefr: r.get('cefr'), example: r.get('example'),
      exampleTranslation: r.get('exampleTranslation'),
      score: Math.round(num(r.get('score')) * 100) / 100,
      inDeck: r.get('inDeck'),
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/embed/words', async (req, res) => {
  if (!process.env.GEMINI_KEY) return res.status(503).json({ error: 'GEMINI_KEY not configured' });
  try {
    const records = await runQuery(`
      MATCH (w:Word) WHERE w.embedding IS NULL
      RETURN w.lemma AS lemma, w.article AS article, w.translation AS translation, w.example AS example
    `);
    let embedded = 0, failed = 0;
    for (const r of records) {
      const lemma = r.get('lemma');
      try {
        const emb = await getEmbedding(wordEmbedText({ lemma, article: r.get('article'), translation: r.get('translation'), example: r.get('example') }));
        if (emb) {
          await runQuery('MATCH (w:Word {lemma: $lemma}) SET w.embedding = $embedding', { lemma, embedding: emb });
          embedded++;
        }
      } catch (e) {
        console.error(`Embed failed for ${lemma}:`, e.message);
        failed++;
      }
      await new Promise(r => setTimeout(r, 700)); // stay under Gemini free-tier rate limit
    }
    res.json({ embedded, failed, total: records.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── AI Coach: graph insight cards ─────────────────────────────────────────────
// Runs all 7 INSIGHT_CYPHERS in parallel. Each result includes the Cypher
// query that produced it so judges and learners can inspect the graph logic.

app.get('/api/agent/insight', async (req, res) => {
  const { userId = 'default' } = req.query;
  try {
    const [bridges, weakClusters, central, twins, priority, morphology, stuck] = await Promise.all([
      runQuery(INSIGHT_CYPHERS.bridges,           { userId }),
      runQuery(INSIGHT_CYPHERS.weakClusters,      { userId }),
      runQuery(INSIGHT_CYPHERS.centralWeakWords,  { userId }),
      runQuery(INSIGHT_CYPHERS.twinWords,         { userId }),
      runQuery(INSIGHT_CYPHERS.studyPriority,     { userId }),
      runQuery(INSIGHT_CYPHERS.morphologyFamilies,{ userId }),
      runQuery(INSIGHT_CYPHERS.stuckWords,        { userId }),
    ]);

    res.json({
      bridges: {
        title: 'Bridge words',
        reasoning: "Words you haven't added yet that link two or more clusters you already know. Learn one and your existing vocabulary instantly becomes more connected.",
        cypher: INSIGHT_CYPHERS.bridges.trim(),
        results: bridges.map(r => ({
          word: r.get('word'), article: r.get('article'), cefr: r.get('cefr'),
          translation: r.get('translation'),
          bridgeDegree: num(r.get('bridgeDegree')), totalStrength: num(r.get('totalStrength')),
          connectedTo: r.get('connectedTo'),
        })),
      },
      weakClusters: {
        title: 'Weak topic clusters',
        reasoning: "Topics where retention is lowest across all your words. Fix a cluster, not single words.",
        cypher: INSIGHT_CYPHERS.weakClusters.trim(),
        results: weakClusters.map(r => ({
          topic: r.get('topic'), avgRetention: Math.round(num(r.get('avgRetention'))),
          size: num(r.get('size')), sampleWords: r.get('sampleWords'),
        })),
      },
      centralWeakWords: {
        title: 'High-leverage weak words',
        reasoning: "Weak words ranked by how many other deck words they connect to. Fixing these unblocks the most reading comprehension.",
        cypher: INSIGHT_CYPHERS.centralWeakWords.trim(),
        results: central.map(r => ({
          word: r.get('word'), article: r.get('article'), translation: r.get('translation'),
          retention: num(r.get('retention')), reach: num(r.get('reach')),
        })),
      },
      twinWords: {
        title: 'Twin words',
        reasoning: "Pairs that almost always appear together — likely collocations. Practise them as a unit.",
        cypher: INSIGHT_CYPHERS.twinWords.trim(),
        results: twins.map(r => ({
          w1: r.get('w1'), w2: r.get('w2'), strength: num(r.get('strength')),
        })),
      },
      studyPriority: {
        title: 'Study priority',
        reasoning: "Ranked by graph impact: degree × (1 − retention). A highly-connected word you barely know outranks an isolated word at the same retention.",
        cypher: INSIGHT_CYPHERS.studyPriority.trim(),
        results: priority.map(r => ({
          word: r.get('word'), article: r.get('article'), translation: r.get('translation'),
          retention: num(r.get('retention')), degree: num(r.get('degree')), score: num(r.get('score')),
        })),
      },
      morphologyFamilies: {
        title: 'Word families',
        reasoning: "Deck words grouped by German prefix/suffix. Words in the same family share a root — learning one reinforces the others.",
        cypher: INSIGHT_CYPHERS.morphologyFamilies.trim(),
        results: morphology.map(r => ({
          family: r.get('family'), words: r.get('words'), size: num(r.get('size')),
        })),
      },
      stuckWords: {
        title: 'Stuck words',
        reasoning: "Reviewed 3+ times but retention still below 50%. Rote repetition isn't working — try a mnemonic or write your own example sentence.",
        cypher: INSIGHT_CYPHERS.stuckWords.trim(),
        results: stuck.map(r => ({
          word: r.get('word'), article: r.get('article'), translation: r.get('translation'),
          example: r.get('example'), retention: num(r.get('retention')),
          reviewCount: num(r.get('reviewCount')),
        })),
      },
    });
  } catch (e) {
    console.error('Insight error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── AI Coach: simple CEFR suggestion ─────────────────────────────────────────

app.get('/api/agent/suggest', async (req, res) => {
  const { userId = 'default' } = req.query;
  try {
    const knownRecords = await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
      RETURN w.cefr AS cefr, count(w) AS count
    `, { userId });
    const dist = {};
    knownRecords.forEach(r => { dist[r.get('cefr')] = r.get('count').toNumber(); });

    let focusLevel = 'B1';
    for (const lvl of ['B1', 'B2', 'C1', 'C2']) {
      if ((dist[lvl] || 0) < 30) { focusLevel = lvl; break; }
    }

    const weakRecords = await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
      WHERE r.reviewCount > 0 AND r.retention < 65
      RETURN w.lemma AS word, r.retention AS retention
      ORDER BY r.retention ASC LIMIT 5
    `, { userId });
    const weakWords = weakRecords.map(r => r.get('word'));

    res.json({
      focusLevel, knownDistribution: dist, reviewFirst: weakWords,
      suggestion: weakWords.length > 0
        ? `Review ${weakWords.slice(0, 3).join(', ')} — your retention is low. Then add more ${focusLevel} vocabulary.`
        : `You're on track. Focus on adding ${focusLevel} words from new sources.`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── AI Coach: conversational chat ────────────────────────────────────────────
// Fetches 5 live graph queries, injects them into the system prompt (see cypher.js),
// then calls Groq LLaMA 3.3 70B. The model reasons about the graph, not generic advice.

app.post('/api/agent/chat', async (req, res) => {
  const { userId = 'default', message, history = [] } = req.body;
  const groqKey = process.env.GROQ_KEY;
  if (!groqKey) return res.status(503).json({ error: 'GROQ_KEY not configured on server' });

  let words = [], weakWords = [], bridges = [], clusters = [], twins = [];
  try {
    const [wordRecs, weakRecs, bridgeRecs, clusterRecs, twinRecs] = await Promise.all([
      runQuery(CHAT_CONTEXT.recentWords, { userId }),
      runQuery(CHAT_CONTEXT.weakWords,   { userId }),
      runQuery(CHAT_CONTEXT.bridges,     { userId }),
      runQuery(CHAT_CONTEXT.clusters,    { userId }),
      runQuery(CHAT_CONTEXT.twins,       { userId }),
    ]);
    words       = wordRecs.map(r => ({ word: r.get('word'), article: r.get('article'), cefr: r.get('cefr'), retention: num(r.get('retention')), reviews: num(r.get('reviews')) }));
    weakWords   = weakRecs.map(r => `${r.get('word')} (${num(r.get('retention'))}%)`);
    bridges     = bridgeRecs.map(r => `${r.get('word')} [${r.get('cefr')}] connects ${num(r.get('deg'))} known words via ${(r.get('via') || []).join(', ')}`);
    clusters    = clusterRecs.map(r => `${r.get('topic')}: ${num(r.get('size'))} words, avg retention ${Math.round(num(r.get('avgRet')))}%`);
    twins       = twinRecs.map(r => `${r.get('w1')} ↔ ${r.get('w2')} (×${num(r.get('s'))})`);
  } catch (e) {
    console.error('Chat: Neo4j context fetch failed (continuing without graph data):', e.message);
  }

  try {
    const systemPrompt = buildSystemPrompt({ words, weakWords, clusters, bridges, twins });
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-6), { role: 'user', content: message }],
        temperature: 0.4,
      }),
    });
    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}: ${await groqRes.text()}`);
    const data = await groqRes.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (e) {
    console.error('Chat error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Backfill (one-time repair) ────────────────────────────────────────────────

app.post('/api/backfill', async (req, res) => {
  try {
    await runQuery(`
      MATCH (w:Word)-[:EXTRACTED_FROM]->(s:Source)
      WITH DISTINCT w, s.type AS topicName
      MERGE (t:Topic {name: topicName})
      MERGE (w)-[:BELONGS_TO]->(t)
    `);
    const sources = await runQuery(`MATCH (s:Source) RETURN s.id AS id`);
    let edgeCount = 0;
    for (const sRec of sources) {
      const sourceId = sRec.get('id');
      const wRec = await runQuery(`MATCH (w:Word)-[:EXTRACTED_FROM]->(s:Source {id: $sourceId}) RETURN collect(w.lemma) AS lemmas`, { sourceId });
      const lemmas = wRec[0]?.get('lemmas') || [];
      if (lemmas.length < 2) continue;
      await runQuery(`
        UNWIND $lemmas AS a UNWIND $lemmas AS b WITH a, b WHERE a < b
        MATCH (wa:Word {lemma: a}), (wb:Word {lemma: b})
        MERGE (wa)-[r:CO_OCCURS_WITH]-(wb)
        ON CREATE SET r.strength = 1, r.firstSeen = timestamp()
        ON MATCH  SET r.strength = r.strength + 1
      `, { lemmas });
      edgeCount += lemmas.length * (lemmas.length - 1) / 2;
    }
    res.json({ ok: true, processedSources: sources.length, newEdgesEstimate: edgeCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Wortgraph server running on :${PORT}`);
  await initSchema();
});

process.on('exit', () => driver.close());
