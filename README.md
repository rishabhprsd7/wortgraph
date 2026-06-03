# Wortgraph — Graph-Powered German Vocabulary Learning

**Neo4j Hackathon 2026 Submission** · Built with Neo4j Aura, React, and Express

Wortgraph is a vocabulary learning app that treats your German words as a **graph**, not a list. Every word you save is linked to others it appeared with (CO_OCCURS_WITH), grouped into topic clusters (BELONGS_TO), and scored by how well you know it. The result: an AI coach that reasons about *connections* — not just isolated words.

**Live demo:** https://wortgraph-1.onrender.com · sign in with any name, or click "Try with demo data"

---

## For Judges — start here

| What you want to see | File | What's there |
|---|---|---|
| Neo4j connection + graph schema | [`server/db.js`](server/db.js) | Driver setup, `runQuery`, Gemini embeddings, schema constraints + vector index |
| All 7 Cypher insight queries | [`server/cypher.js`](server/cypher.js) | Bridge words, weak clusters, study priority, twin pairs, word families, stuck words — each with an explanation comment |
| AI Coach system prompt | [`server/cypher.js`](server/cypher.js) → `buildSystemPrompt()` | The LLM prompt that injects live graph context |
| API routes | [`server/index.js`](server/index.js) | All Express routes — clean, one concern per route |
| Vocab extraction (Groq AI) | [`src/components/Extract.jsx`](src/components/Extract.jsx) | Paste German text → LLM extracts B1+ vocabulary as JSON |
| AI Coach frontend | [`src/components/Agent.jsx`](src/components/Agent.jsx) | Insight cards + conversational chat |
| Arena game hub | [`src/components/Arena.jsx`](src/components/Arena.jsx) | 6 games powered by Neo4j vector search + Groq planner agent |
| Game registry | [`src/games/registry.js`](src/games/registry.js) | Uniform contract: Odd-One-Out, Synonym Sprint, Fill-Blank, Match, Der/Die/Das, Crossword |
| Demo dataset | [`server/seed.js`](server/seed.js) | 57 words across 7 topics + 18 bridge candidates + Graph-RAG relations |

### The "Aha!" query — Bridge Words

```cypher
// Words NOT in your deck that connect ≥2 clusters you already know.
// e.g. "Beschluss" bridges Politik + Wirtschaft — learning one word strengthens two clusters.
MATCH (u:User {id: $userId})-[:ADDED]->(known:Word)
MATCH (known)-[r:CO_OCCURS_WITH]-(candidate:Word)
WHERE NOT EXISTS { (u)-[:ADDED]->(candidate) }
WITH candidate, count(DISTINCT known) AS bridgeDegree, sum(r.strength) AS totalStrength,
     collect(DISTINCT known.lemma)[0..5] AS connectedTo
WHERE bridgeDegree >= 2
RETURN candidate.lemma AS word, candidate.cefr AS cefr,
       bridgeDegree, totalStrength, connectedTo
ORDER BY bridgeDegree DESC, totalStrength DESC LIMIT 5
```

---

## What makes it different

Most vocabulary apps treat words as independent flashcards. Wortgraph builds a knowledge graph:

- **Bridge words** — words not yet in your deck that connect 2+ clusters you already know. Learning one strengthens your whole network.
- **Weak clusters** — topics where your retention is lowest as a group, not just single words.
- **Study priority** — ranked by `graph_degree × (1 − retention)`. A highly-connected word you barely know outranks an isolated word at the same retention.
- **Word families** — German morphology groups (ver-, be-, -ung, -keit) auto-detected from your deck.
- **Semantic search** — type a concept in English or German, find related words by meaning via vector embeddings.

---

## Neo4j Features Used

### 1. Cypher Template Tools
Seven pre-built graph queries power the insight panels:
- Bridge words (CO_OCCURS_WITH traversal, 2-hop)
- Weak topic clusters (BELONGS_TO aggregation)
- High-leverage weak words (centrality × retention)
- Twin word pairs (high co-occurrence strength)
- Study priority score (degree × retention formula)
- German word families (prefix/suffix pattern matching)
- Stuck words (reviewed ≥3×, retention <50%)

Each card shows the Cypher query behind the result — judges and learners can inspect the graph logic.

### 2. Text2Cypher (Conversational Coach)
The "Ask your coach" panel fetches live Neo4j context (deck, retention, bridges, clusters, twin pairs) and passes it to a Groq LLaMA model. The model reasons about the graph structure and returns bullet-point recommendations citing specific words from your data.

### 3. Similarity Search (Vector Embeddings)
Words are embedded using **Gemini gemini-embedding-001** (3072-dim) and stored on Word nodes. A Neo4j vector index (`word_embeddings`, cosine similarity) powers semantic search — type "political decisions" and get *Beschluss*, *Gesetzgebung*, *Abstimmung* ranked by meaning, not keyword match.

### 4. Arena — Graph-Powered Games
Six vocabulary games driven by Neo4j vector similarity:
- **Odd One Out** — 3 semantically close words + 1 outlier, live from the vector index
- **Synonym Sprint** — pick the nearest neighbor vs. far distractors
- **Fill the Blank** — real example sentence, embedding-based distractors
- **Match** — pair German words to translations (deck-based)
- **Der/Die/Das** — article challenge with color-coded feedback
- **Crossword** — AI-generated puzzle from your deck

