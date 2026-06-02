import { useEffect, useRef, useState, useCallback } from 'react';
import { CEFR_COLOR } from '../data/vocab';

const API_URL = import.meta.env.VITE_API_URL || '';
const MEANING_COLOR = '#e0a93d';   // gold — English concept hubs
const WORD_COLOR = '#9d96e8';      // violet — German words

// Stable hash → [0,1). Same input always gives the same value, so the
// randomness is fixed per node/edge and doesn't jitter every frame.
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// Minimal force layout (adapted from Graph.jsx). Nodes: {id, kind}. Edges: {source,target}.
function useForce(nodes, edges, w, h) {
  const ref = useRef(null);
  const [, tick] = useState(0);

  // Collision radius accounts for the label, not just the dot — labels are the
  // thing that visually overlaps. Estimate label half-width from text length.
  const collideR = (n) => {
    const text = n.kind === 'meaning' ? (n.en || '') : (n.lemma || '');
    const dotR = n.kind === 'meaning' ? 18 : 12;
    const labelHalf = text.length * 4.2;           // ~font 12-14px
    return Math.max(dotR + 14, labelHalf + 6);
  };

  useEffect(() => {
    if (!nodes.length) { ref.current = null; return; }
    const prev = ref.current?.pos;
    const cx = w / 2, cy = h / 2;
    const pos = new Map();

    // Seed words around the centre with a randomised angle + radius per node,
    // so the layout reads organic instead of a perfectly even compass.
    const words = nodes.filter(n => n.kind !== 'meaning');
    const wordAngle = new Map();
    const slice = (Math.PI * 2) / Math.max(1, words.length);
    words.forEach((n, i) => {
      // Even slice as a base (keeps them spread), plus up to ±60% jitter so
      // no two sit on a clean cardinal axis.
      const jitter = (hash01(n.id) - 0.5) * slice * 1.2;
      wordAngle.set(n.id, i * slice + jitter);
    });

    nodes.forEach((n) => {
      const keep = prev?.get(n.id);
      if (keep) { pos.set(n.id, keep); return; }
      if (n.kind === 'meaning') {
        pos.set(n.id, { x: cx + (Math.random() - 0.5) * 20, y: cy + (Math.random() - 0.5) * 20, vx: 0, vy: 0 });
      } else {
        const a = wordAngle.get(n.id) ?? Math.random() * Math.PI * 2;
        // Vary seed radius 0.24–0.42 of the canvas so spokes start uneven.
        const r = Math.min(w, h) * (0.24 + hash01(n.id + '·r') * 0.18);
        pos.set(n.id, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0 });
      }
    });
    ref.current = { pos, alpha: 1 };
  }, [nodes, w, h]);

  useEffect(() => {
    let raf;
    const step = () => {
      const st = ref.current;
      if (st && st.alpha > 0.005) {
        const cx = w / 2, cy = h / 2;

        // 1. Charge repulsion — strong, so nodes fan out in all directions.
        for (const n of nodes) {
          const p = st.pos.get(n.id); if (!p) continue;
          for (const m of nodes) {
            if (m.id === n.id) continue;
            const q = st.pos.get(m.id); if (!q) continue;
            const dx = p.x - q.x, dy = p.y - q.y;
            const d2 = dx * dx + dy * dy + 0.01;
            const f = 14000 / d2;
            const d = Math.sqrt(d2);
            p.vx += (dx / d) * f * 0.001;
            p.vy += (dy / d) * f * 0.001;
          }
        }

        // 2. Link springs. Hub spokes are soft + long so crowded words drift
        //    outward into a second ring instead of stacking on the hub. Each
        //    spoke gets its OWN resting length (hash-based) so some lines are
        //    long, some short — an organic, non-uniform look.
        for (const e of edges) {
          const p = st.pos.get(e.source), q = st.pos.get(e.target);
          if (!p || !q) continue;
          const dx = q.x - p.x, dy = q.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const wobble = hash01(e.source + '→' + e.target); // 0..1, stable
          const target = e.hub ? 120 + wobble * 90 : 80 + wobble * 40;
          const f = (dist - target) * (e.hub ? 0.045 : 0.04);
          p.vx += (dx / dist) * f; p.vy += (dy / dist) * f;
          q.vx -= (dx / dist) * f; q.vy -= (dy / dist) * f;
        }

        // 3. Gentle centring.
        for (const n of nodes) {
          const p = st.pos.get(n.id); if (!p) continue;
          const pull = n.kind === 'meaning' ? 0.02 : 0.006;
          p.vx += (cx - p.x) * pull; p.vy += (cy - p.y) * pull;
          p.vx *= 0.82; p.vy *= 0.82;
          p.x += p.vx * st.alpha; p.y += p.vy * st.alpha;
        }

        // 4. Hard collision pass — circles (incl. labels) never overlap.
        //    Run a few iterations so dense clusters fully separate.
        for (let iter = 0; iter < 3; iter++) {
          for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i], pa = st.pos.get(a.id); if (!pa) continue;
            const ra = collideR(a);
            for (let j = i + 1; j < nodes.length; j++) {
              const b = nodes[j], pb = st.pos.get(b.id); if (!pb) continue;
              const rb = collideR(b);
              let dx = pb.x - pa.x, dy = pb.y - pa.y;
              let dist = Math.sqrt(dx * dx + dy * dy);
              const min = ra + rb;
              if (dist < min) {
                if (dist < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dist = 0.5; }
                const push = (min - dist) / 2;
                const ux = dx / dist, uy = dy / dist;
                pa.x -= ux * push; pa.y -= uy * push;
                pb.x += ux * push; pb.y += uy * push;
              }
            }
          }
        }

        st.alpha *= 0.985;
        tick(x => x + 1);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges, w, h]);

  const reheat = () => { if (ref.current) ref.current.alpha = 1; };
  return [ref.current?.pos, reheat];
}

