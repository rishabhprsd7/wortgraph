import { useState, useEffect } from 'react';
import { flashcards as staticCards } from '../data/vocab';
import { IconX, IconCheck } from './Icons';

const API_URL = import.meta.env.VITE_API_URL || '';

async function postReview(word, correct) {
  if (!API_URL) return;
  await fetch(`${API_URL}/api/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'default', word, correct })
  }).catch(() => {});
}

export function Flashcards({ words: propWords }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(!propWords);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ hard: 0, again: 0, good: 0 });
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (propWords) { setCards(propWords.length > 0 ? propWords : staticCards); setLoading(false); return; }
    if (!API_URL) { setCards(staticCards); setLoading(false); return; }
    fetch(`${API_URL}/api/words`)
      .then(r => r.json())
      .then(data => setCards(data.length > 0 ? data : staticCards))
      .catch(() => setCards(staticCards))
      .finally(() => setLoading(false));
  }, [propWords]);

  const card = cards[idx];
  const progress = cards.length ? (idx / cards.length) * 100 : 0;
  const usingRealDeck = !!API_URL && cards !== staticCards;

  const respond = (kind) => {
    const correct = kind === 'good';
    if (card?.word || card?.lemma) {
      postReview(card.word ?? card.lemma, correct);
    }
    setStats(s => ({ ...s, [kind]: s[kind] + 1 }));
    setFlipped(false);
    setTimeout(() => {
      if (idx + 1 >= cards.length) setDone(true);
      else setIdx(i => i + 1);
    }, 240);
  };

  const restart = () => { setIdx(0); setFlipped(false); setStats({ hard: 0, again: 0, good: 0 }); setDone(false); };

  useEffect(() => {
    const onKey = (e) => {
      if (done) return;
      if (e.code === 'Space') { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === '1') respond('hard');
      else if (e.key === '2') respond('again');
      else if (e.key === '3') respond('good');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-3)' }}>Loading your deck…</div>;

  if (done) return (
    <div className="flash-stage" style={{ alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 32 }}>✓</div>
      <h2 style={{ margin: 0 }}>Session complete</h2>
      <p style={{ color: 'var(--ink-3)', fontSize: 14, margin: 0 }}>{cards.length} cards reviewed</p>
      <div style={{ display: 'flex', gap: 28, fontSize: 13, color: 'var(--ink-3)' }}>
        <span>Hard: <b style={{ color: 'var(--red)' }}>{stats.hard}</b></span>
        <span>Again: <b>{stats.again}</b></span>
        <span>Got it: <b style={{ color: 'var(--green)' }}>{stats.good}</b></span>
      </div>
      <button className="btn btn-primary btn-sm" onClick={restart}>Review again</button>
    </div>
  );

  if (!card) return null;

  const word = card.word ?? card.lemma;
  const article = card.article ?? '';
  const cefr = card.cefr ?? '';
  const translation = card.translation ?? card.translationEn ?? '';
  const topic = card.topic ?? '';
  const example = card.example ?? '';
  const exampleEn = card.exampleEn ?? '';

  return (
    <div className="flash-stage">
      <div className="flash-progress">
        <span>{idx + 1} / {cards.length}</span>
        <div className="flash-bar">
          <div className="flash-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{usingRealDeck ? 'Your deck' : 'Demo deck'}</span>
      </div>

      <div className="card-frame">
        <div className={`card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
          <div className="face face-front">
            <span className="face-corner">FRONT</span>
            <div className="card-meta"><span className="article">{article}</span></div>
            <h2 className="card-word">{word}</h2>
            <div className="card-tags">
              {cefr && <span className="tag cefr">{cefr}</span>}
              {topic && <span className="tag">{topic}</span>}
            </div>
          </div>
          <div className="face face-back">
            <span className="face-corner">BACK</span>
            <div className="card-meta">
              <span className="article" style={{ color: '#9d96e8' }}>{article}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{word}</span>
            </div>
            {translation
              ? <p className="translation">{translation}</p>
              : <p className="translation" style={{ opacity: 0.5 }}>Did you know this word?</p>
            }
            {example && <p className="example">"{example}"</p>}
            {exampleEn && <p className="example" style={{ marginTop: 6, fontStyle: 'normal', fontSize: 12 }}>{exampleEn}</p>}
          </div>
        </div>
      </div>

      <div className="flip-hint">Click card or press space to flip</div>

      <div className="response-row">
        <button className="resp-btn hard" onClick={() => respond('hard')}>
          <span className="glyph"><IconX /></span><span>Hard</span><span className="kb">1</span>
        </button>
        <button className="resp-btn again" onClick={() => respond('again')}>
          <span>Again</span><span className="kb">2</span>
        </button>
        <button className="resp-btn good" onClick={() => respond('good')}>
          <span className="glyph"><IconCheck /></span><span>Got it</span><span className="kb">3</span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 28, fontSize: 12, color: 'var(--ink-3)' }}>
        <span>Hard: <b style={{ color: 'var(--red)' }}>{stats.hard}</b></span>
        <span>Again: <b>{stats.again}</b></span>
        <span>Got it: <b style={{ color: 'var(--green)' }}>{stats.good}</b></span>
      </div>
    </div>
  );
}
