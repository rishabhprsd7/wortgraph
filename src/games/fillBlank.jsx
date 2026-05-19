import { fetchRound } from './api';
import { ChoiceRound } from './ChoiceRound';

export const fillBlank = {
  id: 'fill-blank',
  label: 'Fill the Blank',
  blurb: 'A real example sentence with one word missing. Distractors are near-synonyms.',
  tag: 'graph',
  generate: ctx => fetchRound('api/arena/fill-blank', ctx),
  reviewWord: data => data.answer,
  Component: ({ data, onAnswer }) => (
    <ChoiceRound
      prompt={<span className="cr-sentence">{data.sentence}</span>}
      hint={data.hint && `“${data.hint}”`}
      options={data.options.map(o => ({
        key: o.key,
        label: `${o.article || ''} ${o.word}`.trim(),
        sub: o.translation,
      }))}
      answerKey={data.answer}
      onResult={onAnswer}
    />
  ),
};
