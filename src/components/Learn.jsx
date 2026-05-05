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

function SourceItem({ source, selected, onClick }) {
  const date = source.addedAt ? new Date(source.addedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '';
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
        background: selected ? 'var(--violet-soft)' : 'transparent',
        border: selected ? '0.5px solid var(--violet-line)' : '0.5px solid transparent',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: selected ? 'var(--violet)' : 'var(--ink-2)' }}>{source.type}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{source.wordCount}w · {date}</span>
      </div>
      {source.snippet && (
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {source.snippet}
        </div>
      )}
    </div>
  );
}

export function Learn() {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [words, setWords] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'flashcards'
  const [loadingWords, setLoadingWords] = useState(true);

  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/api/sources`)
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
    const url = selectedSource
      ? `${API_URL}/api/words?sourceId=${encodeURIComponent(selectedSource)}`
      : `${API_URL}/api/words`;
    fetch(url)
      .then(r => r.json())
      .then(data => setWords(data.length > 0 ? data : selectedSource ? [] : staticCards))
      .catch(() => setWords(staticCards))
      .finally(() => setLoadingWords(false));
  }, [selectedSource]);

  const totalWords = words.length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>

      {/* Source history sidebar */}
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
            : <Flashcards words={words} />
        }
      </div>
    </div>
  );
}
