import { useState, useEffect } from 'react';
import { flashcards as staticCards } from '../data/vocab';
import { Flashcards } from './Flashcards';

const API_URL = import.meta.env.VITE_API_URL || '';

const CEFR_COLOR = { B1: '#7f77dd', B2: '#5b8ff9', C1: '#1d9e75', C2: '#e24b4a' };

function WordListView({ words }) {
  if (words.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-3)', fontSize: 14 }}>
      No words in this source. Go to Explore to extract vocabulary.
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {words.map(w => {
        const retention = w.retention ?? 0;
        const reviewed = (w.reviewCount ?? 0) > 0;
        return (
          <div key={w.word} style={{
            display: 'grid', gridTemplateColumns: '44px 1fr 60px 80px',
            alignItems: 'center', gap: 12, padding: '10px 16px',
            borderRadius: 8, background: 'var(--bg)',
            border: '0.5px solid var(--line)',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, textAlign: 'center',
              background: (CEFR_COLOR[w.cefr] || '#999') + '18',
              color: CEFR_COLOR[w.cefr] || '#999'
            }}>{w.cefr}</span>
            <div>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', marginRight: 6 }}>{w.article}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{w.word}</span>
              {w.translation && <span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 10 }}>— {w.translation}</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {reviewed ? (
                <span style={{ fontSize: 12, color: retention >= 65 ? 'var(--green)' : 'var(--red)' }}>
                  {retention}%
                </span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>new</span>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                {(w.reviewCount ?? 0) === 0 ? 'not reviewed' : `${w.reviewCount}× reviewed`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IconDoc() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6L9 1z"/>
      <polyline points="9 1 9 6 14 6"/>
      <line x1="5" y1="9" x2="11" y2="9"/>
      <line x1="5" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function SourceItem({ source, selected, onClick, showingText, onToggleText }) {
  const date = source.addedAt ? new Date(source.addedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '';
  const hasText = !!(source.snippet && source.snippet.length > 80);

  return (
    <div
      style={{
        padding: '10px 12px', borderRadius: 8, marginBottom: 4,
        background: selected ? 'var(--violet-soft)' : 'transparent',
        border: selected ? '0.5px solid var(--violet-line)' : '0.5px solid transparent',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: selected ? 'var(--violet)' : 'var(--ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {source.type}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{source.wordCount}w · {date}</span>
          {hasText && (
            <button
              onClick={e => { e.stopPropagation(); onToggleText(); }}
              title={showingText ? 'Hide text' : 'View original text'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: 5, border: 'none', cursor: 'pointer',
                background: showingText ? 'var(--violet)' : 'var(--bg-3)',
                color: showingText ? '#fff' : 'var(--ink-3)',
                flexShrink: 0,
              }}
            >
              <IconDoc />
            </button>
          )}
        </div>
      </div>
      {source.snippet && (
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {source.snippet}
        </div>
      )}
    </div>
  );
}

function TextPanel({ source, onClose }) {
  return (
    <div style={{
      marginBottom: 16, borderRadius: 10,
      border: '0.5px solid var(--violet-line)',
      background: 'var(--violet-soft)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderBottom: '0.5px solid var(--violet-line)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Original text · {source.type}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--ink-3)', lineHeight: 1, padding: '0 2px',
          }}
        >×</button>
      </div>
      <div style={{
        padding: '16px 20px', fontSize: 14, lineHeight: 1.85,
        color: 'var(--ink-2)', whiteSpace: 'pre-wrap',
        maxHeight: 320, overflowY: 'auto',
      }}>
        {source.snippet}
      </div>
    </div>
  );
}

export function Learn({ userId }) {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [words, setWords] = useState([]);
  const [view, setView] = useState('list');
  const [loadingWords, setLoadingWords] = useState(true);
  const [textSourceId, setTextSourceId] = useState(null);

  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/api/sources${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`)
      .then(r => r.json())
      .then(data => {
        setSources(data);
        if (data.length > 0) setSelectedSource(data[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingWords(true);
    if (!API_URL) { setWords(staticCards); setLoadingWords(false); return; }
    const uidParam = userId ? `userId=${encodeURIComponent(userId)}` : '';
    const url = selectedSource
      ? `${API_URL}/api/words?sourceId=${encodeURIComponent(selectedSource)}${uidParam ? '&' + uidParam : ''}`
      : `${API_URL}/api/words${uidParam ? '?' + uidParam : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(data => setWords(data.length > 0 ? data : selectedSource ? [] : staticCards))
      .catch(() => setWords(staticCards))
      .finally(() => setLoadingWords(false));
  }, [selectedSource]);

  const totalWords = words.length;
  const textSource = textSourceId ? sources.find(s => s.id === textSourceId) : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>

      {/* Source sidebar */}
      <div style={{ position: 'sticky', top: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 4 }}>
          Sources
        </div>
        <div
          onClick={() => setSelectedSource(null)}
          style={{
            padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
            background: !selectedSource ? 'var(--violet-soft)' : 'transparent',
            border: !selectedSource ? '0.5px solid var(--violet-line)' : '0.5px solid transparent',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: !selectedSource ? 'var(--violet)' : 'var(--ink-2)' }}>All words</span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{sources.reduce((a, s) => a + s.wordCount, 0)}w</span>
          </div>
        </div>
        {sources.map(s => (
          <SourceItem
            key={s.id}
            source={s}
            selected={selectedSource === s.id}
            onClick={() => setSelectedSource(s.id)}
            showingText={textSourceId === s.id}
            onToggleText={() => setTextSourceId(prev => prev === s.id ? null : s.id)}
          />
        ))}
        {sources.length === 0 && API_URL && (
          <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '8px 12px' }}>
            No sources yet. Extract vocabulary first.
          </div>
        )}
      </div>

      {/* Main content */}
      <div>
        {/* Text panel */}
        {textSource && (
          <TextPanel source={textSource} onClose={() => setTextSourceId(null)} />
        )}

        {/* View toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            {loadingWords ? 'Loading…' : `${totalWords} word${totalWords !== 1 ? 's' : ''}`}
          </span>
          <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 8, padding: 3, gap: 2 }}>
            {[['list', 'Study list'], ['flashcards', 'Flashcards']].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
                  background: view === v ? '#fff' : 'transparent',
                  color: view === v ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: view === v ? 600 : 400,
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {loadingWords
          ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-3)' }}>Loading…</div>
          : view === 'list'
            ? <WordListView words={words} />
            : <Flashcards
                words={words}
                userId={userId}
                sourceText={selectedSource ? sources.find(s => s.id === selectedSource)?.snippet : undefined}
              />
        }
      </div>
    </div>
  );
}
