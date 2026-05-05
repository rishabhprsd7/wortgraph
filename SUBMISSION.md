# Wortgraph — Hackathon Submission

> A vocabulary graph that grows from the German texts you actually read,
> with an AI coach that reasons over it as a graph — not a list.

---

## Tagline (≤140 chars)

**Wortgraph turns the German articles you read into a personal Neo4j vocabulary graph, then coaches you using bridge-word and cluster traversal.**

---

## One-paragraph description

Most vocabulary apps drill you on a static word list. Wortgraph does the opposite: you paste German articles you're actually reading, an LLM extracts the words worth learning, and every extraction grows a personal Neo4j graph — `(User)-[:ADDED]->(Word)-[:CO_OCCURS_WITH]-(Word)-[:BELONGS_TO]->(Topic)`. An AI coach then traverses that graph to surface **bridge words** (words you don't know that connect two clusters you do know), **weak topic clusters**, and **high-leverage weak words** (low-retention words connected to many others in your deck). Every recommendation comes with the Cypher query that produced it, so the reasoning is visible, not hidden.

---

## Why this is graph-native (not just stored in a graph)

A relational schema would have given us CRUD over `users`, `words`, and `sources`. The interesting features only exist as graph traversals:

| Feature | Cypher pattern | Why it needs a graph |
|---|---|---|
| **Bridge words** | `(known)-[:CO_OCCURS_WITH]-(missing)-[:CO_OCCURS_WITH]-(known)` | Walks through the user's vocabulary neighborhood to find words missing between two clusters they already know. |
| **Weak topic clusters** | `(u)-[r:ADDED]->(w)-[:BELONGS_TO]->(t)` aggregated by topic | Pivots through the topic relationship to find collapsing comprehension regions, not isolated weak words. |
| **High-leverage weak words** | weak `w` with `count(neighbor)` over `CO_OCCURS_WITH` | Computes degree-centrality on the *user's subgraph* so the agent can recommend the single review that unblocks the most other words. |
| **Twin words** | `(a)-[r:CO_OCCURS_WITH]-(b)` where `r.strength` is high | Finds collocational pairs that should be practised as a unit — emerges from edge weight. |
| **Personal graph view** | `MATCH (u)-[:ADDED]->(a:Word)-[r:CO_OCCURS_WITH]-(b:Word)<-[:ADDED]-(u)` | The visualization is the graph projected to the user's deck — strength filterable, recolourable by Topic / CEFR / retention. |

Every Cypher query above is shown in the UI behind a "Show Cypher" toggle. Judges can see exactly what the agent is doing.

---

## Schema

```
(User {id})
  -[:ADDED {addedAt, reviewCount, retention, lastReviewed}]->
(Word {lemma, article, cefr, translation, example, exampleTranslation})
  -[:EXTRACTED_FROM]->(Source {id, type, snippet, addedAt})
  -[:BELONGS_TO]->(Topic {name})
  -[:CO_OCCURS_WITH {strength, firstSeen}]-(Word)
```

Constraints: `Word.lemma`, `Topic.name`, `User.id` are unique. Edges are
created/incremented automatically every time a user adds words from a new source.

---

## The agent — clear role, useful tools, smart responses

**Role:** German vocabulary coach with read access to your personal Neo4j graph.

**Tools (Cypher patterns):**
1. *Bridge-word finder* — surfaces unknown words connected to ≥2 known words.
2. *Weak-cluster detector* — averages retention across each Topic.
3. *Centrality of weak words* — counts `CO_OCCURS_WITH` neighbors of low-retention words.
4. *Twin-pair detector* — sorts user-deck word pairs by edge strength.
5. *Conversational chat* — Groq Llama 3.3 70B grounded in the four results above plus the user's CEFR distribution and recent words.

**Show your thinking:** the agent's Insights view exposes four named cards. Each has:
- a one-line title (*"Bridge words"*),
- the *reasoning* (why this matters),
- the actual *result list* from the graph,
- a toggleable *Cypher query* you can read.

The chat agent is given the same graph context and instructed to cite it ("*Add Verhandlung — it bridges 4 words you already know via Vertrag, Konferenz, Politik*") rather than answer with generic advice.

---

## The unique angle

**Other vocabulary apps:** static curriculum, generic word lists.
**Wortgraph:** *your* reading material is the dataset.

Read an article in *Zeit Online* about climate policy → extract → 18 words land in your graph, all linked to each other and to the *Climate* topic. Read the next article about EU diplomacy → those words connect via shared political vocabulary. After 5 articles you have a vocabulary network nobody else has, and the agent can reason about *your* gaps — not a textbook's.

This is **the only way** to learn what news articles actually demand from a B1 reader, which is the gap most learners get stuck in.

---

## Live demo flow (2-minute video)

1. **Paste a real German article** in *Explore*. Watch Groq extract 12 words with translation, A2 example sentences, English translation, CEFR levels.
2. **Open the Graph view.** Show the network forming. Color by Topic. Click a node — its neighborhood lights up.
3. **Open the AI Coach.** Show the four insight cards. Expand "Show Cypher" on Bridge words — judges see the actual query traversing through `CO_OCCURS_WITH`.
4. **Ask the chat agent**: *"Which weak word should I review first and why?"* It cites a specific word, shows it's connected to 6 others in your deck, recommends review order.
5. **Flashcard a few words.** Press 1/2/3 to grade. Watch retention update in Neo4j and re-flow into the agent's recommendations on next refresh.

---

## Stack

- **Neo4j Aura Free** (graph + Bolt protocol)
- **Express** backend (Node 20) — Cypher queries, Groq orchestration
- **Groq** (Llama 3.3 70B) — vocabulary extraction with structured JSON output, conversational coach grounded in graph context
- **React + Vite** frontend
- **Web Speech API** for native German pronunciation
- Force-directed SVG layout (no extra deps) for the graph view

---

## Try it

- App: `https://wortgraph-1.onrender.com`
- Repo: `https://github.com/rishabhprsd7/wortgraph`

---

## Why we should win

We took *Make your graph matter* literally. The schema isn't decorative —
remove `CO_OCCURS_WITH` and the agent has nothing intelligent to say. Remove
`BELONGS_TO` and the cluster analysis disappears. The graph is the product.

We took *Show your thinking* literally too. Every recommendation is paired
with the Cypher pattern that produced it, visible in the UI. The agent
doesn't just answer — it shows its work.
