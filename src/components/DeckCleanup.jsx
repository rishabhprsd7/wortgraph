import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

// Audits the deck against Wiktionary and lets the user delete flagged words.
// Review-based, not auto-delete — German invents real compounds Wiktionary may
// lack, so the user makes the final call on each one.
export function DeckCleanup({ userId, onChange }) {
  const [state, setState] = useState('idle'); // idle | scanning | done
  const [flagged, setFlagged] = useState([]);
  const [total, setTotal] = useState(0);
  const [removing, setRemoving] = useState(new Set());
  const [error, setError] = useState(null);

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
      const r = await fetch(`${API_URL}/api/word`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'default', word: lemma }),
      });
      if (!r.ok) throw new Error(`Server ${r.status}`);
      setFlagged(prev => prev.filter(w => w.lemma !== lemma));
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

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-h">
        <span className="t">Deck cleanup</span>
        <span className="s">Find words that aren’t real German</span>
      </div>
      <div className="panel-b">
        {state === 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, flex: 1, minWidth: 220, lineHeight: 1.5 }}>
              Checks every word in your deck against Wiktionary and flags any that don’t exist —
              usually AI-extraction mistakes like <i>Gaukartei</i>.
            </p>
            <button className="btn btn-primary btn-sm" onClick={scan}>Scan my deck</button>
          </div>
        )}

        {state === 'scanning' && (
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Checking your deck against Wiktionary…</div>
        )}

        {state === 'done' && flagged.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              All {total} words verified — nothing to clean up.
            </span>
          </div>
        )}

        {state === 'done' && flagged.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                <b>{flagged.length}</b> of {total} words not found in Wiktionary. Review and remove the bad ones.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={scan}>Re-scan</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={removeAll}>Remove all</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {flagged.map(w => (
                <div key={w.lemma} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderRadius: 8, background: 'var(--bg-3)', border: '1px dashed rgba(186,117,23,0.5)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--amber-text)', background: 'var(--amber-soft)', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>?</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                      {w.article && <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginRight: 5 }}>{w.article}</span>}
                      {w.lemma}
                    </span>
                    {w.translation && <span style={{ fontSize: 12.5, color: 'var(--ink-3)', marginLeft: 8 }}>{w.translation}</span>}
                    {w.reviewCount > 0 && <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 8 }}>· {w.reviewCount} reviews</span>}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--red)' }}
                    disabled={removing.has(w.lemma)}
                    onClick={() => remove(w.lemma)}
                  >
                    {removing.has(w.lemma) ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--ink-4)', margin: 0, lineHeight: 1.5 }}>
              Note: some genuine rare compounds may be missing from Wiktionary. Only remove words you’re sure are wrong.
            </p>
          </div>
        )}

        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--red)' }}>{error}</div>}
      </div>
    </div>
  );
}
