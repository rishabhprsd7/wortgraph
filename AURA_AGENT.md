# Building the Wortgraph Coach in Aura Agent

> **STATUS: BUILT & PUBLISHED.** The agent exists in the Aura console with all
> tools below, is published behind the invoke API (see `server/auraAgent.js`),
> and is exposed as an MCP server. One difference from this runbook: the live
> agent scopes its templates to **`userId: 'demo'`** (the seeded, judged deck)
> rather than `'default'` — read `'default'` as `'demo'` throughout.

This is the build runbook that turns Wortgraph from "a web app that uses AuraDB"
into a **qualifying Aura Agent** — an agent that lives in the Neo4j Aura console
and reasons over the graph through registered tools.

It uses the **real** Wortgraph schema and the **real** queries from
`server/cypher.js`. Nothing here is invented — every tool below is one of the
insight queries the app already runs, lifted into an Aura Agent tool.

> Why this is needed: the hackathon rules require an agent built in **Aura Agent**
> with **at least one tool** of type *Cypher Template*, *Text2Cypher*, or
> *Similarity Search*. Today the app calls Neo4j directly from Express and does
> the reasoning in Groq — Aura is "just the database." This runbook closes that
> gap. The tools below check the **all three tool types, used strategically** box
> the judges explicitly reward.

---

## The graph it reasons over (real schema)

```
(:User {id})-[:ADDED {retention, reviewCount, addedAt}]->(:Word {lemma, article, cefr, translation, example, embedding[3072]})
(:Word)-[:CO_OCCURS_WITH {strength}]-(:Word)     // words seen together across sources
(:Word)-[:BELONGS_TO]->(:Topic {name})
(:Word)-[:MEANS]->(:Meaning {id, en})            // shared-meaning hub
(:Word)-[:SYNONYM_OF {confidence, reason}]->(:Word)
(:Word)-[:ANTONYM_OF {confidence, reason}]->(:Word)
(:Word)-[:FORM_OF    {confidence, reason}]->(:Word)
```

Vector index: `word_embeddings` on `Word.embedding`, 3072-dim, cosine
(gemini-embedding-001).

> **Demo note:** the app is single-user, so every query is scoped to
> `userId = 'default'`. The templates below hardcode `'default'` so the agent
> never has to supply a userId it couldn't know. For a multi-user deployment,
> swap the literal `'default'` for a `$userId` string parameter.

---

## Step 1 — Create the agent

In the Aura console → **Agents** → **Create agent**.

- **Name:** `Wortgraph Coach`
- **Model:** any supported chat model (GPT-4o / Gemini / Claude — whatever your
  project has enabled).
- **System instructions:**

```
You are the Wortgraph Coach, a German-vocabulary tutor with read access to a
learner's personal Neo4j knowledge graph. The graph is built from German texts
the learner actually read: words they added, how often those words co-occur
(CO_OCCURS_WITH), the topics they belong to (BELONGS_TO), shared-meaning hubs
(MEANS), and synonym/antonym/derived-form edges.

Always reason about this as a GRAPH, not a word list. When you recommend a word
to study, justify it with the relationship path that makes it matter — e.g.
"learn Verhandlung: it bridges 4 words you already know (Vertrag, Konferenz,
Politik, Abkommen)". Prefer:
  - bridge words (unknown words that connect clusters the learner already knows),
  - high-leverage weak words (low retention AND high connectivity),
  - weak topic clusters (a whole domain collapsing, not one word).

Use the tools to ground every answer in the learner's real graph. Never invent
German words. Reply in short bullet points; wrap every German word in **bold**.
If the graph can't answer something, say so plainly.
```

---

## Step 2 — Add the Cypher Template tools (the core — this is what qualifies you)

Each tool below is taken verbatim from `server/cypher.js` with `$userId`
replaced by the literal `'default'`. Add each one as a **Cypher Template** tool.
The **description** is what the agent reads to decide when to call the tool —
keep it action-oriented.

