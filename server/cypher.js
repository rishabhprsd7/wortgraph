/**
 * cypher.js — All Cypher queries used by Wortgraph.
 *
 * Two sets:
 *   INSIGHT_CYPHERS  — 7 named queries that power the AI Coach insight cards.
 *                      Each card also returns its own Cypher so judges/learners
 *                      can see exactly what graph pattern produced the result.
 *
 *   CHAT_CONTEXT     — 5 lightweight queries run before every AI Coach chat
 *                      message to inject live graph state into the system prompt.
 */

// ── Insight cards ─────────────────────────────────────────────────────────────

export const INSIGHT_CYPHERS = {

  /**
   * BRIDGE WORDS
   * Words NOT in the user's deck that co-occur with ≥2 words that ARE.
   * Learning one bridge word instantly connects existing vocabulary clusters.
   * This is the "Aha!" query — it proves the agent reasons about the graph structure.
   */
  bridges: `
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

  /**
   * WEAK CLUSTERS
   * Topics (BELONGS_TO nodes) where average retention is lowest.
   * Targets a comprehension gap in a whole domain, not just single words.
   */
  weakClusters: `
    MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)-[:BELONGS_TO]->(t:Topic)
    WHERE r.reviewCount > 0
    WITH t.name AS topic, avg(r.retention) AS avgRetention,
         count(w) AS size, collect(w.lemma)[0..3] AS sampleWords
    WHERE size >= 3
    RETURN topic, avgRetention, size, sampleWords
    ORDER BY avgRetention ASC
    LIMIT 5
  `,

  /**
   * HIGH-LEVERAGE WEAK WORDS
   * Weak words (retention < 65%) ranked by how many other deck words they co-occur with.
   * Score: reach × (1 − retention). Fixing a high-reach weak word unblocks the most reading.
   */
  centralWeakWords: `
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

  /**
   * TWIN WORDS
   * Pairs of deck words with the highest CO_OCCURS_WITH strength.
   * High strength = they appear together repeatedly across sources — likely collocations.
   */
  twinWords: `
    MATCH (u:User {id: $userId})-[:ADDED]->(a:Word)-[r:CO_OCCURS_WITH]-(b:Word)<-[:ADDED]-(u)
    WHERE id(a) < id(b)
    RETURN a.lemma AS w1, b.lemma AS w2, r.strength AS strength
    ORDER BY r.strength DESC
    LIMIT 5
  `,

  /**
   * STUDY PRIORITY
   * Score = graph_degree × (1 − retention/100).
   * A highly-connected word you barely know outranks an isolated word at the same retention.
   * This is the core "graph-aware spaced repetition" formula.
   */
  studyPriority: `
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

  /**
   * GERMAN WORD FAMILIES
   * Groups deck words by shared German prefix/suffix (ver-, be-, -ung, -keit, etc.).
   * Words in the same family share a root meaning — learning one reinforces the others.
   */
  morphologyFamilies: `
    MATCH (u:User {id: $userId})-[:ADDED]->(w:Word)
    WITH w,
         CASE
           WHEN w.lemma STARTS WITH 'ver'    THEN 'ver-'
           WHEN w.lemma STARTS WITH 'ent'    THEN 'ent-'
           WHEN w.lemma STARTS WITH 'be'     THEN 'be-'
           WHEN w.lemma STARTS WITH 'ge'     THEN 'ge-'
           WHEN w.lemma STARTS WITH 'er'     THEN 'er-'
           WHEN w.lemma ENDS WITH   'ung'    THEN '-ung'
           WHEN w.lemma ENDS WITH   'keit'   THEN '-keit'
           WHEN w.lemma ENDS WITH   'schaft' THEN '-schaft'
           WHEN w.lemma ENDS WITH   'lich'   THEN '-lich'
           WHEN w.lemma ENDS WITH   'los'    THEN '-los'
           ELSE null
         END AS family
    WHERE family IS NOT NULL
    WITH family, collect(w.lemma)[0..5] AS words, count(w) AS size
    WHERE size >= 2
    RETURN family, words, size
    ORDER BY size DESC
    LIMIT 6
  `,

  /**
   * STUCK WORDS
   * Reviewed ≥3 times but retention still below 50%.
   * Rote repetition isn't working — needs a different strategy (mnemonic, sentence writing, etc.)
   */
  stuckWords: `
    MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
    WHERE r.reviewCount >= 3 AND coalesce(r.retention, 0) < 50
    RETURN w.lemma AS word, w.article AS article, w.translation AS translation,
           w.example AS example,
           r.retention AS retention, r.reviewCount AS reviewCount
    ORDER BY r.reviewCount DESC, r.retention ASC
    LIMIT 5
  `,
};

// ── Chat context queries ───────────────────────────────────────────────────────
// Run in parallel before every /api/agent/chat call.
// Results are serialised into the LLM system prompt so the model reasons
// about the user's actual graph state, not generic advice.

export const CHAT_CONTEXT = {

  /** Last 50 words the user added, with retention scores. */
  recentWords: `
    MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
    RETURN w.lemma AS word, w.article AS article, w.cefr AS cefr,
           coalesce(r.retention, 0) AS retention, coalesce(r.reviewCount, 0) AS reviews
    ORDER BY r.addedAt DESC LIMIT 50
  `,

  /** Words the user is struggling with (reviewed but retention < 65%). */
  weakWords: `
    MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
    WHERE r.reviewCount > 0 AND r.retention < 65
    RETURN w.lemma AS word, r.retention AS retention
    ORDER BY r.retention ASC LIMIT 10
  `,

  /** Bridge word candidates — not in deck, but linked to ≥2 deck words. */
  bridges: `
    MATCH (u:User {id: $userId})-[:ADDED]->(known:Word)-[r:CO_OCCURS_WITH]-(candidate:Word)
    WHERE NOT EXISTS { (u)-[:ADDED]->(candidate) }
    WITH candidate, count(DISTINCT known) AS deg, collect(DISTINCT known.lemma)[0..4] AS via
    WHERE deg >= 2
    RETURN candidate.lemma AS word, candidate.cefr AS cefr, deg, via
    ORDER BY deg DESC LIMIT 5
  `,

  /** Topic clusters sorted by average retention (weakest first). */
  clusters: `
    MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)-[:BELONGS_TO]->(t:Topic)
    WITH t.name AS topic, avg(r.retention) AS avgRet, count(w) AS size
    WHERE size >= 2
    RETURN topic, avgRet, size
    ORDER BY avgRet ASC LIMIT 5
  `,

  /** Top co-occurring word pairs already in the deck. */
  twins: `
    MATCH (u:User {id: $userId})-[:ADDED]->(a:Word)-[r:CO_OCCURS_WITH]-(b:Word)<-[:ADDED]-(u)
    WHERE id(a) < id(b)
    RETURN a.lemma AS w1, b.lemma AS w2, r.strength AS s
    ORDER BY r.strength DESC LIMIT 5
  `,
};

/**
 * The system prompt injected into every AI Coach chat.
 * Graph context (from CHAT_CONTEXT queries) is interpolated at request time.
 */
export function buildSystemPrompt({ words, weakWords, clusters, bridges, twins }) {
  const cefrDist = words.reduce((acc, w) => { acc[w.cefr] = (acc[w.cefr] || 0) + 1; return acc; }, {});

  return `You are an AI German language coach built into Wortgraph. You have direct access to the learner's Neo4j graph and you reason about it as a graph, not a list.

THE LEARNER'S GRAPH:
- Words in deck: ${words.length}
- CEFR distribution: ${JSON.stringify(cefrDist)}
- Recent words: ${words.slice(0, 15).map(w => `${w.article} ${w.word} (${w.cefr}, ${w.retention}%)`).join(', ')}
- Weak words: ${weakWords.length ? weakWords.join(', ') : 'none yet'}
- Topic clusters (sorted by weakness): ${clusters.length ? clusters.join(' | ') : 'none yet'}
- Bridge words (not in deck, linking known clusters): ${bridges.length ? bridges.join(' | ') : 'none yet'}
- Twin pairs (high CO_OCCURS_WITH strength): ${twins.length ? twins.join(', ') : 'none yet'}

HOW TO ANSWER:
- Reply in 2-4 short bullet points (use • as the bullet character).
- Wrap every German word you mention in **double asterisks** so it renders bold.
- Each bullet: one concrete insight or action, max 20 words.
- State WHY using the graph data (e.g. "bridges 4 known words").
- Never write flowing paragraphs — bullets only.
- If asked something the graph can't answer, say so in one bullet.`;
}
