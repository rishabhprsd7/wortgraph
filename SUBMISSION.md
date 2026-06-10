# Wortgraph — submission post

> Paste this as a reply to the hackathon thread, with **Wortgraph** as the title.
> Replace the two screenshot placeholders and the links before posting.

---

## Agent Name
**Wortgraph Coach**

## What it does

Wortgraph turns the German you actually read — an article, a YouTube transcript,
a news story — into a personal Neo4j knowledge graph, then coaches you over it as
a graph instead of a flat word list.

The short version: every vocabulary app stores your words as a list. But the
human mental lexicon isn't a list — it's a network, where you recall a word by
travelling from a concept to its neighbours. Rote flashcards fail precisely
because they drill isolated word→translation pairs instead of that network.
**Wortgraph stores your vocabulary the way your brain actually stores it**, and
the agent reasons over that structure to answer questions a flashcard app
structurally cannot:

- *"What should I learn next?"* → the **bridge word** that connects two clusters
  you already know (learn one word, link a whole region of your vocabulary).
- *"Which weak word do I review first, and why?"* → the low-retention word that
  unblocks the most other words — ranked by connectivity, not just by score.
- *"What am I actually bad at?"* → the weakest **topic cluster**, a whole domain
  collapsing, not one stray word.
- *"Words about making a decision?"* → semantic recall over meaning, returning
  **Beschluss, Entscheidung, beschließen** — not a keyword match.

Every recommendation is justified by the relationship path that produced it
("learn **Verhandlung** — it bridges 4 words you know: **Vertrag, Konferenz,
Politik, Abkommen**"), so the agent shows its work instead of hiding it.

## Dataset and why a graph fits

**Dataset:** the learner's own reading. You paste German text or a YouTube URL;
an LLM extracts the words worth learning, each one is verified against the
**Wiktionary API + the DWDS corpus** (so the graph never teaches a hallucinated
word), and the extraction grows the graph. A **Graph-RAG** pipeline then enriches
it: candidates are retrieved from the `word_embeddings` vector index (3072-dim,
gemini-embedding-001), an LLM classifies each as synonym / antonym / derived
form grounded in the learner's *real* deck, and the typed edges are written back.

**Why a graph fits — the bridge-word insight.** The flagship feature only exists
as a traversal. A "bridge word" is a word you *don't* know that co-occurs with
two or more words you *do* know:

```cypher
MATCH (u:User {id:'default'})-[:ADDED]->(known:Word)
MATCH (known)-[:CO_OCCURS_WITH]-(candidate:Word)
WHERE NOT EXISTS { (u)-[:ADDED]->(candidate) }
WITH candidate, count(DISTINCT known) AS bridgeDegree,
     collect(DISTINCT known.lemma)[0..5] AS connectedTo
WHERE bridgeDegree >= 2
RETURN candidate.lemma, bridgeDegree, connectedTo
ORDER BY bridgeDegree DESC LIMIT 5
```

That is one `MATCH` in Cypher. In SQL it's a self-join over a co-occurrence
table with a `NOT EXISTS` anti-join and a `HAVING count >= 2` — and it gets worse
with every hop. The feature *is* the graph pattern.

Same story for graph-aware spaced repetition: `study_priority` ranks words by
`degree × (1 − retention)`, so a highly-connected word you barely know outranks
an isolated one at the same score — a centrality computation over your personal
subgraph that a table can't express.

**Schema:**
```
(:User)-[:ADDED {retention, reviewCount}]->(:Word {lemma, article, cefr, translation, embedding[3072]})
(:Word)-[:CO_OCCURS_WITH {strength}]-(:Word)
(:Word)-[:BELONGS_TO]->(:Topic)
(:Word)-[:MEANS]->(:Meaning {en})
(:Word)-[:SYNONYM_OF|ANTONYM_OF|FORM_OF {confidence, reason}]->(:Word)
```

**Agent tools (all three types):** 10 **Cypher Templates** — bridge words, study
priority, weak words, weak topic clusters, stuck words, word pairs (collocations),
word families, recent words, CEFR distribution, and a parameterized
words-by-article tool whose `$article` argument the LLM fills from conversation —
plus **Similarity Search** over `word_embeddings` (gemini-embedding-001, 3072-dim)
and a **Text2Cypher** fallback.

## Why it was possible only with Neo4j

1. **Game/coaching logic is graph pattern-matching.** "An unknown word adjacent
   to ≥2 known words" and "3 words sharing a meaning + 1 outlier" are single
   Cypher matches; in SQL they're recursive joins that rot with each hop.
2. **Graph-RAG in one round trip.** The relation pipeline calls
   `db.index.vector.queryNodes('word_embeddings', …)` and traverses the learner's
   `ADDED` edges **in the same query** — vector similarity and graph filtering in
   one place. A relational DB + separate vector store would need two systems and a
   round-trip join.
3. **The graph is the interface.** The Clusters view renders the database itself
   — you're looking at your own lexicon as a growing web. You can't make a SQL
   schema a learning surface; a knowledge graph carries the meaning in its shape.

## The wow factor
Click any word in the Clusters view and watch it pull its semantic
neighbours into the web in real time. Then ask the Coach "what should I learn
next?" and it answers with a single word that wires four of your existing words
together — and tells you which four. The recommendation and its justification
come from the same traversal.

## The emotional factor
Every adult learner knows the specific despair of forgetting a word you *just*
studied — like pouring effort into a bucket with no bottom. Wortgraph reframes
forgetting: it's not random failure, it's a thin spot in your web that you can
*see* and strengthen. The first time your scattered word-list resolves into a map
of your own mind, the message lands: you were never bad at this — your tool was
storing your effort wrong.

## How it helps the world
~1.5 billion people are learning a language right now, and retention is the #1
reason they quit. The approach is language-agnostic — swap the corpus and it
works for any language — and it matters most exactly where it matters most:
immigrants and refugees who need functional vocabulary fast and can't afford for
it to leak away.

## Screenshots
1. *[Aura console — the Wortgraph Coach agent with its 12 tools listed]*
2. *[Aura console — the agent answering "What should I learn next?", calling
   `find_bridge_words` and citing the bridged words]*
3. *[Neo4j Browser — `MATCH p=(:Word)-[:CO_OCCURS_WITH]-(:Word) RETURN p LIMIT 60`,
   the vocabulary network]*

## Links
- **Live app:** https://wortgraph-1.onrender.com
- **Repo:** https://github.com/rishabhprsd7/wortgraph

## Stack
Neo4j Aura Free (graph + `word_embeddings` vector index) · Aura Agent (Cypher
Templates, Similarity Search, Text2Cypher) · Gemini `gemini-embedding-001`
(3072-dim) · Groq LLaMA 3.3 70B (extraction + Graph-RAG classification) · Express
· React + Vite · Wiktionary + DWDS verification.
