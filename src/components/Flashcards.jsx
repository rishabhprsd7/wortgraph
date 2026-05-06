import { useState, useEffect } from 'react';
import { flashcards as staticCards } from '../data/vocab';
import { IconX, IconCheck, IconSound, IconTrophy } from './Icons';

const API_URL = import.meta.env.VITE_API_URL || '';

function speak(word) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const fire = () => {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'de-DE';
    u.rate = 0.85;
    const deVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('de'));
    if (deVoice) u.voice = deVoice;
    window.speechSynthesis.speak(u);
  };

  // Chrome loads voices async — wait if not ready yet.
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener('voiceschanged', fire, { once: true });
  } else {
    fire();
  }
}

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
  const progress = cards.length ? ((idx) / cards.length) * 100 : 0;

  const respond = (kind) => {
    const correct = kind === 'good';
    const word = card?.word ?? card?.lemma;
    if (word) postReview(word, correct);
    setStats(s => ({ ...s, [kind]: s[kind] + 1 }));
    setFlipped(false);
    setTimeout(() => {
      if (idx + 1 >= cards.length) setDone(true);
      else setIdx(i => i + 1);
    }, 240);
  };

  const restart = () => {
    setIdx(0); setFlipped(false);
    setStats({ hard: 0, again: 0, good: 0 }); setDone(false);
  };

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

  if (done) {
    const total = stats.hard + stats.again + stats.good;
    const pct = total > 0 ? Math.round((stats.good / total) * 100) : 0;
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: '40px 0' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--violet-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--violet)' }}>
          <IconTrophy />
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>Session complete</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, margin: '0 0 28px' }}>{total} cards reviewed</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Got it', val: stats.good, color: 'var(--green)', bg: 'var(--green-soft)' },
            { label: 'Again', val: stats.again, color: 'var(--ink-2)', bg: 'var(--bg-3)' },
            { label: 'Hard', val: stats.hard, color: 'var(--red)', bg: 'var(--red-soft)' },
          ].map(s => (
            <div key={s.label} style={{ padding: '16px 12px', borderRadius: 10, background: s.bg }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
          {pct}% correct · {pct >= 80 ? 'Great session! 🎯' : pct >= 50 ? 'Keep practising!' : 'Review these words again soon.'}
        </div>
        <button className="btn btn-primary btn-sm" onClick={restart}>Review again</button>
      </div>
    );
  }

  if (!card) return null;

  const word = card.word ?? card.lemma;
  const article = card.article ?? '';
  const cefr = card.cefr ?? '';
  const translation = card.translation ?? card.translationEn ?? '';
  const example = card.example ?? '';
  const exampleTranslation = card.exampleTranslation ?? '';
  const topic = card.topic ?? '';

  return (
    <div className="flash-stage">
      <div className="flash-progress">
        <span>{idx + 1} / {cards.length}</span>
        <div className="flash-bar"><div className="flash-bar-fill" style={{ width: `${progress}%` }} /></div>
        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{API_URL ? 'Your deck' : 'Demo deck'}</span>
      </div>

      <div className="card-frame">
        <div className={`card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(f => !f)}>

          {/* Front */}
          <div className="face face-front">
            <span className="face-corner">FRONT</span>
            <button
              onClick={e => { e.stopPropagation(); speak(word); }}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'var(--bg-3)',
                border: '1px solid var(--line)',
                borderRadius: 999, padding: '6px 12px',
                cursor: 'pointer', color: 'var(--ink-2)',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 500, letterSpacing: 0.2,
              }}
              title="Listen"
            >
              <IconSound /><span>Listen</span>
            </button>
            <div className="card-meta"><span className="article">{article}</span></div>
            <h2 className="card-word">{word}</h2>
            <div className="card-tags">
              {cefr && <span className="tag cefr">{cefr}</span>}
              {topic && <span className="tag">{topic}</span>}
            </div>
          </div>

          {/* Back */}
          <div className="face face-back" style={{ justifyContent: 'center', padding: '32px 32px' }}>
            {/* Headline: der Amtskollege | colleague */}
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginBottom: 22, fontFamily: "'IBM Plex Serif', Georgia, serif" }}>
              {article && <span style={{ color: '#a59cf0', fontSize: 26, fontWeight: 500 }}>{article}</span>}
              <span style={{ color: '#fff', fontSize: 28, fontWeight: 600 }}>{word}</span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 22, fontWeight: 300, margin: '0 2px' }}>|</span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 26, fontWeight: 400, fontStyle: 'italic' }}>{translation || '—'}</span>
            </div>

            {/* Divider */}
            {example && <div style={{ width: 48, height: '1px', background: 'rgba(255,255,255,0.18)', marginBottom: 20 }} />}

            {/* Example sentences */}
            {example && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: "'IBM Plex Serif', Georgia, serif" }}>
                <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 15, margin: 0, lineHeight: 1.5 }}>
                  „{example}"
                </p>
                {exampleTranslation && (
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
                    {exampleTranslation}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flip-hint">Click card or press space to flip · 🔊 tap speaker to hear</div>

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

      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 16, fontSize: 12, color: 'var(--ink-3)' }}>
        <span>Hard: <b style={{ color: 'var(--red)' }}>{stats.hard}</b></span>
        <span>Again: <b>{stats.again}</b></span>
        <span>Got it: <b style={{ color: 'var(--green)' }}>{stats.good}</b></span>
      </div>
    </div>
  );
}