Each game card shows the Cypher query that powered it — so the graph connection is always visible.

### 5. Graph-RAG — Word Relations
When a word is saved, a retrieval-augmented pipeline classifies its relationships:
1. **Retrieve** — query the Neo4j vector index for the word's top-20 nearest neighbors *within the user's own deck*
2. **Classify** — pass each candidate (with translation + example) to Groq, which labels it `synonym` / `antonym` / `form_of` / `unrelated` + confidence
3. **Write back** — edges above 0.75 confidence become `SYNONYM_OF`, `ANTONYM_OF`, `FORM_OF` relationships

Because retrieval grounds the LLM in real words from the deck, it cannot hallucinate fake synonyms — the candidate set is the constraint. The flashcard back surfaces these as color-coded pills (synonyms green, antonyms red, forms violet). See [`server/relations.js`](server/relations.js).

### 6. Concepts — Meaning Hubs
A `(:Meaning {en})` node is a single English concept; every German word that expresses it links via `(:Word)-[:MEANS]->(:Meaning)`. This turns a flat word list into a **hub-and-spoke semantic graph** — one English meaning in the centre (e.g. *"decision"*), all the German ways to say it radiating out (*Beschluss, Entscheidung, Entschluss*), interconnected by the synonym/form edges from feature #5.

Groq clusters the user's words by shared meaning (grounded in their real translations, whitelist-checked against the deck), then the **Concepts** tab renders each hub as an interactive force-directed graph. Click any German word to pull in the *other* meanings it belongs to — the graph grows as you explore. See [`server/meanings.js`](server/meanings.js) and [`src/components/Concepts.jsx`](src/components/Concepts.jsx).

---

## Graph Schema

```
(:User)-[:ADDED {retention, reviewCount}]->(:Word)
(:Word)-[:CO_OCCURS_WITH {strength}]-(:Word)
(:Word)-[:BELONGS_TO]->(:Topic)
(:Word)-[:EXTRACTED_FROM]->(:Source)
(:Word)-[:SYNONYM_OF {confidence, reason}]->(:Word)   // Graph-RAG
(:Word)-[:ANTONYM_OF {confidence, reason}]->(:Word)   // Graph-RAG
(:Word)-[:FORM_OF    {confidence, reason}]->(:Word)   // Graph-RAG
(:Word)-[:MEANS]->(:Meaning {en})                     // Concept hubs
```

---

## Running Locally

### Prerequisites
- Node.js 18+
- Neo4j Aura account (free tier works)
- Groq API key (free at console.groq.com)
- Gemini API key (free at aistudio.google.com) — optional, enables semantic search

### Server setup
```bash
cd server
cp .env.example .env   # fill in your keys
npm install
node index.js
```

### Server `.env`
```
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
GROQ_KEY=gsk_...           # server-only — proxied via /api/groq/chat, never sent to the browser
GEMINI_KEY=AIza...         # optional
ADMIN_KEY=some-long-secret # required to call the admin wipe/seed endpoints
PORT=3001
FRONTEND_URL=http://localhost:5173
```

The frontend no longer holds the Groq key. All LLM calls go through the server
proxy (`POST /api/groq/chat`), so the key stays private. The destructive admin
endpoints (`/api/admin/clear`, `/api/admin/seed-bridges`) require the
`x-admin-key` header to match `ADMIN_KEY`.

### Seed demo data
```bash
cd server
ADMIN_KEY=some-long-secret node seed.js   # ADMIN_KEY must match the server's
```

Inserts 57 curated German words across 7 topics (Politik, Klima, Wirtschaft, Gesellschaft, Technologie, Gesundheit, Debatte) with simulated retention data covering all insight panels, then runs the Graph-RAG pipeline to build synonym/antonym/form_of edges. The Debatte batch is chosen to surface clear relations (e.g. *Vorteil*↔*Nachteil* antonyms, *entscheiden*↔*Entscheidung* forms).

### Frontend setup
```bash
# in project root
npm install
echo "VITE_API_URL=http://localhost:3001" > .env
npm run dev
```

Open http://localhost:5173

---

## Architecture

```
Browser (React + Vite)
    │
    ▼
Express server (Node.js)
    ├── Neo4j Bolt driver → Neo4j Aura (graph queries)
    ├── Gemini API → word embeddings (3072-dim)
    └── Groq API → LLaMA 3.3 70B (coach chat)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/index.js` | All API routes — graph queries, embeddings, chat |
| `server/seed.js` | Demo dataset with realistic retention simulation |
| `src/components/Agent.jsx` | All AI features: insights, semantic search, coach |
| `src/components/Graph.jsx` | Force-directed vocabulary graph visualisation |
| `src/components/Extract.jsx` | Paste text → extract vocabulary with Groq |
| `src/components/Flashcards.jsx` | Spaced repetition review with retention tracking |
| `src/components/Arena.jsx` | Arena hub: NL planner agent + 6 graph-powered games |
| `src/games/` | Game modules: ChoiceRound UI, oddOneOut, synonym, fillBlank, article, match |
