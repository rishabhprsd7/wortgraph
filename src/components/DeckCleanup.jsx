import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

// Two tools:
//  1. Scan — flags words missing from BOTH Wiktionary and the DWDS corpus
//     (clear AI-extraction mistakes), review-based delete.
//  2. Remove any word — search the whole deck and delete anything, including
//     real-but-unwanted words the scanner won't flag (e.g. obscure compounds).
export function DeckCleanup({ userId, onChange }) {
  const [state, setState] = useState('idle'); // idle | scanning | done
  const [flagged, setFlagged] = useState([]);
  const [total, setTotal] = useState(0);
  const [removing, setRemoving] = useState(new Set());
  const [error, setError] = useState(null);

  const [deck, setDeck] = useState(null); // full deck for the search-remove tool
  const [query, setQuery] = useState('');

  const loadDeck = useCallback(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/api/words?userId=${encodeURIComponent(userId || 'default')}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setDeck(Array.isArray(d) ? d : []))
      .catch(() => setDeck([]));
  }, [userId]);
  useEffect(() => { loadDeck(); }, [loadDeck]);

  if (!API_URL) return null;

  const scan = async () => {
    setState('scanning'); setError(null);
    try {
      const r = await fetch(`${API_URL}/api/deck/audit?userId=${encodeURIComponent(userId || 'default')}`);
      if (!r.ok) throw new Error(`Server ${r.status}`);
      const d = await r.json();
      setFlagged(d.flagged || []);
      setTotal(d.total || 0);
      setState('done');
    } catch (e) {
      setError(e.message); setState('idle');
    }
  };

  const remove = async (lemma) => {
    setRemoving(prev => new Set(prev).add(lemma));
    try {
      const q = `userId=${encodeURIComponent(userId || 'default')}&word=${encodeURIComponent(lemma)}`;
      const r = await fetch(`${API_URL}/api/word?${q}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`Server ${r.status}`);
      const data = await r.json().catch(() => ({}));
      if (!data.removed) throw new Error(`“${lemma}” wasn’t in this deck (nothing removed)`);
      setFlagged(prev => prev.filter(w => w.lemma !== lemma));
      setDeck(prev => (prev || []).filter(w => (w.word || w.lemma) !== lemma));
      setError(null);
      onChange?.();
    } catch (e) {
      setError(`Couldn't remove ${lemma}: ${e.message}`);
    } finally {
      setRemoving(prev => { const n = new Set(prev); n.delete(lemma); return n; });
    }
  };

  const removeAll = async () => {
    for (const w of [...flagged]) await remove(w.lemma);
  };

  const q = query.trim().toLowerCase();
  const matches = q && Array.isArray(deck)
    ? deck.filter(w => {
        const lemma = (w.word || w.lemma || '').toLowerCase();
        const tr = (w.translation || '').toLowerCase();
        return lemma.includes(q) || tr.includes(q);
      }).slice(0, 8)
    : [];

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--line)',
  };

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-h">
        <span className="t">Deck cleanup</span>
        <span className="s">Remove wrong or unwanted words</span>
      </div>
      <div className="panel-b">

        {/* ── Remove any word (search) ── */}
        <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Remove a specific word</div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your deck — e.g. Gaukartei"
            style={{
              width: '100%', padding: '9px 13px', fontSize: 14, borderRadius: 9,
              border: '1.5px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none',
            }}
          />
          {q && matches.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8 }}>
              {deck === null ? 'Loading your deck…' : 'No matching word in your deck.'}
            </div>
          )}
          {matches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {matches.map(w => {
                const lemma = w.word || w.lemma;
                return (
                  <div key={lemma} style={rowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        {w.article && <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginRight: 5 }}>{w.article}</span>}
                        {lemma}
                      </span>
                      {w.translation && <span style={{ fontSize: 12.5, color: 'var(--ink-3)', marginLeft: 8 }}>{w.translation}</span>}
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                      disabled={removing.has(lemma)} onClick={() => remove(lemma)}>
                      {removing.has(lemma) ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Scan for non-words ── */}
        {state === 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, flex: 1, minWidth: 220, lineHeight: 1.5 }}>
              Or scan the whole deck for likely AI-extraction mistakes — words missing from both Wiktionary and the DWDS corpus.
            </p>
            <button className="btn btn-primary btn-sm" onClick={scan}>Scan my deck</button>
          </div>
        )}

        {state === 'scanning' && (
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Checking your deck against Wiktionary + DWDS corpus…</div>
        )}

        {state === 'done' && flagged.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              All {total} words verified — nothing flagged. Use the search above to remove anything else.
            </span>
          </div>
        )}

        {state === 'done' && flagged.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                <b>{flagged.length}</b> of {total} words not found in Wiktionary or the DWDS corpus. Review and remove the bad ones.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={scan}>Re-scan</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={removeAll}>Remove all</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {flagged.map(w => (
                <div key={w.lemma} style={{ ...rowStyle, border: '1px dashed rgba(186,117,23,0.5)' }}>
                  <span style={{ fontSize: 11, color: 'var(--amber-text)', background: 'var(--amber-soft)', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>?</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                      {w.article && <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginRight: 5 }}>{w.article}</span>}
                      {w.lemma}
                    </span>
                    {w.translation && <span style={{ fontSize: 12.5, color: 'var(--ink-3)', marginLeft: 8 }}>{w.translation}</span>}
                    {w.reviewCount > 0 && <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 8 }}>· {w.reviewCount} reviews</span>}
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                    disabled={removing.has(w.lemma)} onClick={() => remove(w.lemma)}>
                    {removing.has(w.lemma) ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--ink-4)', margin: 0, lineHeight: 1.5 }}>
              Note: a genuine rare word could still slip through. Only remove words you’re sure are wrong.
            </p>
          </div>
        )}

        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--red)' }}>{error}</div>}
      </div>
    </div>
  );
}
