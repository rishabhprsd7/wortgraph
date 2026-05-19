import { ChoiceRound } from './ChoiceRound';

const ARTICLES = ['der', 'die', 'das'];

export const article = {
  id: 'article',
  label: 'Der Die Das',
  blurb: 'Guess the article. Fast-fire gender practice from your deck.',
  tag: 'classic',
  needsDeck: true,
  reviewWord: data => data.word,
  generate: async ({ deck, exclude = [] }) => {
    const pool = deck.filter(w =>
      w.word && ARTICLES.includes((w.article || '').toLowerCase()) && !exclude.includes(w.word));
    if (pool.length < 1) return { error: 'nodeck', message: 'Add a few nouns to your deck in Explore.' };
    const w = pool[Math.floor(Math.random() * pool.length)];
    return { data: { word: w.word, article: w.article.toLowerCase(), translation: w.translation || '' } };
  },
  Component: ({ data, onAnswer }) => (
    <ChoiceRound
      prompt={<>Which article? <b>___ {data.word}</b></>}
      hint={data.translation && `“${data.translation}”`}
      options={ARTICLES.map(a => ({ key: a, label: a }))}
      answerKey={data.article}
      onResult={onAnswer}
    />
  ),
};
