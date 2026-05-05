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
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
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

export function Agent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! Ask me anything about your vocabulary — which words to review, what to focus on, or how your progress looks.' }
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: input.trim() };
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

  const fetchSuggestion = async () => {
    if (!API_URL) { setError('API not configured'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/agent/suggest`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuggestion(); }, []);

  const totalWords = data ? Object.values(data.knownDistribution).reduce((a, b) => a + b, 0) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Suggestion card */}
      <div className="panel" style={{ borderLeft: '3px solid var(--violet)' }}>
        <div className="panel-h">
          <span className="t">AI learning coach</span>
          <button className="btn btn-ghost btn-sm" onClick={fetchSuggestion} disabled={loading}>
            {loading ? 'Thinking…' : 'Refresh'}
          </button>
        </div>
        <div className="panel-b">
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
          {loading && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Analyzing your graph…</div>}
          {data && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
                {data.suggestion}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Focus level:</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                  background: CEFR_COLOR[data.focusLevel] + '20',
                  color: CEFR_COLOR[data.focusLevel]
                }}>
                  {data.focusLevel}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
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

      {/* Chat */}
      <div className="panel">
        <div className="panel-h"><span className="t">Ask your coach</span><span className="s">Powered by Groq + Neo4j</span></div>
        <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user' ? 'var(--violet)' : 'var(--bg-3)',
                  color: m.role === 'user' ? '#fff' : 'var(--ink)',
                  fontSize: 13, lineHeight: 1.5
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex' }}>
                <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 2px', background: 'var(--bg-3)', fontSize: 13, color: 'var(--ink-3)' }}>
                  Thinking…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ display: 'flex', gap: 8, borderTop: 'var(--hairline)', paddingTop: 12 }}>
            <input
              style={{ flex: 1, border: 'var(--hairline-strong)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', background: 'var(--bg)' }}
              placeholder="What should I study next? Which words are weakest?"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              disabled={chatLoading}
            />
            <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={!input.trim() || chatLoading}>
              Send
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="panel" style={{ background: 'var(--bg-2)' }}>
        <div className="panel-h"><span className="t">How the agent works</span></div>
        <div className="panel-b">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { step: '1', title: 'Reads your graph', desc: 'Queries Neo4j for your word distribution, review history, and retention scores.' },
              { step: '2', title: 'Finds gaps', desc: 'Identifies which CEFR level needs more words and which words have low retention.' },
              { step: '3', title: 'Suggests a path', desc: 'Recommends what to review first and which level to focus on next.' },
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