export function Concepts({ userId, setRoute }) {
  const [hubs, setHubs] = useState(null);     // null = loading, [] = none
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [building, setBuilding] = useState(false);
  const [buildErr, setBuildErr] = useState(null);

  // graph state: nodes + edges built from one or more loaded meanings
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loadedMeanings, setLoadedMeanings] = useState({}); // id -> {en}
  const [selected, setSelected] = useState(null);

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false), dragStart = useRef(null), dragMoved = useRef(false);

  // ── load hub list ──
  const loadHubs = useCallback(() => {
    if (!API_URL) { setHubs([]); return; }
    fetch(`${API_URL}/api/meanings?userId=${encodeURIComponent(userId || 'default')}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setHubs(Array.isArray(d) ? d : []))
      .catch(() => setHubs([]));
  }, [userId]);
  useEffect(() => { loadHubs(); }, [loadHubs]);

  // ── resize observer ──
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [activeId]);

  // ── load one meaning into the graph (merging with what's there) ──
  const loadMeaning = useCallback(async (id) => {
    if (!API_URL || loadedMeanings[id]) return;
    const res = await fetch(`${API_URL}/api/meanings/graph?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(userId || 'default')}`);
    if (!res.ok) return;
    const data = await res.json();
    setLoadedMeanings(prev => ({ ...prev, [id]: { en: data.meaning.en } }));
    setGraph(prev => {
      const nodeMap = new Map(prev.nodes.map(n => [n.id, n]));
      const hubKey = `m:${id}`;
      if (!nodeMap.has(hubKey)) nodeMap.set(hubKey, { id: hubKey, kind: 'meaning', en: data.meaning.en });
      for (const w of data.words) {
        const wk = `w:${w.lemma}`;
        if (!nodeMap.has(wk)) nodeMap.set(wk, { id: wk, kind: 'word', ...w });
      }
      const edgeKey = e => `${e.source}|${e.target}|${e.hub ? 'h' : e.rel}`;
      const edgeMap = new Map(prev.edges.map(e => [edgeKey(e), e]));
      for (const w of data.words) {
        const e = { source: hubKey, target: `w:${w.lemma}`, hub: true };
        edgeMap.set(edgeKey(e), e);
      }
      for (const e of data.edges) {
        const ne = { source: `w:${e.source}`, target: `w:${e.target}`, rel: e.rel, hub: false };
        edgeMap.set(edgeKey(ne), ne);
      }
      return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
    });
  }, [loadedMeanings, userId]);

  const openHub = (id) => {
    setActiveId(id);
    setGraph({ nodes: [], edges: [] });
    setLoadedMeanings({});
    setSelected(null);
    setTransform({ x: 0, y: 0, scale: 1 });
    // defer so reset lands first
    setTimeout(() => loadMeaning(id), 0);
  };

  const backToSearch = () => { setActiveId(null); setGraph({ nodes: [], edges: [] }); setLoadedMeanings({}); };

  const [positions, reheat] = useForce(graph.nodes, graph.edges, size.w, size.h);

  // wheel zoom (passive:false, same fix as Graph.jsx)
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const sf = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setTransform(p => {
        const ns = Math.min(6, Math.max(0.15, p.scale * sf));
        const ratio = ns / p.scale;
        return { x: mx - (mx - p.x) * ratio, y: my - (my - p.y) * ratio, scale: ns };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [activeId]);

  const onDown = (e) => { if (e.button !== 0) return; dragging.current = true; dragMoved.current = false; dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y }; };
  const onMove = (e) => { if (dragging.current && dragStart.current) { dragMoved.current = true; setTransform(p => ({ ...p, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })); } };
  const onUp = () => { dragging.current = false; dragStart.current = null; };

  // click a word → pull in its OTHER meanings (expand)
  const expandWord = async (lemma) => {
    const res = await fetch(`${API_URL}/api/word/meanings?word=${encodeURIComponent(lemma)}&userId=${encodeURIComponent(userId || 'default')}`);
    if (!res.ok) return;
    const others = await res.json();
    for (const m of others) if (!loadedMeanings[m.id]) await loadMeaning(m.id);
  };

  const onNodeClick = (n) => {
    if (dragMoved.current) return;
    setSelected(s => (s === n.id ? null : n.id));
    if (n.kind === 'word') expandWord(n.lemma);
  };

  const filtered = (hubs || []).filter(h =>
    !query.trim() || h.en.toLowerCase().includes(query.trim().toLowerCase()) ||
    h.sample.some(s => s.toLowerCase().includes(query.trim().toLowerCase())));

  // neighbor highlight
  const neighbors = new Set();
  if (selected) {
    neighbors.add(selected);
    for (const e of graph.edges) {
      if (e.source === selected) neighbors.add(e.target);
      if (e.target === selected) neighbors.add(e.source);
    }
  }

  // ── BUILD VIEW: graph for an active meaning ──
  if (activeId) {
    const activeEn = loadedMeanings[activeId]?.en || '…';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="t">“{activeEn}” — ways to say it in German</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { reheat(); setTransform({ x: 0, y: 0, scale: 1 }); }}>Re-layout</button>
              <button className="btn btn-ghost btn-sm" onClick={backToSearch}>← All concepts</button>
            </div>
          </div>
        </div>

        <div ref={containerRef} style={{
          position: 'relative', height: 'calc(100vh - 300px)', minHeight: 460,
          border: 'var(--hairline)', borderRadius: 12,
          background: 'radial-gradient(ellipse at center, #1c1b2e 0%, #0f0f1a 100%)',
          overflow: 'hidden', userSelect: 'none',
        }}>
          <svg ref={svgRef} width={size.w} height={size.h} style={{ display: 'block', cursor: 'grab' }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
              {positions && graph.edges.map((e, i) => {
                const p = positions.get(e.source), q = positions.get(e.target);
                if (!p || !q) return null;
                const dim = selected && !(neighbors.has(e.source) && neighbors.has(e.target));
                const stroke = dim ? 'rgba(255,255,255,0.04)'
                  : e.hub ? 'rgba(224,169,61,0.45)'
                  : e.rel === 'SYNONYM_OF' ? 'rgba(123,224,176,0.5)' : 'rgba(197,184,255,0.5)';
                return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={stroke}
                  strokeWidth={e.hub ? 2 : 1.5} strokeDasharray={e.hub ? '' : '4 3'} />;
              })}
              {positions && graph.nodes.map(n => {
                const p = positions.get(n.id);
                if (!p) return null;
                const isHub = n.kind === 'meaning';
                const isSel = selected === n.id;
                const isNb = selected && neighbors.has(n.id);
                const dim = selected && !isNb && !isSel;
                const r = isHub ? 16 : 11;
                const color = isHub ? MEANING_COLOR : (CEFR_COLOR[n.cefr] || WORD_COLOR);
                return (
                  <g key={n.id} style={{ cursor: 'pointer', opacity: dim ? 0.18 : 1 }}
                    onClick={() => onNodeClick(n)}>
                    {isSel && <circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.4} />}
                    {isHub && <circle cx={p.x} cy={p.y} r={r + 4} fill="none" stroke={MEANING_COLOR} strokeWidth={1} opacity={0.3} />}
                    <circle cx={p.x} cy={p.y} r={r} fill={color}
                      stroke={isHub ? '#fff7e6' : isSel ? '#fff' : 'rgba(0,0,0,0.3)'}
                      strokeWidth={isHub ? 2 : isSel ? 2.5 : 1} />
                    <text x={p.x} y={p.y - r - 5} textAnchor="middle"
                      fill={dim ? 'rgba(255,255,255,0.2)' : isHub ? '#ffe9bd' : 'rgba(255,255,255,0.9)'}
                      fontSize={isHub ? 14 : 12} fontWeight={isHub ? 700 : 500}
                      fontStyle={isHub ? 'italic' : 'normal'}
                      style={{ pointerEvents: 'none', fontFamily: "'Inter', sans-serif" }}>
                      {isHub ? n.en : n.lemma}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          <div style={{
            position: 'absolute', bottom: 14, left: 14, background: 'rgba(14,12,28,0.85)',
            backdropFilter: 'blur(8px)', padding: '10px 14px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 11,
            display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 260,
          }}>
            <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>How to read this</div>
            <div><span style={{ color: '#ffd98a' }}>● </span>Gold = English meaning</div>
            <div><span style={{ color: '#b9b2f0' }}>● </span>Violet = German word for it</div>
            <div>Dashed line = synonym / word-form link</div>
            <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.4)' }}>Click a German word to pull in its other meanings · scroll to zoom</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h"><span className="t">The Cypher behind this view</span></div>
          <div className="panel-b">
            <pre style={{ margin: 0, padding: 14, background: '#0f0f1a', color: '#a59cf0', fontSize: 11, lineHeight: 1.5, borderRadius: 8, overflowX: 'auto', fontFamily: "'JetBrains Mono', monospace" }}>{`// The meaning hub and every German word that expresses it
MATCH (u:User {id: $userId})-[:ADDED]->(w:Word)-[:MEANS]->(m:Meaning {id: $id})
RETURN m, collect(w)

// Inner structure: synonym / form edges between those words
MATCH (u)-[:ADDED]->(a:Word)-[:MEANS]->(m)
MATCH (u)-[:ADDED]->(b:Word)-[:MEANS]->(m)
MATCH (a)-[r:SYNONYM_OF|FORM_OF]-(b)
RETURN a.lemma, type(r), b.lemma`}</pre>
          </div>
        </div>
      </div>
    );
  }

  // ── SEARCH / LIST VIEW ──
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 18 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search a concept or word — e.g. “decision”, “increase”…"
          style={{
            width: '100%', padding: '12px 16px', fontSize: 15, borderRadius: 12,
            border: '1.5px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none',
          }}
        />
      </div>

      {hubs === null && <div style={{ textAlign: 'center', padding: 50, color: 'var(--ink-3)' }}>Loading concepts…</div>}

      {hubs && hubs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', border: 'var(--hairline)', borderRadius: 14, background: 'var(--bg-2)' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🧩</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>No concepts built yet</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-3)', maxWidth: 380, margin: '0 auto 18px', lineHeight: 1.6 }}>
            Wortgraph groups your German words by shared English meaning — one concept, every way to say it.
            Build them from your current deck.
          </div>
          {buildErr && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 12 }}>{buildErr}</div>}
          <button className="btn btn-primary btn-sm" disabled={building} onClick={async () => {
            setBuilding(true); setBuildErr(null);
            try {
              const r = await fetch(`${API_URL}/api/meanings/build`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId || 'default' }),
              });
              const d = await r.json();
              if (!r.ok || d.error) throw new Error(d.error || `Server ${r.status}`);
              loadHubs();
            } catch (e) { setBuildErr(e.message); } finally { setBuilding(false); }
          }}>
            {building ? 'Building…' : 'Build concepts from my deck'}
          </button>
          {setRoute && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setRoute('explore')}>Add more words first →</button>
            </div>
          )}
        </div>
      )}

      {hubs && hubs.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{filtered.length} concept{filtered.length === 1 ? '' : 's'}</span>
            <button className="btn btn-ghost btn-sm" disabled={building} onClick={async () => {
              setBuilding(true); setBuildErr(null);
              try {
                const r = await fetch(`${API_URL}/api/meanings/build`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: userId || 'default' }),
                });
                const d = await r.json();
                if (!r.ok || d.error) throw new Error(d.error || `Server ${r.status}`);
                loadHubs();
              } catch (e) { setBuildErr(e.message); } finally { setBuilding(false); }
            }}>{building ? 'Rebuilding…' : '↻ Rebuild'}</button>
          </div>
          {buildErr && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 12 }}>{buildErr}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {filtered.map(h => (
              <button key={h.id} onClick={() => openHub(h.id)} style={{
                textAlign: 'left', padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                border: '1.5px solid var(--line)', background: 'var(--bg-2)',
                display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.14s, transform 0.14s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'none'; }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', fontStyle: 'italic' }}>{h.en}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)', background: 'var(--violet-soft)', borderRadius: 999, padding: '2px 8px' }}>{h.wordCount}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.sample.join(' · ')}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
