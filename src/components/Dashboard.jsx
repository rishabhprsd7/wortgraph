import { useState, useEffect } from 'react';
import { IconDeck } from './Icons';
import { CEFR_COLOR } from '../data/vocab';

const API_URL = import.meta.env.VITE_API_URL || '';

function RetentionBar({ value, max = 100 }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? '#d8a23d' : 'var(--red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

export function Dashboard({ userId }) {
  const [words, setWords] = useState([]);
  const [weakWords, setWeakWords] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!API_URL) { setLoading(false); return; }
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    Promise.all([
      fetch(`${API_URL}/api/words${q}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/weak${q}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/sources${q}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([w, wk, s]) => {
      setWords(Array.isArray(w) ? w : []);
      setWeakWords(Array.isArray(wk) ? wk : []);
      setSources(Array.isArray(s) ? s : []);
    }).finally(() => setLoading(false));
  }, []);

  const reviewed = words.filter(w => w.reviewCount > 0);
  const avgRetention = reviewed.length > 0
    ? Math.round(reviewed.reduce((sum, w) => sum + w.retention, 0) / reviewed.length)
    : 0;
  const cefrDist = words.reduce((acc, w) => { acc[w.cefr] = (acc[w.cefr] || 0) + 1; return acc; }, {});
  const cefrTotal = Object.values(cefrDist).reduce((a, b) => a + b, 0);

  const metrics = [
    { lbl: 'Words in deck', val: loading ? '…' : words.length, delta: `${reviewed.length} reviewed` },
    { lbl: 'Avg retention', val: loading ? '…' : reviewed.length ? `${avgRetention}%` : '—', delta: `${reviewed.length} words reviewed` },
    { lbl: 'Need review', val: loading ? '…' : weakWords.length, delta: 'retention < 65%' },
    { lbl: 'Sources', val: loading ? '…' : sources.length, delta: 'texts extracted' },
  ];

  return (
    <>
      {/* Metrics row */}
      <div className="metrics">
        {metrics.map(m => (
          <div key={m.lbl} className="metric">
            <div className="metric-lbl">{m.lbl}</div>
            <div className="metric-val">{m.val}</div>
            <div className="metric-delta">{m.delta}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        {/* CEFR distribution */}
        <div className="panel">
          <div className="panel-h">
            <span className="t">Vocabulary by level</span>
            <span className="s">{cefrTotal} words total</span>
          </div>
          <div className="panel-b">
            {loading && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Loading…</div>}
            {!loading && cefrTotal === 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No words yet — extract some vocabulary first.</p>
            )}
            {!loading && cefrTotal > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Stacked bar */}
                <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
                  {['B1','B2','C1','C2'].map(lvl => {
                    const pct = ((cefrDist[lvl] || 0) / cefrTotal) * 100;
                    return pct > 0 ? (
                      <div key={lvl} style={{ width: `${pct}%`, background: CEFR_COLOR[lvl] }} title={`${lvl}: ${cefrDist[lvl]}`} />
                    ) : null;
                  })}
                </div>
                {/* Per-level rows */}
                {['B1','B2','C1','C2'].filter(lvl => cefrDist[lvl] > 0).map(lvl => (
                  <div key={lvl} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: CEFR_COLOR[lvl], display: 'inline-block' }} />
                        <b>{lvl}</b>
                      </span>
                      <span style={{ color: 'var(--ink-3)' }}>{cefrDist[lvl]} words</span>
                    </div>
                    <RetentionBar
                      value={words.filter(w => w.cefr === lvl && w.reviewCount > 0).reduce((s, w) => s + w.retention, 0)}
                      max={words.filter(w => w.cefr === lvl && w.reviewCount > 0).length * 100 || 100}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Weak words */}
        <div className="panel">
          <div className="panel-h">
            <span className="t">Words to review</span>
            <span className="s">Below 65% retention</span>
          </div>
          <div className="panel-b">
            {loading && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Loading…</div>}
            {!loading && weakWords.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--green)', margin: 0 }}>All caught up — no weak words right now.</p>
            )}
            {!loading && weakWords.length > 0 && (
              <div className="weak-list">
                {weakWords.map(w => (
                  <div key={w.word} className="weak-item">
                    <span className={`weak-dot${w.retention < 40 ? '' : ' med'}`} />
                    <div style={{ flex: 1 }}>
                      <div className="weak-word">{w.article} {w.word}</div>
                      {w.translation && <div className="weak-trans">{w.translation}</div>}
                    </div>
                    <span className="weak-stat">{w.retention}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="panel">
        <div className="panel-h">
          <span className="t">Sources</span>
          <span className="s">Texts you've extracted from</span>
        </div>
        <div className="panel-b">
          {loading && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Loading…</div>}
          {!loading && sources.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No sources yet — paste a German text in Explore to get started.</p>
          )}
          {!loading && sources.length > 0 && (
            <div className="activity">
              {sources.map(s => (
                <div key={s.id} className="act">
                  <div className="act-icon"><IconDeck /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.type}</div>
                    {s.snippet && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{s.snippet}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {new Date(s.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ fontSize: 11, background: 'var(--violet-soft)', color: 'var(--violet)', padding: '1px 7px', borderRadius: 8 }}>
                      {s.wordCount} words
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
