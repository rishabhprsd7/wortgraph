import { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

const CEFR_COLOR = { B1: '#7f77dd', B2: '#5b8ff9', C1: '#1d9e75', C2: '#e24b4a' };
const DEFAULT_COLOR = '#9d96e8';

function colorForNode(n, mode) {
  if (mode === 'cefr') return CEFR_COLOR[n.cefr] || DEFAULT_COLOR;
  if (mode === 'retention') {
    if (n.reviews === 0) return '#7d7a90';
    if (n.retention >= 70) return '#1d9e75';
    if (n.retention >= 40) return '#d8a23d';
    return '#e24b4a';
  }
  // topic mode — hash topic string to a hue
  const t = (n.topics && n.topics[0]) || 'Unknown';
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
  return `hsl(${h}, 60%, 60%)`;
}

// Minimal force simulation: repulsion between all nodes, springs along edges, soft centring.
function useForceLayout(nodes, edges, width, height) {
  const stateRef = useRef(null);
  const [, force] = useState(0); // re-render trigger

  // (Re)build state when graph changes.
  useEffect(() => {
    if (!nodes.length) { stateRef.current = null; return; }
    const cx = width / 2, cy = height / 2;
    const positions = new Map();
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const r = Math.min(width, height) * 0.3;
      positions.set(n.id, {
        x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 30,
        y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 30,
        vx: 0, vy: 0,
      });
    });
    stateRef.current = { positions, alpha: 1 };
  }, [nodes, width, height]);

  // Animate.
  useEffect(() => {
    let raf;
    const tick = () => {
      const st = stateRef.current;
      if (st && st.alpha > 0.01) {
        const repulsion = 1800;
        const linkDist = 80;
        const linkStrength = 0.08;
        const centerStrength = 0.015;

        for (const n of nodes) {
          const p = st.positions.get(n.id);
          for (const m of nodes) {
            if (m.id === n.id) continue;
            const q = st.positions.get(m.id);
            const dx = p.x - q.x, dy = p.y - q.y;
            const dist2 = dx * dx + dy * dy + 0.01;
            const f = repulsion / dist2;
            p.vx += (dx / Math.sqrt(dist2)) * f * 0.001;
            p.vy += (dy / Math.sqrt(dist2)) * f * 0.001;
          }
        }
        for (const e of edges) {
          const p = st.positions.get(e.source), q = st.positions.get(e.target);
          if (!p || !q) continue;
          const dx = q.x - p.x, dy = q.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = (dist - linkDist) * linkStrength * Math.min(1, e.strength / 3);
          p.vx += (dx / dist) * f;
          p.vy += (dy / dist) * f;
          q.vx -= (dx / dist) * f;
          q.vy -= (dy / dist) * f;
        }
        const cx = width / 2, cy = height / 2;
        for (const n of nodes) {
          const p = st.positions.get(n.id);
          p.vx += (cx - p.x) * centerStrength;
          p.vy += (cy - p.y) * centerStrength;
          p.vx *= 0.85;
          p.vy *= 0.85;
          p.x += p.vx * st.alpha;
          p.y += p.vy * st.alpha;
        }
        st.alpha *= 0.99;
        force(x => x + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges, width, height]);

  // External re-heat function.
  const reheat = () => { if (stateRef.current) stateRef.current.alpha = 1; };

  return [stateRef.current?.positions, reheat];
}

export function Graph() {
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [colorMode, setColorMode] = useState('topic');
  const [selected, setSelected] = useState(null);
  const [minStrength, setMinStrength] = useState(1);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 560 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const fetchGraph = async () => {
    if (!API_URL) { setError('API not configured'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/graph?minStrength=${minStrength}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGraph(); }, [minStrength]);

  const [positions, reheat] = useForceLayout(data.nodes, data.edges, size.w, size.h);

  const neighborSet = new Set();
  if (selected) {
    neighborSet.add(selected);
    for (const e of data.edges) {
      if (e.source === selected) neighborSet.add(e.target);
      if (e.target === selected) neighborSet.add(e.source);
    }
  }

  const selectedNode = data.nodes.find(n => n.id === selected);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stats + legend */}
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h">
          <span className="t">Your vocabulary graph</span>
          <span className="s">{data.nodes.length} words · {data.edges.length} co-occurrence edges</span>
        </div>
        <div className="panel-b" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Color by:</span>
            {['topic', 'cefr', 'retention'].map(m => (
              <button
                key={m}
                onClick={() => setColorMode(m)}
                style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 14,
                  background: colorMode === m ? 'var(--violet)' : 'var(--bg-2)',
                  color: colorMode === m ? '#fff' : 'var(--ink-2)',
                  border: 'var(--hairline)', cursor: 'pointer',
                }}
              >{m}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Min edge strength:</span>
            <select value={minStrength} onChange={e => setMinStrength(parseInt(e.target.value, 10))} style={{ fontSize: 12, padding: '4px 8px', border: 'var(--hairline-strong)', borderRadius: 6, background: 'var(--bg)' }}>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reheat}>Re-layout</button>
          <button className="btn btn-ghost btn-sm" onClick={fetchGraph}>Reload</button>
        </div>
      </div>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        style={{
          position: 'relative', height: 600,
          border: 'var(--hairline)', borderRadius: 12,
          background: 'radial-gradient(ellipse at center, #1c1b2e 0%, #0f0f1a 100%)',
          overflow: 'hidden',
        }}
      >
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            Loading graph…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e24b4a', fontSize: 13 }}>
            {error}
          </div>
        )}
        {!loading && !error && data.nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: 30, textAlign: 'center' }}>
            No graph yet. Extract words from a few sources to see your vocabulary network form.
          </div>
        )}
        <svg width={size.w} height={size.h} style={{ display: 'block' }}>
          {/* Edges */}
          {positions && data.edges.map((e, i) => {
            const p = positions.get(e.source), q = positions.get(e.target);
            if (!p || !q) return null;
            const dim = selected && !(neighborSet.has(e.source) && neighborSet.has(e.target));
            return (
              <line
                key={i}
                x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                stroke={dim ? 'rgba(255,255,255,0.04)' : 'rgba(165,156,240,0.25)'}
                strokeWidth={Math.min(3, 0.5 + e.strength * 0.6)}
              />
            );
          })}
          {/* Nodes */}
          {positions && data.nodes.map(n => {
            const p = positions.get(n.id);
            if (!p) return null;
            const isSelected = selected === n.id;
            const isNeighbor = selected && neighborSet.has(n.id);
            const dim = selected && !isNeighbor;
            const r = isSelected ? 9 : isNeighbor ? 7 : 5 + Math.min(5, n.reviews * 0.4);
            return (
              <g key={n.id} style={{ cursor: 'pointer', opacity: dim ? 0.18 : 1 }}
                 onClick={() => setSelected(s => s === n.id ? null : n.id)}>
                <circle
                  cx={p.x} cy={p.y} r={r}
                  fill={colorForNode(n, colorMode)}
                  stroke={isSelected ? '#fff' : 'rgba(0,0,0,0.4)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {(isSelected || isNeighbor || data.nodes.length < 40) && (
                  <text
                    x={p.x} y={p.y - r - 4}
                    fill="rgba(255,255,255,0.85)"
                    fontSize={11}
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', fontFamily: "'IBM Plex Serif', Georgia, serif" }}
                  >{n.id}</text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Selection panel */}
        {selectedNode && (
          <div style={{
            position: 'absolute', top: 16, right: 16,
            width: 240, padding: 14,
            background: 'rgba(20,18,32,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: 'rgba(255,255,255,0.9)',
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
              <div>
                <div style={{ color: '#a59cf0', fontSize: 12 }}>{selectedNode.article}</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{selectedNode.id}</div>
                {selectedNode.translation && (
                  <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{selectedNode.translation}</div>
                )}
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {selectedNode.cefr && <span style={{ background: (CEFR_COLOR[selectedNode.cefr] || '#999') + '33', color: CEFR_COLOR[selectedNode.cefr] || '#fff', padding: '2px 7px', borderRadius: 8, fontSize: 11 }}>{selectedNode.cefr}</span>}
              {(selectedNode.topics || []).map(t => (
                <span key={t} style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: 8, fontSize: 11 }}>{t}</span>
              ))}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              <div>Retention: <b>{selectedNode.retention}%</b> · {selectedNode.reviews} reviews</div>
              <div>Connected to <b>{neighborSet.size - 1}</b> words</div>
            </div>
          </div>
        )}

        {/* Legend */}
        {!loading && !error && data.nodes.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 14, left: 14,
            background: 'rgba(20,18,32,0.85)', backdropFilter: 'blur(8px)',
            padding: '10px 14px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.7)', fontSize: 11,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 2 }}>Legend</div>
            <div>• Node size = review count</div>
            <div>• Edge thickness = co-occurrence strength</div>
            <div>• Click any node to see its neighborhood</div>
          </div>
        )}
      </div>

      {/* Cypher reveal */}
      <div className="panel">
        <div className="panel-h"><span className="t">The Cypher behind this graph</span></div>
        <div className="panel-b">
          <pre style={{
            margin: 0, padding: 14, background: '#0f0f1a', color: '#a59cf0',
            fontSize: 11, lineHeight: 1.5, borderRadius: 8, overflowX: 'auto',
            fontFamily: "'JetBrains Mono', monospace",
          }}>{`// Nodes: every Word the user has added
MATCH (u:User {id: $userId})-[r:ADDED]->(w:Word)
OPTIONAL MATCH (w)-[:BELONGS_TO]->(t:Topic)
RETURN w, r, collect(t.name) AS topics

// Edges: CO_OCCURS_WITH between any two of those words
MATCH (u)-[:ADDED]->(a:Word)-[r:CO_OCCURS_WITH]-(b:Word)<-[:ADDED]-(u)
WHERE id(a) < id(b) AND r.strength >= ${minStrength}
RETURN a.lemma, b.lemma, r.strength`}</pre>
        </div>
      </div>
    </div>
  );
}
