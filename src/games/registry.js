// Game registry — the Arena shell and the planner agent both read this list.
//
// Shell-driven game:
//   generate(ctx) → { data } | { error, message }   ctx = { userId, exclude, deck }
//   Component({ data, onAnswer })  — calls onAnswer(correct) once per round
//   reviewWord(data) → lemma | null  — word to write retention back to
//   needsDeck: true  — client games; Arena loads the deck and passes ctx.deck
//   tag: 'graph' (showcases Neo4j) | 'classic' (graph-light)
//
// Self-contained game (crossword): manages its own data + phases,
//   Component({ userId, setRoute }); selfContained: true

import { Crossword } from '../components/Crossword';
import { oddOneOut } from './oddOneOut';
import { synonym } from './synonym';
import { fillBlank } from './fillBlank';
import { article } from './article';
import { match } from './match';

const crossword = {
  id: 'crossword',
  label: 'Crossword',
  blurb: 'Your hardest words turned into a puzzle with AI-generated clues.',
  tag: 'classic',
  selfContained: true,
  Component: Crossword,
};

export const GAMES = [oddOneOut, synonym, fillBlank, match, article, crossword];

export const getGame = id => GAMES.find(g => g.id === id) || null;
