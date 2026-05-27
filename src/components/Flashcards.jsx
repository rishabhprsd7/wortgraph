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

async function postReview(word, correct, userId) {
  if (!API_URL) return;
  await fetch(`${API_URL}/api/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userId || 'default', word, correct })
  }).catch(() => {});
}

function recordActivity(userId) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const key = `wg_activity_${userId || 'default'}`;
    const dates = JSON.parse(localStorage.getItem(key) || '[]');
    if (!dates.includes(today)) {
      localStorage.setItem(key, JSON.stringify([...dates, today]));
    }
  } catch {}
}

function buildQueue(cards) {
  return cards.map(c => ({ card: c, isReview: false, prevResult: null }));
}

export function Flashcards({ words: propWords, userId, sourceText }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(!propWords);
  // deck = { queue: [{card, isReview, prevResult}], idx, done }
  const [deck, setDeck] = useState({ queue: [], idx: 0, done: false });
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ know: 0, no: 0 });
  const [showSourceText, setShowSourceText] = useState(false);
  // Track unique words the user didn't know (for end-of-session summary)
  const [newWords, setNewWords] = useState(new Set());

  useEffect(() => {
    if (propWords) {
      const c = propWords.length > 0 ? propWords : staticCards;
      setCards(c);
      setLoading(false);
      return;
    }
    if (!API_URL) { setCards(staticCards); setLoading(false); return; }
    fetch(`${API_URL}/api/words${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setCards(Array.isArray(data) && data.length > 0 ? data : staticCards))
      .catch(() => setCards(staticCards))
      .finally(() => setLoading(false));
  }, [propWords]);

  useEffect(() => {
    if (cards.length > 0) {
      setDeck({ queue: buildQueue(cards), idx: 0, done: false });
    }
  }, [cards]);

  const { queue, idx, done } = deck;
  const currentItem = queue[idx];
  const card = currentItem?.card;
  const isReview = currentItem?.isReview ?? false;
  const prevResult = currentItem?.prevResult ?? null;

  const origTotal = cards.length;
  // Count original (non-review) cards already answered
  const origsDone = queue.slice(0, idx).filter(item => !item.isReview).length;
  const displayNum = isReview ? origsDone : origsDone + 1;
  const progress = origTotal > 0 ? Math.min((displayNum / origTotal) * 100, 100) : 0;

  const respond = (kind) => {
    const correct = kind === 'know';
    const word = card?.word ?? card?.lemma;
    if (word) postReview(word, correct, userId);
    recordActivity(userId);
    setStats(s => ({ ...s, [kind]: s[kind] + 1 }));
    if (kind === 'no' && word) setNewWords(prev => new Set([...prev, word]));
    setFlipped(false);

    setTimeout(() => {
      setDeck(prev => {
        const { queue: q, idx: i } = prev;
        const nextIdx = i + 1;
        const item = q[i];
        let newQueue = [...q];

        if (kind === 'no') {
          // Advance past 2 unseen (non-review) cards before reinserting,
          // so consecutive don't-knows never block new cards from appearing.
          let newCardsAhead = 0;
          let insertAt = nextIdx;
          while (insertAt < newQueue.length && newCardsAhead < 2) {
            if (!newQueue[insertAt].isReview) newCardsAhead++;
            insertAt++;
          }
          newQueue.splice(insertAt, 0, { card: item.card, isReview: true, prevResult: 'no' });
        } else if (!item.isReview && Math.random() < 0.35) {
          // 35% chance: reinforce a "know" card once more near the end
          newQueue.push({ card: item.card, isReview: true, prevResult: 'know' });
        }

        const isDone = nextIdx >= newQueue.length;
        return { queue: newQueue, idx: nextIdx, done: isDone };
      });
    }, 240);
  };

  const restart = () => {
    setDeck({ queue: buildQueue(cards), idx: 0, done: false });
    setFlipped(false);
    setStats({ know: 0, no: 0 });
    setNewWords(new Set());
  };

  useEffect(() => {
    const onKey = (e) => {
      if (done) return;
      if (e.code === 'Space') { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === '1') respond('no');
      else if (e.key === '2') respond('know');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-3)' }}>Loading your deck…</div>;

  if (done) {
    const alreadyKnew = origTotal - newWords.size;
    const msg = newWords.size === 0
      ? 'You already knew everything — great work!'
      : newWords.size <= 3 ? 'Almost there — keep going!'
      : 'Keep reviewing to lock these in.';
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: '40px 0' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--violet-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--violet)' }}>
          <IconTrophy />
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>Session complete</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, margin: '0 0 28px' }}>{origTotal} cards reviewed</p>

        {/* Headline stat */}
        <div style={{ padding: '24px 20px', borderRadius: 12, background: 'var(--violet-soft)', marginBottom: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--violet)', lineHeight: 1 }}>{newWords.size}</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6, fontWeight: 500 }}>new words learned this session</div>
        </div>

        {alreadyKnew > 0 && (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
            Already knew <b style={{ color: 'var(--green)' }}>{alreadyKnew}</b> · {msg}
          </div>
        )}
        {alreadyKnew === 0 && (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>{msg}</div>
        )}

        <button className="btn btn-primary btn-sm" onClick={restart}>Review again</button>

        {sourceText && (
          <div style={{ marginTop: 32, textAlign: 'left', borderTop: '1px solid var(--line)', paddingTop: 24 }}>
            <button
              onClick={() => setShowSourceText(s => !s)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                background: 'var(--violet-soft)', border: '1.5px solid var(--violet-line)',
                color: 'var(--violet)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>Now read the original text</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{showSourceText ? '▲ hide' : '▼ show'}</span>
            </button>
            {showSourceText && (
              <div style={{
                marginTop: 10, padding: '20px 20px', borderRadius: 10,
                background: 'var(--bg)', border: '0.5px solid var(--line)',
                fontSize: 14, lineHeight: 1.9, color: 'var(--ink-2)',
                whiteSpace: 'pre-wrap', textAlign: 'left', maxHeight: 400, overflowY: 'auto',
              }}>
                {sourceText}
              </div>
            )}
          </div>
        )}
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
        <span>{displayNum} / {origTotal}</span>
        <div className="flash-bar"><div className="flash-bar-fill" style={{ width: `${progress}%` }} /></div>
        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{API_URL ? 'Your deck' : 'Demo deck'}</span>
      </div>

      <div className="card-frame">
        <div className={`card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(f => !f)}>

          {/* Front */}
          <div
            className={`face face-front${isReview && prevResult === 'no' ? ' face-review-no' : isReview ? ' face-review' : ''}`}
            style={{ justifyContent: 'space-between' }}
          >
            {isReview && prevResult === 'no' ? (
              <span className="face-corner" style={{ background: 'rgba(226,75,74,0.12)', color: 'var(--red)', padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>Don't know</span>
            ) : isReview ? (
              <span className="face-corner" style={{ background: 'rgba(216,162,61,0.18)', color: 'var(--amber-text)', padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>Review</span>
            ) : (
              <span className="face-corner">FRONT</span>
            )}
            <div>
              <div className="card-meta"><span className="article">{article}</span></div>
              <h2 className="card-word">{word}</h2>
              <div className="card-tags">
                {cefr && <span className="tag cefr">{cefr}</span>}
                {topic && <span className="tag">{topic}</span>}
              </div>
            </div>
            <button
              className="face-listen"
              onClick={e => { e.stopPropagation(); speak(word); }}
              title="Listen"
            >
              <IconSound /><span>Listen</span>
            </button>
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
        <button className="resp-btn hard" onClick={() => respond('no')}>
          <span className="glyph"><IconX /></span><span>Don't know</span><span className="kb">1</span>
        </button>
        <button className="resp-btn good" onClick={() => respond('know')}>
          <span className="glyph"><IconCheck /></span><span>Know it</span><span className="kb">2</span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 16, fontSize: 12, color: 'var(--ink-3)' }}>
        <span>Don't know: <b style={{ color: 'var(--red)' }}>{stats.no}</b></span>
        <span>Know it: <b style={{ color: 'var(--green)' }}>{stats.know}</b></span>
      </div>

    </div>
  );
}
