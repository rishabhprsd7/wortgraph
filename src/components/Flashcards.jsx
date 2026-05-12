import { useState, useEffect } from 'react';
import { flashcards as staticCards } from '../data/vocab';
import { IconX, IconCheck, IconSound, IconTrophy } from './Icons';

const API_URL = import.meta.env.VITE_API_URL || '';
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function expandGrammarTopic(topic, form, highlight, example) {
  const prompt = `You are a German grammar teacher. A B1+ learner is looking at this sentence and wants to understand why "${highlight}" makes it "${topic}".

Sentence: "${example}"
Key phrase: "${highlight}"
Pattern: ${form || topic}

Break it down word by word. Return ONLY this JSON (no markdown):
{
  "breakdown": [
    {"part": "exact word or morpheme from the key phrase", "role": "what it is and what job it does HERE in this sentence — be specific, max 10 words"}
  ],
  "pattern": "the rule as a formula anchored to this sentence, e.g. 'wurde + [Partizip II] = passive past: focus on what happened, not who did it'",
  "oneMore": {"de": "one new German sentence using the same pattern", "en": "English translation"}
}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    })
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

function HighlightedSentence({ example, highlight }) {
  if (!highlight || !example) return <span style={{ fontStyle: 'italic' }}>„{example}"</span>;
  const idx = example.toLowerCase().indexOf(highlight.toLowerCase());
  if (idx === -1) return <span style={{ fontStyle: 'italic' }}>„{example}"</span>;
  return (
    <span style={{ fontStyle: 'italic' }}>
      „{example.slice(0, idx)}
      <mark style={{ background: 'rgba(127,119,221,0.18)', color: 'var(--violet)', borderRadius: 3, padding: '0 2px', fontStyle: 'normal', fontWeight: 700 }}>
        {example.slice(idx, idx + highlight.length)}
      </mark>
      {example.slice(idx + highlight.length)}"
    </span>
  );
}

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

export function Flashcards({ words: propWords, userId, sourceText, grammarTopics = [] }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(!propWords);
  // deck = { queue: [{card, isReview, prevResult}], idx, done }
  const [deck, setDeck] = useState({ queue: [], idx: 0, done: false });
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ know: 0, no: 0 });
  const [showSourceText, setShowSourceText] = useState(false);
  const [showGrammar, setShowGrammar] = useState(true);
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [expansions, setExpansions] = useState({});
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
      .then(r => r.json())
      .then(data => setCards(data.length > 0 ? data : staticCards))
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
            className="face face-front"
            style={{
              justifyContent: 'space-between',
              ...(isReview && prevResult === 'no' ? {
                background: 'linear-gradient(180deg, #fff5f5 0%, #fde8e8 100%)',
                borderColor: '#f0c4c4',
              } : isReview ? {
                background: 'linear-gradient(180deg, #fffdf0 0%, #fef6da 100%)',
                borderColor: '#e5d48a',
              } : {}),
            }}
          >
            {isReview && prevResult === 'no' ? (
              <span className="face-corner" style={{ background: 'rgba(226,75,74,0.12)', color: 'var(--red)', padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>Don't know</span>
            ) : isReview ? (
              <span className="face-corner" style={{ background: 'rgba(216,162,61,0.15)', color: '#8a6200', padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>Review</span>
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
              onClick={e => { e.stopPropagation(); speak(word); }}
              style={{
                alignSelf: 'flex-start',
                background: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(127, 119, 221, 0.2)',
                borderRadius: 999, padding: '6px 14px',
                cursor: 'pointer', color: 'var(--ink-2)',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 500,
              }}
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

      {grammarTopics.length > 0 && (
        <div style={{ marginTop: 28, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
          <button
            onClick={() => setShowGrammar(s => !s)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: 'var(--violet-soft)', border: '0.5px solid var(--violet-line)',
              color: 'var(--violet)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span>Grammar highlights</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{showGrammar ? '▲ hide' : '▼ show'}</span>
          </button>
          {showGrammar && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {grammarTopics.map((g, i) => {
                const isOpen = expandedTopic === i;
                const exp = expansions[i];
                return (
                  <div key={i} style={{
                    borderRadius: 8, background: 'var(--bg)',
                    border: isOpen ? '1px solid var(--violet-line)' : '0.5px solid var(--line)',
                    overflow: 'hidden',
                  }}>
                    {/* Header row */}
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--violet)' }}>{g.topic}</span>
                          {g.form && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                              background: 'rgba(127,119,221,0.12)', color: 'var(--violet)', letterSpacing: '0.02em',
                            }}>{g.form}</span>
                          )}
                        </div>
                        {GROQ_KEY && (
                          <button
                            onClick={async () => {
                              if (isOpen) { setExpandedTopic(null); return; }
                              setExpandedTopic(i);
                              if (!exp) {
                                setExpansions(prev => ({ ...prev, [i]: { loading: true } }));
                                try {
                                  const result = await expandGrammarTopic(g.topic, g.form, g.highlight, g.example);
                                  setExpansions(prev => ({ ...prev, [i]: result }));
                                } catch {
                                  setExpansions(prev => ({ ...prev, [i]: { error: true } }));
                                }
                              }
                            }}
                            style={{
                              fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--violet-line)',
                              background: isOpen ? 'var(--violet)' : 'transparent',
                              color: isOpen ? '#fff' : 'var(--violet)',
                              cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                            }}
                          >
                            {isOpen ? 'Close' : 'Explain more'}
                          </button>
                        )}
                      </div>
                      {g.example && (
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: g.explanation ? 5 : 0 }}>
                          <HighlightedSentence example={g.example} highlight={g.highlight} />
                        </div>
                      )}
                      {g.explanation && (
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                          {g.explanation}
                        </div>
                      )}
                    </div>

                    {/* Expanded drill-down */}
                    {isOpen && (
                      <div style={{ borderTop: '1px solid var(--violet-line)', padding: '14px 14px', background: 'var(--violet-soft)' }}>
                        {exp?.loading && (
                          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Loading explanation…</div>
                        )}
                        {exp?.error && (
                          <div style={{ fontSize: 12, color: 'var(--red)' }}>Couldn't load — try again.</div>
                        )}
                        {exp && !exp.loading && !exp.error && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Word-by-word breakdown */}
                            {exp.breakdown?.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {exp.breakdown.map((b, j) => (
                                  <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                    <span style={{
                                      fontSize: 12, fontWeight: 700, color: 'var(--violet)',
                                      background: 'rgba(127,119,221,0.15)', borderRadius: 4,
                                      padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0,
                                    }}>{b.part}</span>
                                    <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{b.role}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Pattern rule */}
                            {exp.pattern && (
                              <div style={{
                                padding: '7px 10px', borderRadius: 6,
                                background: 'rgba(127,119,221,0.1)', border: '0.5px solid var(--violet-line)',
                                fontSize: 11, color: 'var(--violet)', fontFamily: 'monospace', lineHeight: 1.5,
                              }}>
                                {exp.pattern}
                              </div>
                            )}
                            {/* One more example */}
                            {exp.oneMore && (
                              <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.6)', border: '0.5px solid var(--violet-line)' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{exp.oneMore.de}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>{exp.oneMore.en}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
