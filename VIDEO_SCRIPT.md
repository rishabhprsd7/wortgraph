# Wortgraph Coach — submission video script (~3:15) — FINAL

Read aloud over the shots. Sign in as **demo**, light mode, dry-run once.
Warm the backend before recording Shot 5 (send one chat message off-camera).

## OPENING — app home / Graph view (20s)
Hi, I'm Rishabh — and this is for submission to the Neo4j Aura Agent
Hackathon: **Wortgraph Coach**, a German vocabulary coach built on a personal
knowledge graph in Neo4j Aura.

Every vocabulary app I've tried stores words as a flat list. But your brain
doesn't store language as a list — it stores it as a network. That mismatch
is why flashcards leak. Wortgraph stores your vocabulary the way your brain
actually does: as a graph.

## SHOT 1 — Explore: paste text, extract (25s)
Here's how it works. I paste German I'm actually reading — an article, even
a YouTube transcript. Wortgraph extracts the words worth learning, with
articles, translations and CEFR levels. And every word is verified against
Wiktionary and the DWDS corpus before it enters the graph — so the system
can never teach me a word an AI made up.

## SHOT 2 — Learn: flashcards + German grammar (30s)
*(Learn tab → flip a few cards → grade one well, one badly. Linger on the
article and example sentence on the card.)*

And this is why the app exists — actually learning German. Flashcards that
treat grammar as part of the word: the article — der, die, das — is drilled
with every noun, because in German the gender IS the vocabulary. Every card
carries a real example sentence at my level. And when I grade myself, that
review is written into the graph as a retention score — so the system
always knows exactly which words are slipping.

## SHOT 3 — Graph/Clusters view: click a node (20s)
Behind the flashcards, this is what I'm building. Every word links to the
words it appeared with and to its topic — over 250 words and 1,700
connections in Neo4j AuraDB. This isn't a chart drawn from a table — what
you're looking at IS the database.

## SHOT 4 — Arena: Odd-One-Out, Cypher panel, then Crossword (45s)
*(Play one Odd-One-Out round → read the 💡 explanation → expand "How the
graph built this round" → back to Arena → open Crossword, fill one or two
words → flash the Der/Die/Das tile on the way.)*

The graph generates the practice, too. In the Arena, games are built by
Cypher queries — Odd-One-Out asks the graph for three words that share a
meaning and one outlier, so the puzzle can't hallucinate. When I answer, it
explains why using the actual relationships — and I can open the exact
Cypher that built the round.

And it goes further: a crossword, generated from my own deck — every clue
is a word I'm actually learning. Plus a der-die-das game for drilling
articles. Practice material that writes itself from the graph.

## SHOT 5 — AI Coach: "What new word should I add to my vocabulary next?" (45s)
Now the centerpiece. The AI Coach is a published Neo4j Aura Agent with
twelve tools — ten Cypher templates, a semantic similarity search over
3,072-dimensional Gemini embeddings, and a Text2Cypher fallback. Watch what
happens when I ask what to learn next.

It recommends Dürre — not because it's on some frequency list, but because
the graph found it connects seven words I already know: Verantwortung,
Umwelt, Klimawandel, Erderwärmung. One new word, wiring a whole region of my
vocabulary together. That's a recommendation only a graph can make.

## SHOT 6 — Aura console: tool list + same question (25s)
And this is the same agent living in the Aura console — watch it choose the
Get Bridge Words tool and traverse the graph in real time. The web app and
the console run on one brain. It's also exposed as an MCP server — so
Claude, or any MCP client, can talk to my vocabulary graph directly.

## CLOSE — hold on the graph (15s)
*(No live zooming needed: either hold the graph still and slowly drag the
canvas, or record it static and add the zoom in iMovie — drop the clip in,
Cropping → Ken Burns, set Start tight / End wide. The app's scroll-zoom is
now smooth too if you prefer doing it live — gentle two-finger scroll.)*

Flashcard apps store your effort as a list and let it leak. Wortgraph
stores it as a graph — where every word you add strengthens the ones you
already have. Wortgraph Coach — built on Neo4j Aura. Thanks for watching.
