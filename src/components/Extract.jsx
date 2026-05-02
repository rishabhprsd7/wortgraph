import { useState } from 'react';
import { extractedWords, sampleText } from '../data/vocab';
import { IconKeyboard, IconPaste, IconCheck } from './Icons';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

const PROMPT = (text) => `You are a German language teacher. Extract vocabulary words worth learning from this German text.

Return ONLY a valid JSON array — no markdown, no explanation, nothing else.
Each item: {"article":"die/der/das or empty string","word":"base/lemma form","cefr":"A2/B1/B2/C1/C2"}
- Nouns: include article (der/die/das), use nominative singular
- Verbs & adjectives: article = ""
- Focus on B1 level and above, skip very common words (haben, sein, und, die, etc.)
- Return 8–16 words max

Text:
${text}`;

async function extractWithGemini(text) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(text) }] }],
      generationConfig: { temperature: 0.1 }
    })
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const raw = data.candidates[0].content.parts[0].text.trim();
  // strip markdown code fences if present
  const json = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}

function fallbackExtract(text) {
  const inText = extractedWords.filter(w =>
    text.toLowerCase().includes(w.word.toLowerCase())
  );
  const rest = extractedWords.filter(w => !inText.includes(w));
  return [...inText, ...rest.slice(0, 8 - inText.length)];
}

export function Extract() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("Article");
  const [extracted, setExtracted] = useState([]);
  const [added, setAdded] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasApiKey = !!import.meta.env.VITE_GEMINI_KEY;
  const sources = ["Article", "Interview", "Podcast", "YouTube"];

  const onExtract = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setExtracted([]);
    setAdded(new Set());
    setError(null);

    try {
      const words = hasApiKey
        ? await extractWithGemini(text)
        : fallbackExtract(text);
      setExtracted(words);
    } catch (e) {
      console.error("Gemini error:", e);
      setError(`Error: ${e.message} — showing demo words instead.`);
      setExtracted(fallbackExtract(text));
    } finally {
      setLoading(false);
    }
  };

  const toggleAdd = (w) => {
    setAdded(prev => {
      const next = new Set(prev);
      if (next.has(w.word)) next.delete(w.word);
      else next.add(w.word);
      return next;
    });
  };

  const addAll = () => setAdded(new Set(extracted.map(w => w.word)));

  return (
    <div className="extract-wrap">
      <div className="dropzone">
        <div className="dz-icon"><IconKeyboard /></div>
        <div className="dz-title">Paste German text, article, or transcript</div>
        <div className="dz-sub">
          {hasApiKey
            ? "Powered by Gemini AI · extracts real vocabulary from any text"
            : "Add VITE_GEMINI_KEY to .env to enable AI extraction"}
        </div>
        <textarea
          className="dz-textarea"
          placeholder="Die Inflation in der Eurozone ist im April erneut leicht gestiegen…"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="source-chips">
          {sources.map(s => (
            <button
              key={s}
              className={`chip${source === s ? " active" : ""}`}
              onClick={() => setSource(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 22 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setText(sampleText)}>
            <IconPaste />
            Use sample text
          </button>
          <button className="btn btn-primary btn-sm" onClick={onExtract} disabled={!text.trim() || loading}>
            Extract vocabulary →
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, background: "var(--red-soft)", color: "var(--red)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {(loading || extracted.length > 0) && (
        <div className="extract-result">
          <div className="er-head">
            <span className="er-title">Extracted vocabulary</span>
            <span className="er-meta">
              {loading ? "Analyzing with Gemini AI…" : `${extracted.length} words · ${source}`}
            </span>
          </div>
          <div className="er-body">
            <div className="word-grid">
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <span key={i} className="word-chip skel" style={{ width: 80 + (i % 5) * 20 }}>placeholder</span>
                  ))
                : extracted.map(w => {
                    const isAdded = added.has(w.word);
                    return (
                      <button
                        key={w.word}
                        className={`word-chip${isAdded ? " added" : ""}`}
                        onClick={() => toggleAdd(w)}
                      >
                        <span className="wart">{w.article}</span>
                        <span>{w.word}</span>
                        <span className="wadd">{isAdded ? <IconCheck /> : "+"}</span>
                      </button>
                    );
                  })
              }
            </div>
          </div>
          {!loading && (
            <div className="er-foot">
              <span className="er-foot-meta">{added.size} of {extracted.length} selected</span>
              <button className="btn btn-primary btn-sm" onClick={addAll}>
                Add all to flashcard deck
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
