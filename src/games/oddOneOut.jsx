import { fetchRound } from './api';
import { ChoiceRound } from './ChoiceRound';

const label = o => `${o.article || ''} ${o.word}`.trim();

export const oddOneOut = {
  id: 'odd-one-out',
  label: 'Odd One Out',
  blurb: 'Three words share a meaning, one doesn’t. Spot the outlier.',
  tag: 'graph',
  generate: ctx => fetchRound('api/arena/odd-one-out', ctx),
  reviewWord: () => null,
  Component: ({ data, onAnswer }) => (
    <ChoiceRound
      prompt="Which word doesn’t belong with the others?"
      options={data.options.map(o => ({ key: o.key, label: label(o), sub: o.translation }))}
      answerKey={data.answer}
      onResult={onAnswer}
    />
  ),
};
