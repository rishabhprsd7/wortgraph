import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

const CEFR_COLOR = { B1: '#7f77dd', B2: '#5b8ff9', C1: '#1d9e75', C2: '#e24b4a' };
const CEFR_ORDER = ['B1', 'B2', 'C1', 'C2'];

function CefrBar({ distribution }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 3, height: 8, borderRadius: 6, overflow: 'hidden' }}>
        {CEFR_ORDER.map(lvl => {
          const pct = ((distribution[lvl] || 0) / total) * 100;
          return pct > 0 ? (
            <div key={lvl} style={{ width: `${pct}%`, background: CEFR_COLOR[lvl] }} title={`${lvl}: ${distribution[lvl]} words`} />
          ) : null;
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {CEFR_ORDER.filter(lvl => distribution[lvl] > 0).map(lvl => (
          <span key={lvl} style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: CEFR_COLOR[lvl], display: 'inline-block' }} />
            {lvl}: {distribution[lvl]}
          </span>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ icon, insight, children }) {
  const [showCypher, setShowCypher] = useState(false);
  if (!insight) return null;
  return (
    <div style={{
      border: 'var(--hairline)', borderRadius: 12, background: 'var(--bg)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ padding: '14px 16px', borderBottom: 'var(--hairline)', background: 'var(--bg-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{insight.title}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '6px 0 0', lineHeight: 1.5 }}>
          {insight.reasoning}
        </p>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {children}
      </div>
      <button
        onClick={() => setShowCypher(s => !s)}
        style={{
          background: 'transparent', border: 'none', borderTop: 'var(--hairline)',
          padding: '8px 16px', textAlign: 'left', cursor: 'pointer',
          fontSize: 11, color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace",
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span>{showCypher ? '▾' : '▸'}</span>
        <span>{showCypher ? 'hide' : 'show'} Cypher query</span>
      </button>
      {showCypher && (
        <pre style={{
          margin: 0, padding: '10px 16px 14px', fontSize: 11, lineHeight: 1.5,
          background: '#0f0f1a', color: '#a59cf0', overflowX: 'auto',
          fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap',
        }}>{insight.cypher}</pre>
      )}
    </div>
  );
}

function BridgesPanel({ insight }) {
  if (!insight?.results?.length) {
    return <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No bridge words yet — add words from a few different sources to see connections form.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {insight.results.map(r => (
        <div key={r.word} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--violet)', fontSize: 13, fontWeight: 500 }}>{r.article}</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{r.word}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>{r.translation}</span>
            {r.cefr && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: (CEFR_COLOR[r.cefr] || '#999') + '22', color: CEFR_COLOR[r.cefr] || '#999' }}>{r.cefr}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Connects <b>{r.bridgeDegree}</b> known words: {(r.connectedTo || []).join(', ')}
          </div>
        </div>
      ))}
    </div>
  );
}

function ClustersPanel({ insight }) {
  if (!insight?.results?.length) {
    return <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No clusters analyzed yet — start reviewing flashcards to populate retention data.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {insight.results.map(r => {
        const color = r.avgRetention >= 70 ? 'var(--green)' : r.avgRetention >= 50 ? '#d8a23d' : 'var(--red)';
        return (
          <div key={r.topic} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{r.topic}</span>
              <span style={{ fontSize: 12, color }}>
                <b>{r.avgRetention}%</b> · {r.size} words
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${r.avgRetention}%`, height: '100%', background: color }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{(r.sampleWords || []).join(' · ')}</div>
          </div>
        );
      })}
    </div>
  );
}

function CentralPanel({ insight }) {
  if (!insight?.results?.length) {
    return <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No high-leverage weak words detected — review some flashcards first.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {insight.results.map(r => (
        <div key={r.word} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <span style={{ color: 'var(--violet)', fontSize: 12 }}>{r.article} </span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{r.word}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', marginLeft: 6 }}>· {r.translation}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
            <span style={{ background: 'var(--red-soft)', color: 'var(--red)', padding: '2px 7px', borderRadius: 10 }}>{r.retention}% retention</span>
            <span style={{ background: 'var(--violet-soft)', color: 'var(--violet)', padding: '2px 7px', borderRadius: 10 }}>reach {r.reach}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TwinsPanel({ insight }) {
  if (!insight?.results?.length) {
    return <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No twin pairs yet — words form pairs once they appear in the same source.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {insight.results.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>
            <b>{r.w1}</b> <span style={{ color: 'var(--ink-4)' }}>↔</span> <b>{r.w2}</b>
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>×{r.strength}</span>
        </div>
      ))}
    </div>
  );
}

export function Agent() {
  const [data, setData] = useState(null);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I read your vocabulary as a graph — I can find bridge words, weak topic clusters, or words that unlock the most others. Ask me anything." }
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const sendMessage = async (override) => {
    const text = (override || input).trim();
    if (!text || chatLoading) return;
    const userMsg = { role: 'user', content: text };
    const history = messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0);
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setChatLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, history })
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const { reply } = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${e.message}` }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const fetchAll = async () => {
    if (!API_URL) { setError('API not configured'); return; }
    setLoading(true);
    setError(null);
    try {
      const [sRes, iRes] = await Promise.all([
        fetch(`${API_URL}/api/agent/suggest`),
        fetch(`${API_URL}/api/agent/insight`),
      ]);
      if (!sRes.ok) throw new Error(`Server error ${sRes.status}`);
      if (!iRes.ok) throw new Error(`Server error ${iRes.status}`);
      setData(await sRes.json());
      setInsight(await iRes.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const totalWords = data ? Object.values(data.knownDistribution).reduce((a, b) => a + b, 0) : 0;

  const quickPrompts = [
    'Which weak word should I review first and why?',
    'What\'s the best bridge word to add next?',
    'Which topic cluster is weakest?',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top suggestion */}
      <div className="panel" style={{ borderLeft: '3px solid var(--violet)' }}>
        <div className="panel-h">
          <span className="t">AI learning coach</span>
          <button className="btn btn-ghost btn-sm" onClick={fetchAll} disabled={loading}>
            {loading ? 'Thinking…' : 'Refresh'}
          </button>
        </div>
        <div className="panel-b">
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
          {loading && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Traversing your graph…</div>}
          {data && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
                {data.suggestion}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Focus level:</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                  background: (CEFR_COLOR[data.focusLevel] || '#999') + '22',
                  color: CEFR_COLOR[data.focusLevel] || '#999'
                }}>
                  {data.focusLevel}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CEFR + review queue */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="panel">
            <div className="panel-h"><span className="t">Vocabulary distribution</span><span className="s">{totalWords} words total</span></div>
            <div className="panel-b">
              {totalWords === 0
                ? <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No words saved yet — extract and add some vocabulary first.</p>
                : <CefrBar distribution={data.knownDistribution} />
              }
            </div>
          </div>

          <div className="panel">
            <div className="panel-h"><span className="t">Review queue</span><span className="s">Low retention</span></div>
            <div className="panel-b">
              {data.reviewFirst.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--green)', margin: 0 }}>All caught up — no weak words right now.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.reviewFirst.map(w => (
                      <div key={w} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{w}</span>
                        <span style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-soft)', padding: '2px 8px', borderRadius: 10 }}>review</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        </div>
      )}

      {/* Graph insights — the new heart of the agent */}
      {insight && !loading && (
        <div className="panel">
          <div className="panel-h">
            <span className="t">Graph insights</span>
            <span className="s">Computed from your CO_OCCURS_WITH and BELONGS_TO edges</span>
          </div>
          <div className="panel-b">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              <InsightCard icon="🌉" insight={insight.bridges}>
                <BridgesPanel insight={insight.bridges} />
              </InsightCard>
              <InsightCard icon="🧩" insight={insight.weakClusters}>
                <ClustersPanel insight={insight.weakClusters} />
              </InsightCard>
              <InsightCard icon="🎯" insight={insight.centralWeakWords}>
                <CentralPanel insight={insight.centralWeakWords} />
              </InsightCard>
              <InsightCard icon="🔗" insight={insight.twinWords}>
                <TwinsPanel insight={insight.twinWords} />
              </InsightCard>
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="panel">
        <div className="panel-h"><span className="t">Ask your coach</span><span className="s">Powered by Groq + Neo4j graph context</span></div>
        <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user' ? 'var(--violet)' : 'var(--bg-3)',
                  color: m.role === 'user' ? '#fff' : 'var(--ink)',
                  fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap'
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex' }}>
                <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 2px', background: 'var(--bg-3)', fontSize: 13, color: 'var(--ink-3)' }}>
                  Querying graph…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {quickPrompts.map(p => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                disabled={chatLoading}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 14,
                  background: 'var(--bg-2)', border: 'var(--hairline)',
                  color: 'var(--ink-2)', cursor: 'pointer',
                }}
              >{p}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, borderTop: 'var(--hairline)', paddingTop: 12 }}>
            <input
              style={{ flex: 1, border: 'var(--hairline-strong)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', background: 'var(--bg)' }}
              placeholder="Ask anything about your vocabulary graph…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              disabled={chatLoading}
            />
            <button className="btn btn-primary btn-sm" onClick={() => sendMessage()} disabled={!input.trim() || chatLoading}>
              Send
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="panel" style={{ background: 'var(--bg-2)' }}>
        <div className="panel-h"><span className="t">How the agent thinks in graph</span></div>
        <div className="panel-b">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { step: '1', title: 'Builds the graph', desc: 'Every saved word is linked to others from the same source via CO_OCCURS_WITH and to a Topic via BELONGS_TO.' },
              { step: '2', title: 'Traverses, not searches', desc: 'Cypher pattern matching finds bridge words, weak clusters, and high-leverage nodes — graph queries that no relational DB can match.' },
              { step: '3', title: 'Explains its reasoning', desc: 'Every recommendation is backed by a Cypher pattern you can inspect. The agent answers WHY, not just WHAT.' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--violet-soft)', color: 'var(--violet)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.step}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
