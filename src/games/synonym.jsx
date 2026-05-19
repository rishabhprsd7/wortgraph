import { fetchRound } from './api';
import { ChoiceRound } from './ChoiceRound';

const label = o => `${o.article || ''} ${o.word}`.trim();

export const synonym = {
  id: 'synonym',
  label: 'Synonym Sprint',
  blurb: 'Pick the word closest in meaning — ranked by the vector index.',
  tag: 'graph',
  generate: ctx => fetchRound('api/arena/synonym', ctx),
  reviewWord: data => data.answer,
  Component: ({ data, onAnswer }) => (
    <ChoiceRound
      prompt={<>Closest in meaning to <b>{label(data.anchor)}</b>?</>}
      hint={data.anchor.translation && `“${data.anchor.translation}”`}
      options={data.options.map(o => ({ key: o.key, label: label(o), sub: o.translation }))}
      answerKey={data.answer}
      onResult={onAnswer}
    />
  ),
};
