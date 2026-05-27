import { fetchRound } from './api';
import { ChoiceRound, GermanWord } from './ChoiceRound';

export const synonym = {
  id: 'synonym',
  label: 'Synonym Sprint',
  blurb: 'Pick the word closest in meaning — ranked by the vector index.',
  tag: 'graph',
  generate: ctx => fetchRound('api/arena/synonym', ctx),
  reviewWord: data => data.answer,
  Component: ({ data, onAnswer }) => (
    <ChoiceRound
      prompt={
        <div className="synonym-prompt">
          <div className="synonym-label">Closest in meaning to</div>
          <div className="synonym-anchor">
            <GermanWord article={data.anchor.article} word={data.anchor.word} size="lg" />
          </div>
          {data.anchor.translation && (
            <div className="synonym-anchor-trans">“{data.anchor.translation}”</div>
          )}
        </div>
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
