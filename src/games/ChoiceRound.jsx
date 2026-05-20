import { useState } from 'react';

// One pick-the-answer round. Each game maps its data to:
//   prompt    headline (string or node)
//   hint      optional small helper line
//   options   [{ key, label, sub, variant? }]   sub revealed after answer;
//                                                variant adds class cr-opt-<v>
//   answerKey the correct option's key
//   gridClass optional extra class on the options grid (e.g. "three-up")
//   variantClass optional extra class applied to every cr-opt (e.g. "art")
// Calls onResult(correct) exactly once, then shows colour feedback.
// The parent remounts this per round (via key), so no reset effect is needed.
export function ChoiceRound({ prompt, hint, options, answerKey, gridClass = '', variantClass = '', onResult }) {
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
