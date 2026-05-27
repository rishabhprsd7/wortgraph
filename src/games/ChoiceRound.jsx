import { useState } from 'react';

// One pick-the-answer round. Inputs:
//   prompt        ReactNode OR ({picked, correct}) => ReactNode — reacts to selection.
//   hint          optional small helper line.
//   options       [{ key, label, sub, variant? }] — label can be a ReactNode.
//   answerKey     the correct option's key.
//   gridClass     extra class on options grid (e.g. 'three-up', 'fb-options').
//   variantClass  extra class on every cr-opt (e.g. 'art', 'fb-opt').
// Calls onResult(correct) exactly once. Parent remounts via key for the next round.
export function ChoiceRound({ prompt, hint, options, answerKey, gridClass = '', variantClass = '', onResult }) {
  const [picked, setPicked] = useState(null);

  const choose = key => {
    if (picked) return;
    setPicked(key);
    onResult(key === answerKey);
  };

  const correct = picked === answerKey;
  const renderedPrompt = typeof prompt === 'function'
    ? prompt({ picked, correct, pickedOption: options.find(o => o.key === picked) })
    : prompt;

  return (
    <div className="cr">
      <div className="cr-prompt">{renderedPrompt}</div>
      {hint && <div className="cr-hint">{hint}</div>}
      <div className={`cr-options ${gridClass}`}>
        {options.map(o => {
          let cls = 'cr-opt';
          if (variantClass) cls += ' ' + variantClass;
          if (o.variant) cls += ' ' + o.variant;
          if (picked) {
            if (o.key === answerKey) cls += ' correct';
            else if (o.key === picked) cls += ' wrong';
            else cls += ' dim';
          }
          return (
            <button key={o.key} className={cls} onClick={() => choose(o.key)} disabled={!!picked}>
              <span className="cr-opt-label">{o.label}</span>
              {picked && o.sub && <span className="cr-opt-sub">{o.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Shared helper: render a German word with its article color-coded.
export function GermanWord({ article, word, size = 'md' }) {
  const cleanArticle = (article || '').trim().toLowerCase();
  const cls = ['der', 'die', 'das'].includes(cleanArticle) ? `art-tag ${cleanArticle}` : null;
  return (
    <span className={`cr-de cr-de-${size}`}>
      {cls && <span className={cls}>{cleanArticle}</span>}
      <span className="cr-de-word">{word}</span>
    </span>
  );
}
