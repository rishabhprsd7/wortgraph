import { useState } from 'react';

// One pick-the-answer round. Each game maps its data to:
//   prompt    headline (string or node)
//   hint      optional small helper line
//   options   [{ key, label, sub }]   sub is revealed after answering
//   answerKey the correct option's key
// Calls onResult(correct) exactly once, then shows colour feedback.
// The parent remounts this per round (via key), so no reset effect is needed.
export function ChoiceRound({ prompt, hint, options, answerKey, onResult }) {
  const [picked, setPicked] = useState(null);

  const choose = key => {
    if (picked) return;
    setPicked(key);
    onResult(key === answerKey);
  };

  return (
    <div className="cr">
      <div className="cr-prompt">{prompt}</div>
      {hint && <div className="cr-hint">{hint}</div>}
      <div className="cr-options">
        {options.map(o => {
          let cls = 'cr-opt';
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
