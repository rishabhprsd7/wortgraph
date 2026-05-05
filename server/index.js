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

// Initialize schema constraints on startup
async function initSchema() {
  try {
    await runQuery('CREATE CONSTRAINT word_unique IF NOT EXISTS FOR (w:Word) REQUIRE w.lemma IS UNIQUE');
    await runQuery('CREATE CONSTRAINT topic_unique IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE');
    await runQuery('CREATE CONSTRAINT user_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE');
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
  const { words, source = 'Unknown', userId = 'default' } = req.body;
  if (!Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'words array required' });
  }

  try {
    // Ensure user exists
    await runQuery(
      'MERGE (u:User {id: $userId}) ON CREATE SET u.createdAt = timestamp()',
      { userId }
    );

    // Ensure source node
    const sourceId = `${source}-${Date.now()}`;
    await runQuery(
      'MERGE (s:Source {id: $sourceId}) ON CREATE SET s.type = $type, s.addedAt = timestamp()',
      { sourceId, type: source }
    );

    // Upsert each word and link to user + source
    for (const w of words) {
      await runQuery(`
        MERGE (word:Word {lemma: $lemma})
        ON CREATE SET word.article = $article, word.cefr = $cefr, word.addedAt = timestamp()
        ON MATCH SET word.cefr = $cefr
        WITH word
        MATCH (u:User {id: $userId}), (s:Source {id: $sourceId})
        MERGE (u)-[r:ADDED]->(word)
        ON CREATE SET r.addedAt = timestamp(), r.reviewCount = 0, r.retention = 0
        MERGE (word)-[:EXTRACTED_FROM]->(s)
      `, { lemma: w.word, article: w.article || '', cefr: w.cefr || 'B1', userId, sourceId });
    }

    res.json({ saved: words.length });
  } catch (e) {
    console.error('Save words error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get user's word deck
// GET /api/words?userId=default
app.get('/api/words', async (req, res) => {
  const { userId = 'default' } = req.query;
  try {
    const records = await runQuery(`
      MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
      RETURN w.lemma AS word, w.article AS article, w.cefr AS cefr,
             r.reviewCount AS reviewCount, r.retention AS retention,
             r.addedAt AS addedAt
      ORDER BY r.addedAt DESC
    `, { userId });

    const words = records.map(r => ({
      word: r.get('word'),
      article: r.get('article'),
      cefr: r.get('cefr'),
      reviewCount: r.get('reviewCount')?.toNumber?.() ?? 0,
      retention: r.get('retention')?.toNumber?.() ?? 0,
    }));
    res.json(words);
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

// AI Agent: conversational chat with Neo4j context
// POST /api/agent/chat  { userId, message, history: [{role, content}] }
app.post('/api/agent/chat', async (req, res) => {
  const { userId = 'default', message, history = [] } = req.body;
  const groqKey = process.env.GROQ_KEY;
  if (!groqKey) return res.status(500).json({ error: 'GROQ_KEY not set on server' });

  try {
    // Pull graph context from Neo4j
    const [wordRecords, weakRecords] = await Promise.all([
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
      `, { userId })
    ]);

    const words = wordRecords.map(r => ({
      word: r.get('word'), article: r.get('article'), cefr: r.get('cefr'),
      retention: r.get('retention')?.toNumber?.() ?? 0,
      reviews: r.get('reviews')?.toNumber?.() ?? 0
    }));
    const weakWords = weakRecords.map(r => `${r.get('word')} (${r.get('retention')?.toNumber?.() ?? 0}%)`);

    const cefrDist = words.reduce((acc, w) => { acc[w.cefr] = (acc[w.cefr] || 0) + 1; return acc; }, {});

    const context = `You are an AI German language coach built into Wortgraph, a vocabulary learning app.
You have access to the learner's Neo4j graph database. Here is their current data:

Total words in deck: ${words.length}
CEFR distribution: ${JSON.stringify(cefrDist)}
Recent words: ${words.slice(0, 20).map(w => `${w.article} ${w.word} (${w.cefr}, ${w.retention}% retention)`).join(', ')}
Weak words needing review: ${weakWords.length > 0 ? weakWords.join(', ') : 'none'}

Answer the learner's question concisely. If they ask about specific words, use their actual graph data above.
If they ask for suggestions, base them on gaps in their CEFR distribution.
Keep responses under 150 words. Be encouraging and specific.`;

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
