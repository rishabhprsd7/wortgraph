import { ChoiceRound, GermanWord } from './ChoiceRound';

const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(p => p[1]);

export const match = {
  id: 'match',
  label: 'Quick Match',
  blurb: 'Match the German word to its English meaning before the streak breaks.',
  tag: 'classic',
  needsDeck: true,
  reviewWord: data => data.word,
  generate: async ({ deck, exclude = [] }) => {
    const pool = deck.filter(w => w.word && w.translation);
    const fresh = pool.filter(w => !exclude.includes(w.word));
    if (pool.length < 4) return { error: 'nodeck', message: 'Add at least 4 words with translations in Explore.' };
    const target = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))];
    const distractors = shuffle(pool.filter(w => w.translation !== target.translation))
      .slice(0, 3)
      .map(w => w.translation);
    const options = shuffle([target.translation, ...distractors]);
    return { data: { word: target.word, article: target.article || '', answer: target.translation, options } };
  },
  Component: ({ data, onAnswer }) => (
    <ChoiceRound
      prompt={
        <div className="match-card">
          <div className="match-card-label">Translate to English</div>
          <div className="match-card-word">
            <GermanWord article={data.article} word={data.word} size="lg" />
          </div>
        </div>
      }
      gridClass="match-options"
      variantClass="match-opt"
      options={data.options.map((t, i) => ({ key: `${i}:${t}`, label: t }))}
      answerKey={data.options.map((t, i) => `${i}:${t}`).find(k => k.endsWith(`:${data.answer}`))}
      onResult={onAnswer}
    />
  ),
};
