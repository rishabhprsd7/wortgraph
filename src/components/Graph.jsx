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
  const t = (n.topics && n.topics[0]) || 'Unknown';
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
  return `hsl(${h}, 60%, 60%)`;
}

function useForceLayout(nodes, edges, width, height) {
  const stateRef = useRef(null);
  const [, force] = useState(0);

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

  useEffect(() => {
    let raf;
    const tick = () => {
      const st = stateRef.current;
      if (st && st.alpha > 0.01) {
        const repulsion = 3200;
        const linkDist = 120;
        const linkStrength = 0.06;
        const centerStrength = 0.012;

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

  const reheat = () => { if (stateRef.current) stateRef.current.alpha = 1; };
  return [stateRef.current?.positions, reheat];
}

export function Graph({ userId }) {
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [colorMode, setColorMode] = useState('topic');
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [minStrength, setMinStrength] = useState(1);
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 560 });

  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef(null);
  const dragMovedRef = useRef(false);

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
      const uidParam = userId ? `&userId=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`${API_URL}/api/graph?minStrength=${minStrength}${uidParam}`);
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
  const hoveredNode = data.nodes.find(n => n.id === hovered);

  // Zoom on wheel
  const handleWheel = (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const scaleFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setTransform(prev => {
      const newScale = Math.min(6, Math.max(0.15, prev.scale * scaleFactor));
      const ratio = newScale / prev.scale;
      return { x: mouseX - (mouseX - prev.x) * ratio, y: mouseY - (mouseY - prev.y) * ratio, scale: newScale };
    });
  };

  // Pan on drag
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    draggingRef.current = true;
    dragMovedRef.current = false;
    dragStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e) => {
    if (draggingRef.current && dragStartRef.current) {
      dragMovedRef.current = true;
      setTransform(prev => ({ ...prev, x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y }));
    }
    if (hovered && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
    dragStartRef.current = null;
  };

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Controls */}
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h">
          <span className="t">Your vocabulary graph</span>
          <span className="s">{data.nodes.length} words · {data.edges.length} co-occurrence edges</span>
        </div>
        <div className="panel-b" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Color by:</span>
            {['topic', 'cefr', 'retention'].map(m => (
              <button key={m} onClick={() => setColorMode(m)} style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 14,
                background: colorMode === m ? 'var(--violet)' : 'var(--bg-2)',
                color: colorMode === m ? '#fff' : 'var(--ink-2)',
                border: 'var(--hairline)', cursor: 'pointer',
              }}>{m}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Min edge strength:</span>
            <select value={minStrength} onChange={e => setMinStrength(parseInt(e.target.value, 10))}
              style={{ fontSize: 12, padding: '4px 8px', border: 'var(--hairline-strong)', borderRadius: 6, background: 'var(--bg)' }}>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { reheat(); resetView(); }}>Re-layout</button>
          <button className="btn btn-ghost btn-sm" onClick={resetView}>Reset zoom</button>
          <button className="btn btn-ghost btn-sm" onClick={fetchGraph}>Reload</button>
        </div>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} style={{
        position: 'relative', height: 'calc(100vh - 280px)', minHeight: 500,
        border: 'var(--hairline)', borderRadius: 12,
        background: 'radial-gradient(ellipse at center, #1c1b2e 0%, #0f0f1a 100%)',
        overflow: 'hidden', userSelect: 'none',
      }}>
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

        <svg
          ref={svgRef}
          width={size.w} height={size.h}
          style={{ display: 'block', cursor: draggingRef.current ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setHovered(null); }}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            {/* Edges */}
            {positions && data.edges.map((e, i) => {
              const p = positions.get(e.source), q = positions.get(e.target);
              if (!p || !q) return null;
              const dim = selected && !(neighborSet.has(e.source) && neighborSet.has(e.target));
              return (
                <line key={i}
                  x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                  stroke={dim ? 'rgba(255,255,255,0.03)' : 'rgba(165,156,240,0.3)'}
                  strokeWidth={Math.min(4, 1 + e.strength * 0.7)}
                />
              );
            })}

            {/* Nodes */}
            {positions && data.nodes.map(n => {
              const p = positions.get(n.id);
              if (!p) return null;
              const isSelected = selected === n.id;
              const isNeighbor = selected && neighborSet.has(n.id);
              const dim = selected && !isNeighbor && !isSelected;
              const baseR = 10 + Math.min(8, (n.reviews || 0) * 0.6);
              const r = isSelected ? baseR + 5 : isNeighbor ? baseR + 2 : baseR;
              const color = colorForNode(n, colorMode);
              return (
                <g key={n.id}
                  style={{ cursor: 'pointer', opacity: dim ? 0.15 : 1 }}
                  onClick={() => { if (!dragMovedRef.current) setSelected(s => s === n.id ? null : n.id); }}
                  onMouseEnter={() => { setHovered(n.id); }}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Glow ring for selected */}
                  {isSelected && (
                    <circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.35} />
                  )}
                  <circle
                    cx={p.x} cy={p.y} r={r}
                    fill={color}
                    stroke={isSelected ? '#fff' : isNeighbor ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'}
                    strokeWidth={isSelected ? 2.5 : isNeighbor ? 1.5 : 1}
                  />
                  {/* Word label — always visible */}
                  <text
                    x={p.x} y={p.y - r - 5}
                    fill={dim ? 'rgba(255,255,255,0.2)' : isSelected ? '#fff' : 'rgba(255,255,255,0.88)'}
                    fontSize={isSelected ? 14 : 12}
                    fontWeight={isSelected ? 700 : 500}
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', fontFamily: "'Inter', sans-serif" }}
                  >{n.id}</text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredNode && !selected && (
          <div style={{
            position: 'absolute',
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 10,
            pointerEvents: 'none',
            background: 'rgba(14,12,28,0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(165,156,240,0.35)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#fff',
            fontSize: 12,
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {hoveredNode.article && <span style={{ color: '#a59cf0', fontSize: 11 }}>{hoveredNode.article}</span>}
              <span style={{ fontWeight: 700, fontSize: 14 }}>{hoveredNode.id}</span>
              {hoveredNode.cefr && (
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: (CEFR_COLOR[hoveredNode.cefr] || '#999') + '33', color: CEFR_COLOR[hoveredNode.cefr] || '#fff' }}>
                  {hoveredNode.cefr}
                </span>
              )}
            </div>
            {hoveredNode.translation && (
              <div style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: 2 }}>{hoveredNode.translation}</div>
            )}
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
              {hoveredNode.reviews > 0 ? `${hoveredNode.retention}% retention · ${hoveredNode.reviews} reviews` : 'Not reviewed yet'} · Click to explore
            </div>
          </div>
        )}

        {/* Selected node panel */}
        {selectedNode && (
          <div style={{
            position: 'absolute', top: 16, right: 16,
            width: 260, padding: 16,
            background: 'rgba(14,12,28,0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(165,156,240,0.3)',
            borderRadius: 12, color: 'rgba(255,255,255,0.9)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                {selectedNode.article && <div style={{ color: '#a59cf0', fontSize: 12 }}>{selectedNode.article}</div>}
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{selectedNode.id}</div>
                {selectedNode.translation && (
                  <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>{selectedNode.translation}</div>
                )}
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {selectedNode.cefr && (
                <span style={{ background: (CEFR_COLOR[selectedNode.cefr] || '#999') + '33', color: CEFR_COLOR[selectedNode.cefr] || '#fff', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                  {selectedNode.cefr}
                </span>
              )}
              {(selectedNode.topics || []).map(t => (
                <span key={t} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: 8, fontSize: 11 }}>{t}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              <div>Retention: <b style={{ color: '#fff' }}>{selectedNode.retention}%</b> · {selectedNode.reviews} reviews</div>
              <div>Connected to <b style={{ color: '#fff' }}>{neighborSet.size - 1}</b> other words</div>
            </div>
          </div>
        )}

        {/* Legend + zoom hint */}
        {!loading && !error && data.nodes.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 14, left: 14,
            background: 'rgba(14,12,28,0.85)', backdropFilter: 'blur(8px)',
            padding: '10px 14px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.6)', fontSize: 11,
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>How to read this</div>
            <div>• Each dot = one word you've saved</div>
            <div>• Dot size = how many times you've reviewed it</div>
            <div>• Lines = words that appeared in the same text</div>
            <div>• Thicker line = appeared together more often</div>
            <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.35)' }}>Scroll to zoom · drag to pan · click a word</div>
          </div>
        )}

        {/* Zoom level indicator */}
        {transform.scale !== 1 && (
          <div style={{
            position: 'absolute', bottom: 14, right: 14,
            background: 'rgba(14,12,28,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, padding: '4px 10px',
            fontSize: 11, color: 'rgba(255,255,255,0.5)',
          }}>
            {Math.round(transform.scale * 100)}%
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