### Tool 1 — `find_bridge_words` ⭐ (the "aha" query — demo this one)
**Description:** Find words the learner does NOT know yet that co-occur with two
or more words they DO know. Learning one bridge word instantly connects existing
vocabulary clusters. Use when the learner asks what to learn next.
```cypher
MATCH (u:User {id: 'default'})-[:ADDED]->(known:Word)
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
```

### Tool 2 — `find_high_leverage_weak_words`
**Description:** Weak words (retention < 65%) ranked by how many other deck words
they connect to. Fixing a high-reach weak word unblocks the most reading. Use
when the learner asks which weak word to review first.
```cypher
MATCH (u:User {id: 'default'})-[r:ADDED]->(w:Word)
WHERE r.reviewCount > 0 AND r.retention < 65
OPTIONAL MATCH (w)-[c:CO_OCCURS_WITH]-(neighbor:Word)<-[:ADDED]-(u)
WITH w, r.retention AS retention, count(DISTINCT neighbor) AS reach
WHERE reach > 0
RETURN w.lemma AS word, w.article AS article, w.translation AS translation,
       retention, reach
ORDER BY reach DESC, retention ASC
LIMIT 5
```

### Tool 3 — `find_weak_clusters`
**Description:** Topics where average retention is lowest — a whole comprehension
domain collapsing, not just one word. Use when the learner asks what they're bad at.
```cypher
MATCH (u:User {id: 'default'})-[r:ADDED]->(w:Word)-[:BELONGS_TO]->(t:Topic)
WHERE r.reviewCount > 0
WITH t.name AS topic, avg(r.retention) AS avgRetention,
     count(w) AS size, collect(w.lemma)[0..3] AS sampleWords
WHERE size >= 3
RETURN topic, avgRetention, size, sampleWords
ORDER BY avgRetention ASC
LIMIT 5
```

### Tool 4 — `study_priority` (graph-aware spaced repetition)
**Description:** Ranks words by degree-centrality × (1 − retention). A
highly-connected word the learner barely knows outranks an isolated word at the
same retention. Use for "what should I study today".
```cypher
MATCH (u:User {id: 'default'})-[r:ADDED]->(w:Word)
OPTIONAL MATCH (w)-[:CO_OCCURS_WITH]-(neighbor:Word)<-[:ADDED]-(u)
WITH w, coalesce(r.retention, 0) AS retention, count(DISTINCT neighbor) AS degree
WHERE degree > 0
WITH w, retention, degree, degree * (1.0 - retention / 100.0) AS score
RETURN w.lemma AS word, w.article AS article, w.translation AS translation,
       retention, degree, round(score * 10) / 10 AS score
ORDER BY score DESC
LIMIT 5
```

### Tool 5 — `find_twin_words`
**Description:** Word pairs with the highest CO_OCCURS_WITH strength — likely
collocations that should be practised as a unit. Use when asked about word pairs
or phrases.
```cypher
MATCH (u:User {id: 'default'})-[:ADDED]->(a:Word)-[r:CO_OCCURS_WITH]-(b:Word)<-[:ADDED]-(u)
WHERE id(a) < id(b)
RETURN a.lemma AS w1, b.lemma AS w2, r.strength AS strength
ORDER BY r.strength DESC
LIMIT 5
```

### Tool 6 — `word_families`
**Description:** Groups deck words by shared German prefix/suffix (ver-, be-,
-ung, -keit, …). Words in a family share a root — learning one reinforces the
others. Use for morphology questions.
```cypher
MATCH (u:User {id: 'default'})-[:ADDED]->(w:Word)
WITH w, CASE
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
  ELSE null END AS family
WHERE family IS NOT NULL
WITH family, collect(w.lemma)[0..5] AS words, count(w) AS size
WHERE size >= 2
RETURN family, words, size
ORDER BY size DESC
LIMIT 6
```

