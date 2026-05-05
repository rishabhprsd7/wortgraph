import { useState } from 'react';
import { extractedWords, sampleText } from '../data/vocab';
import { IconKeyboard, IconPaste, IconCheck } from './Icons';

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const API_URL = import.meta.env.VITE_API_URL || '';

const PROMPT = (text) => {
  const wordCount = text.trim().split(/\s+/).length;
  const target = Math.max(8, Math.round(wordCount * 0.15));
  return `You are a strict German language teacher selecting vocabulary for a B1+ learner.

Extract exactly ${target} words from this text. Return ONLY a JSON array, no markdown, no explanation.
Each item: {"article":"der/die/das or empty string","word":"base lemma","cefr":"B1/B2/C1/C2"}

INCLUDE:
- Genuinely German words a learner would need to look up
- Useful nouns, verbs, adjectives at B1 level or above
- Compound words specific to German (e.g. Krafttraining, Kniebeugen)

EXCLUDE — do not include any of these:
- Proper nouns: place names (Berlin, Prenzlauer Berg, Tiergarten), people names, brand names
- Obvious English loanwords already known to English speakers: Gym, Training, Marathon, Smoothie, Fitness, Studio, Podcast, etc.
- A1/A2 basics: haben, sein, gehen, kommen, machen, sagen, gut, groß, klein, Tag, Stadt, etc.
- The article must always be der/die/das — never ein/eine

Text:
${text}`;
};

async function extractWithGroq(text) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: PROMPT(text) }],
      temperature: 0.1
    })
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
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

async function saveWordsToDeck(words, source) {
  console.log('[Wortgraph] API_URL:', API_URL, '| saving', words.length, 'words');
  if (!API_URL) throw new Error('VITE_API_URL is not set in .env');
  const res = await fetch(`${API_URL}/api/words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words, source, userId: 'default' })
  });
  if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
  return res.json();
}

export function Extract() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("Article");
  const [extracted, setExtracted] = useState([]);
  const [added, setAdded] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const hasApiKey = !!GROQ_KEY;
  const sources = ["Article", "Interview", "Podcast", "YouTube"];

  const onExtract = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setExtracted([]);
    setAdded(new Set());
    setSaved(false);
    setError(null);

    try {
      const words = hasApiKey
        ? await extractWithGroq(text)
        : fallbackExtract(text);
      setExtracted(words);
    } catch (e) {
      console.error("Groq error:", e);
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

  const saveSelected = async () => {
    const selectedWords = extracted.filter(w => added.has(w.word));
    if (selectedWords.length === 0) return;
    setSaving(true);
    try {
      await saveWordsToDeck(selectedWords, source);
      setSaved(true);
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="extract-wrap">
      <div className="dropzone">
        <div className="dz-icon"><IconKeyboard /></div>
        <div className="dz-title">Paste German text, article, or transcript</div>
        <div className="dz-sub">
          {hasApiKey
            ? "Powered by Groq AI · extracts real vocabulary from any text"
            : "Add VITE_GROQ_KEY to .env to enable AI extraction"}
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
              {loading ? "Analyzing with Groq AI…" : `${extracted.length} words · ${source}`}
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
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={addAll} disabled={added.size === extracted.length}>
                  Select all
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={saveSelected}
                  disabled={added.size === 0 || saving || saved}
                >
                  {saved ? <><IconCheck /> Saved to deck</> : saving ? "Saving…" : `Add ${added.size} to flashcard deck`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
