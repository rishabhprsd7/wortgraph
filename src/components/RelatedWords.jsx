import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

// Fetches and displays Graph-RAG generated word relations for one word.
// Three sections: synonyms (green), antonyms (red), forms (violet).
// Silent when there's nothing to show — empty state renders nothing.
export function RelatedWords({ word, userId, theme = 'dark' }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!word || !API_URL) return;
    let cancelled = false;
    const q = `?userId=${encodeURIComponent(userId || 'default')}&word=${encodeURIComponent(word)}`;
    fetch(`${API_URL}/api/word/relations${q}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [word, userId]);

  if (!data) return null;
  const total = (data.synonyms?.length || 0) + (data.antonyms?.length || 0) + (data.forms?.length || 0);
  if (total === 0) return null;

  return (
    <div className={`rw rw-${theme}`}>
      <Section label="Synonyms" tone="syn" items={data.synonyms} />
      <Section label="Antonyms" tone="ant" items={data.antonyms} />
      <Section label="Word forms" tone="form" items={data.forms} />
    </div>
  );
}

function Section({ label, items, tone }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rw-row">
      <span className={`rw-label rw-label-${tone}`}>{label}</span>
      <div className="rw-pills">
        {items.map(it => (
          <span key={it.lemma} className={`rw-pill rw-pill-${tone}`} title={it.translation}>
            {it.article && <span className="rw-art">{it.article}</span>}
            <span className="rw-word">{it.lemma}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
