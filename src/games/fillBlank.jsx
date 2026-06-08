import { fetchRound } from './api';
import { ChoiceRound, GermanWord } from './ChoiceRound';

const BLANK = '———';

const renderSentence = ({ sentence, picked, correct, pickedOption }) => {
  const text = sentence || '';
  const parts = text.split(BLANK);
  const blank = (key) => (
    <span key={key} className={`fb-blank ${picked ? (correct ? 'filled-correct' : 'filled-wrong') : 'empty'}`}>
      {picked ? pickedOption?.word : '___'}
    </span>
  );
  // If the backend sentence has no blank token, show the sentence then a
  // trailing blank so there's always a visible target.
  if (parts.length === 1) {
    return (
      <div className="fb-card">
        <span className="fb-quote">“</span>{text} {blank('b')}<span className="fb-quote">”</span>
      </div>
    );
  }
  return (
    <div className="fb-card">
      <span className="fb-quote">“</span>
      {parts.map((chunk, i) => (
        <span key={i}>
          {chunk}
          {i < parts.length - 1 && blank(`b${i}`)}
        </span>
      ))}
      <span className="fb-quote">”</span>
    </div>
  );
};

export const fillBlank = {
  id: 'fill-blank',
  label: 'Fill the Blank',
  blurb: 'A real example sentence with one word missing. Distractors are near-synonyms.',
  tag: 'graph',
  generate: ctx => fetchRound('api/arena/fill-blank', ctx,
    b => typeof b.sentence === 'string' && Array.isArray(b.options) && b.options.length >= 2 && b.answer != null),
  reviewWord: data => data.answer,
  Component: ({ data, onAnswer }) => {
    // Options carry word + article so FbSentence can render the chosen one inline.
    const enrichedOptions = data.options.map(o => ({
      key: o.key,
      word: o.word,
      article: o.article,
      label: <GermanWord article={o.article} word={o.word} />,
      sub: o.translation,
    }));
    return (
      <ChoiceRound
        prompt={({ picked, correct, pickedOption }) =>
          renderSentence({ sentence: data.sentence, picked, correct, pickedOption })
        }
        hint={data.hint && `Hint: “${data.hint}”`}
        options={enrichedOptions}
        answerKey={data.answer}
        onResult={onAnswer}
      />
    );
  },
};
