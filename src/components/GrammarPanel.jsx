import { useState } from 'react';

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function expandGrammarTopic(topic, form, highlight, example) {
  const prompt = `You are a German grammar teacher explaining to a B1 learner who does NOT know German grammar terms.

Sentence from their text: "${example}"
The interesting part: "${highlight}"
What it is: ${form || topic}

Explain each word in "${highlight}" in plain English — what is the base word, what does it mean on its own, and what role does it play IN THIS sentence. Do NOT use terms like "Partizip II", "Präteritum", "auxiliary" without immediately explaining them in brackets.

Return ONLY this JSON (no markdown):
{
  "breakdown": [
    {"part": "exact word from the highlighted phrase", "role": "plain English: what this word is (base form + meaning) and what it does in this specific sentence — max 15 words, no unexplained jargon"}
  ],
  "pattern": "one-line takeaway anchored to this sentence — e.g. 'wurde + renoviert = was renovated: werden (to become) turns into the passive helper, renoviert is renovieren in done-form'",
  "oneMore": {"de": "one new German sentence using the same pattern", "en": "English translation"}
}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    })
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

function HighlightedSentence({ example, highlight }) {
  if (!highlight || !example) return <span style={{ fontStyle: 'italic' }}>„{example}"</span>;
  const idx = example.toLowerCase().indexOf(highlight.toLowerCase());
  if (idx === -1) return <span style={{ fontStyle: 'italic' }}>„{example}"</span>;
  return (
    <span style={{ fontStyle: 'italic' }}>
      „{example.slice(0, idx)}
      <mark style={{ background: 'rgba(127,119,221,0.18)', color: 'var(--violet)', borderRadius: 3, padding: '0 2px', fontStyle: 'normal', fontWeight: 700 }}>
        {example.slice(idx, idx + highlight.length)}
      </mark>
      {example.slice(idx + highlight.length)}"
    </span>
  );
}

export function GrammarPanel({ grammarTopics = [], compact = false }) {
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [expansions, setExpansions] = useState({});

  if (grammarTopics.length === 0) return null;

  const handleExpand = async (i, g) => {
    if (expandedTopic === i) { setExpandedTopic(null); return; }
    setExpandedTopic(i);
    if (!expansions[i]) {
      setExpansions(prev => ({ ...prev, [i]: { loading: true } }));
      try {
        const result = await expandGrammarTopic(g.topic, g.form, g.highlight, g.example);
        setExpansions(prev => ({ ...prev, [i]: result }));
      } catch {
        setExpansions(prev => ({ ...prev, [i]: { error: true } }));
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {grammarTopics.map((g, i) => {
        const isOpen = expandedTopic === i;
        const exp = expansions[i];
        return (
          <div key={i} style={{
            borderRadius: 10, background: 'var(--bg)',
            border: isOpen ? '1px solid var(--violet-line)' : '0.5px solid var(--line)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: compact ? '12px 14px' : '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: compact ? 12 : 14, fontWeight: 700, color: 'var(--violet)' }}>{g.topic}</span>
                  {g.form && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(127,119,221,0.12)', color: 'var(--violet)', letterSpacing: '0.02em',
                    }}>{g.form}</span>
                  )}
                </div>
                {GROQ_KEY && (
                  <button
                    onClick={() => handleExpand(i, g)}
                    style={{
                      fontSize: 11, padding: '4px 12px', borderRadius: 999,
                      border: '1px solid var(--violet-line)',
                      background: isOpen ? 'var(--violet)' : 'transparent',
                      color: isOpen ? '#fff' : 'var(--violet)',
                      cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {isOpen ? 'Close' : 'Explain more'}
                  </button>
                )}
              </div>

              {g.example && (
                <div style={{ fontSize: compact ? 12 : 13, color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: g.explanation ? 6 : 0 }}>
                  <HighlightedSentence example={g.example} highlight={g.highlight} />
                </div>
              )}
              {g.explanation && (
                <div style={{ fontSize: compact ? 11 : 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  {g.explanation}
                </div>
              )}
            </div>

            {/* Expanded drill-down */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--violet-line)', padding: compact ? '12px 14px' : '16px 18px', background: 'var(--violet-soft)' }}>
                {exp?.loading && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Breaking it down…</div>
                )}
                {exp?.error && (
                  <div style={{ fontSize: 12, color: 'var(--red)' }}>Couldn't load — try again.</div>
                )}
                {exp && !exp.loading && !exp.error && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Word-by-word */}
                    {exp.breakdown?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {exp.breakdown.map((b, j) => (
                          <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, color: 'var(--violet)',
                              background: 'rgba(127,119,221,0.15)', borderRadius: 4,
                              padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0,
                            }}>{b.part}</span>
                            <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{b.role}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Pattern */}
                    {exp.pattern && (
                      <div style={{
                        padding: '8px 12px', borderRadius: 6,
                        background: 'rgba(127,119,221,0.1)', border: '0.5px solid var(--violet-line)',
                        fontSize: 12, color: 'var(--violet)', fontFamily: 'monospace', lineHeight: 1.6,
                      }}>
                        {exp.pattern}
                      </div>
                    )}
                    {/* One more example */}
                    {exp.oneMore && (
                      <div style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.7)', border: '0.5px solid var(--violet-line)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{exp.oneMore.de}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 2 }}>{exp.oneMore.en}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
