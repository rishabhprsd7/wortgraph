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
    if (pool.length < 4) return { error: 'nodeck', message: 'Add at least 4 words with translations in Explore.' };
    const fresh = pool.filter(w => !exclude.includes(w.word));
    const candidates = fresh.length ? fresh : pool;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    // Distractors are DISTINCT English meanings, none equal to the answer — so a
    // semantically-correct option is never shown as "wrong", and no two buttons
    // share a label.
    const distractors = shuffle(
      [...new Set(pool.map(w => w.translation))].filter(t => t !== target.translation)
    ).slice(0, 3);
    if (distractors.length < 1) return { error: 'nodeck', message: 'Need more words with distinct meanings in Explore.' };
    const options = shuffle([target.translation, ...distractors]);
    const answerIndex = options.indexOf(target.translation);
    return { data: { word: target.word, article: target.article || '', answerIndex, options } };
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
      options={data.options.map((t, i) => ({ key: String(i), label: t }))}
      answerKey={String(data.answerIndex)}
      onResult={onAnswer}
    />
  ),
};
