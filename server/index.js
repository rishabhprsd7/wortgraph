import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import neo4j from 'neo4j-driver';

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

// Neo4j driver (singleton)
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function runQuery(cypher, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

// ── Gemini embeddings (gemini-embedding-001, 768-dim, free tier) ─────────────
const GEMINI_KEY = process.env.GEMINI_KEY;

async function getEmbedding(text) {
  if (!GEMINI_KEY) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'models/gemini-embedding-001', content: { parts: [{ text }] } })
    }
  );
  if (!res.ok) throw new Error(`Gemini embed error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.embedding.values;
}

function wordEmbedText(w) {
  return `${w.article || ''} ${w.lemma || w.word}: ${w.translation || ''}${w.example ? '. ' + w.example : ''}`.trim();
}

// Initialize schema constraints on startup
async function initSchema() {
  try {
    await runQuery('CREATE CONSTRAINT word_unique IF NOT EXISTS FOR (w:Word) REQUIRE w.lemma IS UNIQUE');
    await runQuery('CREATE CONSTRAINT topic_unique IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE');
    await runQuery('CREATE CONSTRAINT user_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE');
    if (GEMINI_KEY) {
      await runQuery(`
        CREATE VECTOR INDEX word_embeddings IF NOT EXISTS
        FOR (w:Word) ON (w.embedding)
        OPTIONS {indexConfig: {
          \`vector.dimensions\`: 768,
          \`vector.similarity_function\`: 'cosine'
        }}
      `);
      console.log('Neo4j vector index ready');
    }
    console.log('Neo4j schema ready');
  } catch (e) {
    console.error('Schema init error:', e.message);
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

// Save extracted words to the graph
// POST /api/words  { words: [{article, word, cefr}], source: "Article", sourceText: "..." }
app.post('/api/words', async (req, res) => {
  const { words, source = 'Unknown', snippet = '', userId = 'default' } = req.body;
  if (!Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'words array required' });
  }

  try {
    await runQuery(
      'MERGE (u:User {id: $userId}) ON CREATE SET u.createdAt = timestamp()',
      { userId }
    );

    const sourceId = `${source}-${Date.now()}`;
    await runQuery(
      'MERGE (s:Source {id: $sourceId}) ON CREATE SET s.type = $type, s.snippet = $snippet, s.addedAt = timestamp()',
      { sourceId, type: source, snippet }
    );

    // Topic node: one per source type (Article, Politics, Climate, etc.)
    await runQuery(
      'MERGE (t:Topic {name: $topic}) ON CREATE SET t.createdAt = timestamp()',
      { topic: source }
    );

    // Upsert each word and link to user + source + topic
    for (const w of words) {
      await runQuery(`
        MERGE (word:Word {lemma: $lemma})
        ON CREATE SET word.article = $article, word.cefr = $cefr, word.translation = $translation, word.example = $example, word.exampleTranslation = $exampleTranslation, word.addedAt = timestamp()
        ON MATCH SET word.cefr = $cefr, word.translation = $translation, word.example = $example, word.exampleTranslation = $exampleTranslation
        WITH word
        MATCH (u:User {id: $userId}), (s:Source {id: $sourceId}), (t:Topic {name: $topic})
        MERGE (u)-[r:ADDED]->(word)
        ON CREATE SET r.addedAt = timestamp(), r.reviewCount = 0, r.retention = 0
        MERGE (word)-[:EXTRACTED_FROM]->(s)
        MERGE (word)-[:BELONGS_TO]->(t)
      `, { lemma: w.word, article: w.article || '', cefr: w.cefr || 'B1', translation: w.translation || '', example: w.example || '', exampleTranslation: w.exampleTranslation || '', userId, sourceId, topic: source });

      // Auto-embed if Gemini key is available (fire-and-forget, don't block the response)
      if (GEMINI_KEY) {
        getEmbedding(wordEmbedText({ ...w, lemma: w.word }))
          .then(embedding => embedding && runQuery(
            'MATCH (word:Word {lemma: $lemma}) SET word.embedding = $embedding',
            { lemma: w.word, embedding }
          ))
          .catch(e => console.error(`Embed failed for ${w.word}:`, e.message));
      }
    }

    // CO_OCCURS_WITH: connect every pair of words from this source.
    // Strength increments each time the pair shows up together in a new source.
    const lemmas = words.map(w => w.word);
    if (lemmas.length >= 2) {
      await runQuery(`
        UNWIND $lemmas AS a
        UNWIND $lemmas AS b
        WITH a, b WHERE a < b
        MATCH (wa:Word {lemma: a}), (wb:Word {lemma: b})
        MERGE (wa)-[r:CO_OCCURS_WITH]-(wb)
        ON CREATE SET r.strength = 1, r.firstSeen = timestamp()
        ON MATCH SET r.strength = r.strength + 1
      `, { lemmas });
    }

    res.json({ saved: words.length, edges: lemmas.length * (lemmas.length - 1) / 2 });
  } catch (e) {
    console.error('Save words error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get user's word deck, optionally filtered by source
// GET /api/words?userId=default&sourceId=Article-1234
app.get('/api/words', async (req, res) => {
  const { userId = 'default', sourceId } = req.query;
  try {
    const cypher = sourceId
      ? `MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)-[:EXTRACTED_FROM]->(s:Source {id: $sourceId})
         RETURN w.lemma AS word, w.article AS article, w.cefr AS cefr,
                coalesce(w.translation, '') AS translation, coalesce(w.example, '') AS example, coalesce(w.exampleTranslation, '') AS exampleTranslation,
                r.reviewCount AS reviewCount, r.retention AS retention,
                r.addedAt AS addedAt
         ORDER BY r.addedAt DESC`
      : `MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
         RETURN w.lemma AS word, w.article AS article, w.cefr AS cefr,
                coalesce(w.translation, '') AS translation, coalesce(w.example, '') AS example, coalesce(w.exampleTranslation, '') AS exampleTranslation,
                r.reviewCount AS reviewCount, r.retention AS retention,
                r.addedAt AS addedAt
         ORDER BY r.addedAt DESC`;
    const records = await runQuery(cypher, { userId, sourceId });

    const words = records.map(r => ({
      word: r.get('word'),
      article: r.get('article'),
      cefr: r.get('cefr'),
      translation: r.get('translation'),
      example: r.get('example'),
      exampleTranslation: r.get('exampleTranslation'),
      reviewCount: r.get('reviewCount')?.toNumber?.() ?? 0,
      retention: r.get('retention')?.toNumber?.() ?? 0,
    }));
    res.json(words);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get sources (extracted texts) with word counts
// GET /api/sources?userId=default
app.get('/api/sources', async (req, res) => {
  const { userId = 'default' } = req.query;
  try {
    const records = await runQuery(`
      MATCH (u:User {id: $userId})-[:ADDED]->(w:Word)-[:EXTRACTED_FROM]->(s:Source)
      RETURN s.id AS id, s.type AS type, s.snippet AS snippet, s.addedAt AS addedAt,
             count(DISTINCT w) AS wordCount
      ORDER BY s.addedAt DESC
    `, { userId });
    res.json(records.map(r => ({
      id: r.get('id'),
      type: r.get('type'),
      snippet: r.get('snippet') || '',
      addedAt: r.get('addedAt')?.toNumber?.() ?? 0,
      wordCount: r.get('wordCount')?.toNumber?.() ?? 0,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Record a flashcard review result
// POST /api/review  { userId, word, correct: true/false }
app.post('/api/review', async (req, res) => {
  const { userId = 'default', word, correct } = req.body;
  try {
    await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word {lemma: $word})
      SET r.reviewCount = coalesce(r.reviewCount, 0) + 1,
          r.lastReviewed = timestamp(),
          r.retention = CASE
            WHEN $correct THEN toInteger(CASE WHEN coalesce(r.retention, 0) < 95 THEN r.retention + 5 ELSE 100 END)
            ELSE toInteger(CASE WHEN coalesce(r.retention, 0) > 10 THEN r.retention - 10 ELSE 0 END)
          END
    `, { userId, word, correct });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get weak words (retention < 65%)
// GET /api/weak?userId=default
app.get('/api/weak', async (req, res) => {
  const { userId = 'default' } = req.query;
  try {
    const records = await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
      WHERE r.reviewCount > 0 AND r.retention < 65
      RETURN w.lemma AS word, w.article AS article, w.cefr AS cefr,
             r.retention AS retention
      ORDER BY r.retention ASC
      LIMIT 10
    `, { userId });

    res.json(records.map(r => ({
      word: r.get('word'),
      article: r.get('article'),
      cefr: r.get('cefr'),
      retention: r.get('retention')?.toNumber?.() ?? 0,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Semantic similarity search — find words by meaning, not keyword
// GET /api/search/similar?q=sustainability&userId=default&limit=8
app.get('/api/search/similar', async (req, res) => {
  const { q, userId = 'default', limit = 8 } = req.query;
  if (!q) return res.status(400).json({ error: 'q (query) required' });
  if (!GEMINI_KEY) return res.status(503).json({ error: 'GEMINI_KEY not configured' });
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

    const num = v => v?.toNumber?.() ?? v ?? 0;
    res.json(records.map(r => ({
      word: r.get('lemma'),
      article: r.get('article'),
      translation: r.get('translation'),
      cefr: r.get('cefr'),
      example: r.get('example'),
      exampleTranslation: r.get('exampleTranslation'),
      score: Math.round(num(r.get('score')) * 100) / 100,
      inDeck: r.get('inDeck'),
    })));
  } catch (e) {
    console.error('Similarity search error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Bulk-embed all unembedded words (run once after seeding or upgrading)
// POST /api/embed/words
app.post('/api/embed/words', async (req, res) => {
  if (!GEMINI_KEY) return res.status(503).json({ error: 'GEMINI_KEY not configured' });
  try {
    const records = await runQuery(`
      MATCH (w:Word) WHERE w.embedding IS NULL
      RETURN w.lemma AS lemma, w.article AS article,
             w.translation AS translation, w.example AS example
    `);
    let embedded = 0, failed = 0;
    for (const r of records) {
      const lemma = r.get('lemma');
      try {
        const text = wordEmbedText({ lemma, article: r.get('article'), translation: r.get('translation'), example: r.get('example') });
        const embedding = await getEmbedding(text);
        if (embedding) {
          await runQuery('MATCH (w:Word {lemma: $lemma}) SET w.embedding = $embedding', { lemma, embedding });
          embedded++;
        }
      } catch (e) {
        console.error(`Embed failed for ${lemma}:`, e.message);
        failed++;
      }
      // Stay under free tier limit of 100 req/min
      await new Promise(r => setTimeout(r, 700));
    }
    res.json({ embedded, failed, total: records.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AI Agent: suggest a learning path based on graph gaps
// GET /api/agent/suggest?userId=default
app.get('/api/agent/suggest', async (req, res) => {
  const { userId = 'default' } = req.query;
  try {
    // Find words the user knows and their CEFR distribution
    const knownRecords = await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
      RETURN w.cefr AS cefr, count(w) AS count
    `, { userId });

    const dist = {};
    knownRecords.forEach(r => { dist[r.get('cefr')] = r.get('count').toNumber(); });

    // Suggest next CEFR level to focus on
    const levels = ['B1', 'B2', 'C1', 'C2'];
    let focusLevel = 'B1';
    for (const lvl of levels) {
      if ((dist[lvl] || 0) < 30) { focusLevel = lvl; break; }
    }

    // Get weak words to review
    const weakRecords = await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
      WHERE r.reviewCount > 0 AND r.retention < 65
      RETURN w.lemma AS word, r.retention AS retention
      ORDER BY r.retention ASC LIMIT 5
    `, { userId });

    const weakWords = weakRecords.map(r => r.get('word'));

    res.json({
      focusLevel,
      knownDistribution: dist,
      reviewFirst: weakWords,
      suggestion: weakWords.length > 0
        ? `Review ${weakWords.slice(0, 3).join(', ')} — your retention is low. Then add more ${focusLevel} vocabulary.`
        : `You're on track. Focus on adding ${focusLevel} words from new sources.`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Backfill graph edges for existing data (run once after schema upgrade).
// POST /api/backfill  { userId }
app.post('/api/backfill', async (req, res) => {
  const { userId = 'default' } = req.body;
  try {
    // 1. Ensure every Word that came from a Source has a BELONGS_TO edge to a Topic of that source's type.
    await runQuery(`
      MATCH (w:Word)-[:EXTRACTED_FROM]->(s:Source)
      WITH DISTINCT w, s.type AS topicName
      MERGE (t:Topic {name: topicName})
      MERGE (w)-[:BELONGS_TO]->(t)
    `);

    // 2. For every Source, create CO_OCCURS_WITH edges between all word pairs from it.
    const sources = await runQuery(`MATCH (s:Source) RETURN s.id AS id`);
    let edgeCount = 0;
    for (const sRec of sources) {
      const sourceId = sRec.get('id');
      const wRec = await runQuery(`
        MATCH (w:Word)-[:EXTRACTED_FROM]->(s:Source {id: $sourceId})
        RETURN collect(w.lemma) AS lemmas
      `, { sourceId });
      const lemmas = wRec[0]?.get('lemmas') || [];
      if (lemmas.length < 2) continue;
      await runQuery(`
        UNWIND $lemmas AS a
        UNWIND $lemmas AS b
        WITH a, b WHERE a < b
        MATCH (wa:Word {lemma: a}), (wb:Word {lemma: b})
        MERGE (wa)-[r:CO_OCCURS_WITH]-(wb)
        ON CREATE SET r.strength = 1, r.firstSeen = timestamp()
        ON MATCH SET r.strength = r.strength + 1
      `, { lemmas });
      edgeCount += lemmas.length * (lemmas.length - 1) / 2;
    }

    // 3. Report what we touched.
    const stats = await runQuery(`
      MATCH (w:Word) WITH count(w) AS words
      MATCH ()-[c:CO_OCCURS_WITH]->() WITH words, count(c) AS coEdges
      MATCH (t:Topic) RETURN words, coEdges, count(t) AS topics
    `);
    res.json({
      ok: true,
      processedSources: sources.length,
      newEdgesEstimate: edgeCount,
      stats: {
        words: stats[0]?.get('words')?.toNumber?.() ?? 0,
        coOccurrenceEdges: stats[0]?.get('coEdges')?.toNumber?.() ?? 0,
        topics: stats[0]?.get('topics')?.toNumber?.() ?? 0,
      }
    });
  } catch (e) {
    console.error('Backfill error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Graph-aware insights — the heart of "make your graph matter".
// Each insight returns reasoning + the Cypher pattern that produced it.
// GET /api/agent/insight?userId=default
app.get('/api/agent/insight', async (req, res) => {
  const { userId = 'default' } = req.query;
  try {
    const cyphers = {
      bridges: `
        // BRIDGE WORDS: words you don't know that connect two clusters of words you do know.
        // Each bridge candidate is a Word linked by CO_OCCURS_WITH to >= 2 words in the user's deck,
        // ranked by total co-occurrence strength.
        MATCH (u:User {id: $userId})-[:ADDED]->(known:Word)
        MATCH (known)-[r:CO_OCCURS_WITH]-(candidate:Word)
        WHERE NOT EXISTS { (u)-[:ADDED]->(candidate) }
        WITH candidate, count(DISTINCT known) AS bridgeDegree, sum(r.strength) AS totalStrength,
             collect(DISTINCT known.lemma)[0..5] AS connectedTo
        WHERE bridgeDegree >= 2
        RETURN candidate.lemma AS word, candidate.article AS article,
               candidate.cefr AS cefr, candidate.translation AS translation,
               bridgeDegree, totalStrength, connectedTo
        ORDER BY bridgeDegree DESC, totalStrength DESC
        LIMIT 5
      `,
      weakClusters: `
        // WEAK CLUSTERS: topics where average retention is lowest.
        // Helps the user focus on the cluster, not just isolated words.
        MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)-[:BELONGS_TO]->(t:Topic)
        WHERE r.reviewCount > 0
        WITH t.name AS topic, avg(r.retention) AS avgRetention,
             count(w) AS size, collect(w.lemma)[0..3] AS sampleWords
        WHERE size >= 3
        RETURN topic, avgRetention, size, sampleWords
        ORDER BY avgRetention ASC
        LIMIT 5
      `,
      centralWeakWords: `
        // HIGH-LEVERAGE WEAK WORDS: weak words that touch the most other words in your deck.
        // Fixing these unblocks the most reading comprehension.
        MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
        WHERE r.reviewCount > 0 AND r.retention < 65
        OPTIONAL MATCH (w)-[c:CO_OCCURS_WITH]-(neighbor:Word)<-[:ADDED]-(u)
        WITH w, r.retention AS retention, count(DISTINCT neighbor) AS reach
        WHERE reach > 0
        RETURN w.lemma AS word, w.article AS article, w.translation AS translation,
               retention, reach
        ORDER BY reach DESC, retention ASC
        LIMIT 5
      `,
      twinWords: `
        // TWIN WORDS: pairs in your deck that nearly always co-occur.
        // High strength = they're effectively a phrase or topical pair.
        MATCH (u:User {id: $userId})-[:ADDED]->(a:Word)-[r:CO_OCCURS_WITH]-(b:Word)<-[:ADDED]-(u)
        WHERE id(a) < id(b)
        RETURN a.lemma AS w1, b.lemma AS w2, r.strength AS strength
        ORDER BY r.strength DESC
        LIMIT 5
      `,
      studyPriority: `
        // STUDY PRIORITY: score = graph_degree × (1 − retention/100).
        // Words that connect to many others but you know poorly bubble to the top.
        // Improving these has the highest multiplier effect on reading comprehension.
        MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
        OPTIONAL MATCH (w)-[:CO_OCCURS_WITH]-(neighbor:Word)<-[:ADDED]-(u)
        WITH w, coalesce(r.retention, 0) AS retention, count(DISTINCT neighbor) AS degree
        WHERE degree > 0
        WITH w, retention, degree,
             degree * (1.0 - retention / 100.0) AS score
        RETURN w.lemma AS word, w.article AS article, w.translation AS translation,
               retention, degree, round(score * 10) / 10 AS score
        ORDER BY score DESC
        LIMIT 5
      `,
      morphologyFamilies: `
        // GERMAN WORD FAMILIES: groups your deck words by shared prefix/suffix.
        // Words in the same family share roots — learning one reinforces the others.
        MATCH (u:User {id: $userId})-[:ADDED]->(w:Word)
        WITH w,
             CASE
               WHEN w.lemma STARTS WITH 'ver' THEN 'ver-'
               WHEN w.lemma STARTS WITH 'ent' THEN 'ent-'
               WHEN w.lemma STARTS WITH 'be' THEN 'be-'
               WHEN w.lemma STARTS WITH 'ge' THEN 'ge-'
               WHEN w.lemma STARTS WITH 'er' THEN 'er-'
               WHEN w.lemma ENDS WITH 'ung' THEN '-ung'
               WHEN w.lemma ENDS WITH 'keit' THEN '-keit'
               WHEN w.lemma ENDS WITH 'schaft' THEN '-schaft'
               WHEN w.lemma ENDS WITH 'lich' THEN '-lich'
               WHEN w.lemma ENDS WITH 'los' THEN '-los'
               ELSE null
             END AS family
        WHERE family IS NOT NULL
        WITH family, collect(w.lemma)[0..5] AS words, count(w) AS size
        WHERE size >= 2
        RETURN family, words, size
        ORDER BY size DESC
        LIMIT 6
      `,
      stuckWords: `
        // STUCK WORDS: reviewed 3+ times but retention is still below 50%.
        // These need active strategies — mnemonics, context sentences, or spaced review.
        MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
        WHERE r.reviewCount >= 3 AND coalesce(r.retention, 0) < 50
        RETURN w.lemma AS word, w.article AS article, w.translation AS translation,
               w.example AS example,
               r.retention AS retention, r.reviewCount AS reviewCount
        ORDER BY r.reviewCount DESC, r.retention ASC
        LIMIT 5
      `,
    };

    const [bridges, weakClusters, central, twins, priority, morphology, stuck] = await Promise.all([
      runQuery(cyphers.bridges, { userId }),
      runQuery(cyphers.weakClusters, { userId }),
      runQuery(cyphers.centralWeakWords, { userId }),
      runQuery(cyphers.twinWords, { userId }),
      runQuery(cyphers.studyPriority, { userId }),
      runQuery(cyphers.morphologyFamilies, { userId }),
      runQuery(cyphers.stuckWords, { userId }),
    ]);

    const num = (v) => v?.toNumber?.() ?? v ?? 0;

    res.json({
      bridges: {
        title: 'Bridge words',
        reasoning: 'Words you haven\'t added yet that link two or more clusters of words you already know. Learn one of these and your existing vocabulary instantly becomes more connected.',
        cypher: cyphers.bridges.trim(),
        results: bridges.map(r => ({
          word: r.get('word'),
          article: r.get('article'),
          cefr: r.get('cefr'),
          translation: r.get('translation'),
          bridgeDegree: num(r.get('bridgeDegree')),
          totalStrength: num(r.get('totalStrength')),
          connectedTo: r.get('connectedTo'),
        })),
      },
      weakClusters: {
        title: 'Weak topic clusters',
        reasoning: 'Topics where your retention is lowest, weighted by how many words you\'ve studied in each. A weak cluster is a sign of a comprehension hole — fix the cluster, not single words.',
        cypher: cyphers.weakClusters.trim(),
        results: weakClusters.map(r => ({
          topic: r.get('topic'),
          avgRetention: Math.round(num(r.get('avgRetention'))),
          size: num(r.get('size')),
          sampleWords: r.get('sampleWords'),
        })),
      },
      centralWeakWords: {
        title: 'High-leverage weak words',
        reasoning: 'Weak words ranked by how many other words in your deck they connect to. Reviewing one of these strengthens many co-occurring words by association.',
        cypher: cyphers.centralWeakWords.trim(),
        results: central.map(r => ({
          word: r.get('word'),
          article: r.get('article'),
          translation: r.get('translation'),
          retention: num(r.get('retention')),
          reach: num(r.get('reach')),
        })),
      },
      twinWords: {
        title: 'Twin words',
        reasoning: 'Pairs from your deck that almost always appear together — likely collocations or topical pairs. Practising them as a unit is faster than separately.',
        cypher: cyphers.twinWords.trim(),
        results: twins.map(r => ({
          w1: r.get('w1'),
          w2: r.get('w2'),
          strength: num(r.get('strength')),
        })),
      },
      studyPriority: {
        title: 'Study priority',
        reasoning: 'Ranked by graph impact: degree × (1 − retention). A highly-connected word you barely know outranks an isolated word at the same retention. Fix these first for the biggest reading comprehension gain.',
        cypher: cyphers.studyPriority.trim(),
        results: priority.map(r => ({
          word: r.get('word'),
          article: r.get('article'),
          translation: r.get('translation'),
          retention: num(r.get('retention')),
          degree: num(r.get('degree')),
          score: num(r.get('score')),
        })),
      },
      morphologyFamilies: {
        title: 'Word families',
        reasoning: 'Your deck words grouped by German prefix/suffix. Words in the same family share a root meaning — learning one gives you a free head-start on the others.',
        cypher: cyphers.morphologyFamilies.trim(),
        results: morphology.map(r => ({
          family: r.get('family'),
          words: r.get('words'),
          size: num(r.get('size')),
        })),
      },
      stuckWords: {
        title: 'Stuck words',
        reasoning: 'Words you\'ve reviewed 3 or more times but retention is still below 50%. These resist rote repetition — try a mnemonic, write your own example sentence, or use them in conversation.',
        cypher: cyphers.stuckWords.trim(),
        results: stuck.map(r => ({
          word: r.get('word'),
          article: r.get('article'),
          translation: r.get('translation'),
          example: r.get('example'),
          retention: num(r.get('retention')),
          reviewCount: num(r.get('reviewCount')),
        })),
      },
    });
  } catch (e) {
    console.error('Insight error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Graph data for visualization.
// Returns nodes (Words user has added) + CO_OCCURS_WITH edges between them.
// GET /api/graph?userId=default&minStrength=1
app.get('/api/graph', async (req, res) => {
  const { userId = 'default' } = req.query;
  const minStrength = parseInt(req.query.minStrength || '1', 10);
  try {
    const nodeRecords = await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
      OPTIONAL MATCH (w)-[:BELONGS_TO]->(t:Topic)
      RETURN w.lemma AS lemma, w.article AS article, w.cefr AS cefr,
             coalesce(w.translation, '') AS translation,
             coalesce(r.retention, 0) AS retention,
             coalesce(r.reviewCount, 0) AS reviews,
             collect(DISTINCT t.name) AS topics
    `, { userId });

    const edgeRecords = await runQuery(`
      MATCH (u:User {id: $userId})-[:ADDED]->(a:Word)-[r:CO_OCCURS_WITH]-(b:Word)<-[:ADDED]-(u)
      WHERE id(a) < id(b) AND r.strength >= $minStrength
      RETURN a.lemma AS source, b.lemma AS target, r.strength AS strength
    `, { userId, minStrength });

    const num = (v) => v?.toNumber?.() ?? v ?? 0;

    res.json({
      nodes: nodeRecords.map(r => ({
        id: r.get('lemma'),
        article: r.get('article'),
        cefr: r.get('cefr'),
        translation: r.get('translation'),
        retention: num(r.get('retention')),
        reviews: num(r.get('reviews')),
        topics: r.get('topics') || [],
      })),
      edges: edgeRecords.map(r => ({
        source: r.get('source'),
        target: r.get('target'),
        strength: num(r.get('strength')),
      })),
    });
  } catch (e) {
    console.error('Graph error:', e);
    res.status(500).json({ error: e.message });
  }
});

// AI Agent: conversational chat with Neo4j context
// POST /api/agent/chat  { userId, message, history: [{role, content}] }
app.post('/api/agent/chat', async (req, res) => {
  const { userId = 'default', message, history = [] } = req.body;
  const groqKey = process.env.GROQ_KEY;
  if (!groqKey) return res.status(500).json({ error: 'GROQ_KEY not set on server' });

  try {
    // Pull rich graph context from Neo4j: deck + weak words + bridge words + topic clusters + twin pairs
    const num = (v) => v?.toNumber?.() ?? v ?? 0;
    const [wordRecords, weakRecords, bridgeRecords, clusterRecords, twinRecords] = await Promise.all([
      runQuery(`
        MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
        RETURN w.lemma AS word, w.article AS article, w.cefr AS cefr,
               coalesce(r.retention, 0) AS retention, coalesce(r.reviewCount, 0) AS reviews
        ORDER BY r.addedAt DESC LIMIT 50
      `, { userId }),
      runQuery(`
        MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
        WHERE r.reviewCount > 0 AND r.retention < 65
        RETURN w.lemma AS word, r.retention AS retention
        ORDER BY r.retention ASC LIMIT 10
      `, { userId }),
      runQuery(`
        MATCH (u:User {id: $userId})-[:ADDED]->(known:Word)-[r:CO_OCCURS_WITH]-(candidate:Word)
        WHERE NOT EXISTS { (u)-[:ADDED]->(candidate) }
        WITH candidate, count(DISTINCT known) AS deg, collect(DISTINCT known.lemma)[0..4] AS via
        WHERE deg >= 2
        RETURN candidate.lemma AS word, candidate.cefr AS cefr, deg, via
        ORDER BY deg DESC LIMIT 5
      `, { userId }),
      runQuery(`
        MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)-[:BELONGS_TO]->(t:Topic)
        WITH t.name AS topic, avg(r.retention) AS avgRet, count(w) AS size
        WHERE size >= 2
        RETURN topic, avgRet, size
        ORDER BY avgRet ASC LIMIT 5
      `, { userId }),
      runQuery(`
        MATCH (u:User {id: $userId})-[:ADDED]->(a:Word)-[r:CO_OCCURS_WITH]-(b:Word)<-[:ADDED]-(u)
        WHERE id(a) < id(b)
        RETURN a.lemma AS w1, b.lemma AS w2, r.strength AS s
        ORDER BY r.strength DESC LIMIT 5
      `, { userId }),
    ]);

    const words = wordRecords.map(r => ({
      word: r.get('word'), article: r.get('article'), cefr: r.get('cefr'),
      retention: num(r.get('retention')), reviews: num(r.get('reviews'))
    }));
    const weakWords = weakRecords.map(r => `${r.get('word')} (${num(r.get('retention'))}%)`);
    const bridges = bridgeRecords.map(r => `${r.get('word')} [${r.get('cefr')}] connects ${num(r.get('deg'))} known words via ${(r.get('via') || []).join(', ')}`);
    const clusters = clusterRecords.map(r => `${r.get('topic')}: ${num(r.get('size'))} words, avg retention ${Math.round(num(r.get('avgRet')))}%`);
    const twins = twinRecords.map(r => `${r.get('w1')} ↔ ${r.get('w2')} (×${num(r.get('s'))})`);

    const cefrDist = words.reduce((acc, w) => { acc[w.cefr] = (acc[w.cefr] || 0) + 1; return acc; }, {});

    const context = `You are an AI German language coach built into Wortgraph. You have direct access to the learner's Neo4j graph and you reason about it as a graph, not a list.

THE LEARNER'S GRAPH:
- Words in deck: ${words.length}
- CEFR distribution: ${JSON.stringify(cefrDist)}
- Recent words: ${words.slice(0, 15).map(w => `${w.article} ${w.word} (${w.cefr}, ${w.retention}%)`).join(', ')}
- Weak words: ${weakWords.length ? weakWords.join(', ') : 'none yet'}
- Topic clusters (sorted by weakness): ${clusters.length ? clusters.join(' | ') : 'none yet'}
- Bridge words to add (in graph but not in deck, linking known words): ${bridges.length ? bridges.join(' | ') : 'none yet'}
- Twin pairs (high CO_OCCURS_WITH strength in deck): ${twins.length ? twins.join(', ') : 'none yet'}

HOW TO ANSWER:
- Reason in terms of clusters, bridges, and connections — not just isolated words.
- When you make a recommendation, briefly state WHY using the graph data (e.g. "because it bridges 4 words you already know").
- Be specific. Cite actual words from the data above.
- Be encouraging and concise (under 150 words).
- If asked something the graph can't answer, say so honestly.`;

    const messages = [
      { role: 'system', content: context },
      ...history.slice(-6),
      { role: 'user', content: message }
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.4 })
    });
    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}: ${await groqRes.text()}`);
    const groqData = await groqRes.json();
    res.json({ reply: groqData.choices[0].message.content });
  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Wortgraph server running on :${PORT}`);
  await initSchema();
});

process.on('exit', () => driver.close());