### Tool 7 — `stuck_words`
**Description:** Words reviewed 3+ times but still below 50% retention — rote
repetition isn't working, suggest a different strategy. Use when the learner is
frustrated about forgetting.
```cypher
MATCH (u:User {id: 'default'})-[r:ADDED]->(w:Word)
WHERE r.reviewCount >= 3 AND coalesce(r.retention, 0) < 50
RETURN w.lemma AS word, w.article AS article, w.translation AS translation,
       w.example AS example, r.retention AS retention, r.reviewCount AS reviewCount
ORDER BY r.reviewCount DESC, r.retention ASC
LIMIT 5
```

---

## Step 3 — Add a Similarity Search tool (semantic recall)

In the agent → **Add tool** → **Similarity Search**.

- **Vector index:** `word_embeddings`
- **Node label / property:** `Word.embedding`
- **Returns:** `lemma`, `translation`, `cefr`, `example`
- **Description:** "Find words by MEANING rather than spelling — e.g. 'words about
  making a decision' returns Beschluss, Entscheidung, beschließen. Use when the
  learner describes a concept instead of naming a word."

> ⚠️ **Embedding-model match matters.** The index was built with
> `gemini-embedding-001` (3072-dim). Aura's similarity search must embed the
> query with the **same** model, or cosine scores are meaningless. If your Aura
> project can't run gemini-embedding-001, either (a) rebuild the index with an
> embedding model Aura *can* run, or (b) skip this tool — the **seven Cypher
> Templates above already satisfy the tool requirement** and showcase the
> multi-hop reasoning judges reward. Demo similarity in the web app instead.

---

## Step 4 — Add a Text2Cypher fallback (open-ended questions)

In the agent → **Add tool** → **Text2Cypher**, and give it the schema from the
top of this file so it generates valid queries. **Description:** "Fallback for
questions the templates don't cover — generates a Cypher query from the schema."

This completes the set: **7 Cypher Templates + 1 Similarity Search + 1
Text2Cypher = all three tool types.**

---

## Step 5 — Test prompts (use these in the console, screenshot the good ones)

| Ask the agent | Expects tool | Good answer proves |
|---|---|---|
| "What should I learn next?" | `find_bridge_words` | graph reasoning — a word that connects clusters |
| "Which weak word should I review first and why?" | `find_high_leverage_weak_words` | "why" = connectivity, not just low score |
| "What am I worst at?" | `find_weak_clusters` | reasons at the topic level |
| "Give me today's study list." | `study_priority` | centrality × forgetting formula |
| "Words about making a decision?" | `find_similar_words` | semantic recall, not keyword |
| "How many words do I have per CEFR level?" | Text2Cypher | open-ended fallback works |

---

## Step 6 — Screenshots to capture for the submission

1. **Aura console — the agent with its tool list visible** (the 7 templates +
   similarity + text2cypher). *Required: "screenshot of your agent in the Aura
   console."*
2. **Aura console — the agent answering "What should I learn next?"**, showing it
   called `find_bridge_words` and cited the bridged words. *Required: "agent in
   action."*
3. **Neo4j Browser/Bloom — the graph itself:** run
   `MATCH p=(:Word)-[:CO_OCCURS_WITH]-(:Word) RETURN p LIMIT 60` and screenshot
   the network. This makes the "vocabulary is a graph" thesis literal.
4. **Web app — Clusters/Insights view** with a "Show Cypher" panel open, proving
   the same query runs in the product.

---

## What stays in the web app

The web app remains the **live demo**: extraction from real German text/YouTube,
the graph visualisation, flashcards that update retention. The Aura Agent is the
**reasoning layer** the hackathon asks for, built on the exact same graph. Two
faces, one graph — same pattern as the featured submissions (Streamlit UI + Aura
agent).

Optional follow-up: point the web app's "AI Coach" tab at the Aura Agent API
instead of the hand-rolled Groq prompt, so the product and the submission use the
identical agent. Not required to qualify.
