# Wortgraph — Graph-Powered German Vocabulary Learning

**Neo4j Hackathon Submission** · Built with Neo4j Aura, React, and Express

Wortgraph is a vocabulary learning app that treats your German words as a **graph**, not a list. Every word you save is linked to others it appeared with (CO_OCCURS_WITH), grouped into topic clusters (BELONGS_TO), and scored by how well you know it. The result: an AI coach that reasons about *connections* — not just isolated words.

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

---

## Graph Schema

```
(:User)-[:ADDED {retention, reviewCount}]->(:Word)
(:Word)-[:CO_OCCURS_WITH {strength}]-(:Word)
(:Word)-[:BELONGS_TO]->(:Topic)
(:Word)-[:EXTRACTED_FROM]->(:Source)
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
GROQ_KEY=gsk_...
GEMINI_KEY=AIza...   # optional
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Seed demo data
```bash
cd server
node seed.js
```

Inserts 48 curated German words across 6 topics (Politik, Klima, Wirtschaft, Gesellschaft, Technologie, Gesundheit) with simulated retention data covering all insight panels.

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
