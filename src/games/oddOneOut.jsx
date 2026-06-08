import { fetchRound } from './api';
import { ChoiceRound, GermanWord } from './ChoiceRound';

export const oddOneOut = {
  id: 'odd-one-out',
  label: 'Odd One Out',
  blurb: 'Three words share a meaning, one doesn’t. Spot the outlier.',
  tag: 'graph',
  generate: ctx => fetchRound('api/arena/odd-one-out', ctx,
    b => Array.isArray(b.options) && b.options.length >= 2 && b.answer != null),
  reviewWord: () => null,
  Component: ({ data, onAnswer }) => (
    <ChoiceRound
      prompt={
        <span>
          Which word doesn’t belong <span className="cr-accent">with the others?</span>
        </span>
      }
      options={data.options.map(o => ({
        key: o.key,
        label: <GermanWord article={o.article} word={o.word} />,
        sub: o.translation,
      }))}
      answerKey={data.answer}
      onResult={onAnswer}
    />
  ),
};
