// Game registry — the Arena shell renders whatever is listed here.
//
// Each entry:
//   id          unique key (also used by the planner agent in later phases)
//   label       short title shown on the picker card
//   blurb       one-line description
//   tag         'graph' = showcases Neo4j, 'classic' = graph-light
//   selfContained = true  → Component manages its own data + phases,
//                            receives { userId, setRoute }
//   (shell-driven games added in phase 2 use generate(ctx) + onAnswer/onNext)

import { Crossword } from '../components/Crossword';

export const GAMES = [
  {
    id: 'crossword',
    label: 'Crossword',
    blurb: 'Your hardest words turned into a puzzle with AI-generated clues',
    tag: 'classic',
    selfContained: true,
    Component: Crossword,
  },
];

export const getGame = id => GAMES.find(g => g.id === id) || null;
