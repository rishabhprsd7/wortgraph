import { useState } from 'react';
import { extractedWords, sampleText } from '../data/vocab';
import { IconKeyboard, IconPaste, IconCheck } from './Icons';

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const API_URL = import.meta.env.VITE_API_URL || '';

const LIMITS = {
  Text:    { min: 8,  max: 20, ratio: 0.15 },
  YouTube: { min: 15, max: 40, ratio: 0.12 },
};

const GRAMMAR_PROMPT = (text) =>
  `Identify 3-5 important grammar patterns in this German text that a B1+ learner should notice. Return ONLY a JSON array, no markdown, no explanation.
Each item: {"topic":"short name of the grammar pattern","form":"the exact grammatical form name (e.g. Präteritum Passiv, Konjunktiv II Vergangenheit, Relativsatz mit Dativ)","highlight":"the exact word or short phrase from the example sentence that shows the pattern — 1-4 words maximum","example":"verbatim sentence from the text that demonstrates it","explanation":"one punchy sentence pointing at what the highlighted words are DOING in this specific sentence — not a definition, a pointer. E.g. for passive: 'wurde + renoviert → the library was acted on, nobody says who did it'"}

Focus on patterns like: Konjunktiv II, Passiv mit werden, Relativsatz, Genitiv, Modalverben, trennbare Verben, Adjektivdeklination, Nebensatz, indirekte Rede, Partizip II als Adjektiv.

Text:
${text}`;

const PROMPT = (text, source = 'Text') => {
  const wordCount = text.trim().split(/\s+/).length;
  const { min, max, ratio } = LIMITS[source] || LIMITS.Text;
  const target = Math.min(max, Math.max(min, Math.round(wordCount * ratio)));
  return `You are a strict German language teacher selecting vocabulary for a B1+ learner.

Extract exactly ${target} words from this text. Return ONLY a JSON array, no markdown, no explanation.
Each item: {"article":"der/die/das or empty string","word":"base lemma","cefr":"B1/B2/C1/C2","translation":"English meaning in 2-4 words","example":"one sentence (10–16 words) showing the word in realistic context — the sentence must make the word's meaning clear from how it is used, not just state it exists; use simple A2/B1 grammar, present tense, everyday vocabulary","exampleTranslation":"natural English translation of that sentence"}

INCLUDE:
- Genuinely German words a learner would need to look up
- Useful nouns, verbs, adjectives at B1 level or above
- Compound words specific to German (e.g. Krafttraining, Kniebeugen)

EXCLUDE — do not include any of these:
- Proper nouns: place names (Berlin, Prenzlauer Berg, Tiergarten), people names, brand names
- Obvious English loanwords already known to English speakers: Gym, Training, Marathon, Smoothie, Fitness, Studio, Podcast, etc.
- A1/A2 basics including ALL common concrete nouns: Tisch, Stuhl, Haus, Auto, Buch, Schule, Kind, Mann, Frau, Zeit, Jahr, Land, Wasser, Essen, Arbeit, Geld, Weg, Hand, Kopf, Auge, etc.
- Common verbs every beginner knows: haben, sein, werden, gehen, kommen, machen, sagen, sehen, wissen, geben, nehmen, stehen, liegen, etc.
- The article must always be der/die/das — never ein/eine
- CEFR must reflect genuine difficulty — if a native speaker would call it "Grundschulwortschatz" (primary school vocabulary), exclude it

Text:
${text}`;
};

async function withRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      if (i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}

function parseJsonArray(raw) {
  const stripped = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
  // Extract the outermost [...] in case the model adds trailing text
  const match = stripped.match(/\[[\s\S]*\]/);
  return JSON.parse(match ? match[0] : stripped);
}

async function extractWithGroq(text, source) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: PROMPT(text, source) }],
      temperature: 0.1,
      max_tokens: 4096
    })
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return parseJsonArray(data.choices[0].message.content.trim());
}

function fallbackExtract(text) {
  const inText = extractedWords.filter(w =>
    text.toLowerCase().includes(w.word.toLowerCase())
  );
  const rest = extractedWords.filter(w => !inText.includes(w));
  return [...inText, ...rest.slice(0, 8 - inText.length)];
}

async function extractGrammarTopics(text) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: GRAMMAR_PROMPT(text) }],
      temperature: 0.2,
      max_tokens: 1024,
    })
  });
  if (!res.ok) throw new Error(`Groq grammar error ${res.status}`);
  const data = await res.json();
  return parseJsonArray(data.choices[0].message.content.trim());
}

async function saveWordsToDeck(words, source, snippet, userId, grammarTopics) {
  if (!API_URL) throw new Error('VITE_API_URL is not set in .env');
  const res = await fetch(`${API_URL}/api/words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words, source, snippet, userId: userId || 'default', grammarTopics: grammarTopics || [] })
  });
  if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function validateCustomWords(wordList) {
  const list = wordList.join(', ');
  const prompt = `You are a German language expert. For each word in this list, check if it is a real German word. If valid, generate a full vocabulary entry. Return ONLY a JSON array, no markdown.

Each item must be:
- {"word":"base lemma","valid":true,"article":"der/die/das or empty string for verbs/adjectives","cefr":"A2/B1/B2/C1/C2","translation":"English meaning in 2-4 words","example":"one sentence (10-16 words) showing the word in context","exampleTranslation":"natural English translation"}
- {"word":"original input","valid":false,"reason":"why it is not a valid German word"}

Words to validate: ${list}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 2048 })
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  return parseJsonArray(data.choices[0].message.content.trim());
}

const LS = {
  get: (k, fallback) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

export function Extract({ userId }) {
  const [text, setText] = useState(() => LS.get('ex_text', ""));
  const [source, setSource] = useState(() => LS.get('ex_source', "Text"));
  const [extracted, setExtracted] = useState(() => LS.get('ex_words', []));
  const [grammarTopics, setGrammarTopics] = useState(() => LS.get('ex_grammar', []));
  const [added, setAdded] = useState(() => new Set(LS.get('ex_added', [])));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [extractionId, setExtractionId] = useState(0);

  const saveText = (v) => { setText(v); LS.set('ex_text', v); };
  const saveSource = (v) => { setSource(v); LS.set('ex_source', v); };
  const saveExtracted = (v) => { setExtracted(v); LS.set('ex_words', v); };
  const saveGrammar = (v) => { setGrammarTopics(v); LS.set('ex_grammar', v); };
  const saveAdded = (fn) => setAdded(prev => {
    const next = fn(prev);
    LS.set('ex_added', [...next]);
    return next;
  });

  const [customText, setCustomText] = useState('');
  const [invalidWords, setInvalidWords] = useState([]);
  const [mode, setMode] = useState('text'); // 'text' | 'custom'

  const hasApiKey = !!GROQ_KEY;
  const sources = ["Text", "YouTube"];
  const isUrl = /^https?:\/\/\S+$/.test(text.trim());
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const wordCountOver = wordCount > 1000;
  const wordCountWarn = wordCount > 600 && !wordCountOver;

  const onExtract = async () => {
    if (!text.trim() || isUrl) return;
    setLoading(true);
    setExtractionId(id => id + 1);
    saveExtracted([]);
    saveGrammar([]);
    saveAdded(() => new Set());
    setSaved(false);
    setError(null);

    try {
      if (hasApiKey) {
        const [words, grammar] = await Promise.all([
          withRetry(() => extractWithGroq(text, source)),
          withRetry(() => extractGrammarTopics(text)).catch(() => []),
        ]);
        saveExtracted(words);
        saveGrammar(grammar);
      } else {
        saveExtracted(fallbackExtract(text));
      }
    } catch (e) {
      console.error("Groq error:", e);
      setError(`Error: ${e.message} — showing demo words instead.`);
      saveExtracted(fallbackExtract(text));
    } finally {
      setLoading(false);
    }
  };

  const onExtractCustom = async () => {
    const words = customText.split(/[\n,]+/).map(w => w.trim()).filter(Boolean);
    if (words.length === 0) return;
    setLoading(true);
    saveExtracted([]);
    saveAdded(() => new Set());
    setSaved(false);
    setError(null);
    setInvalidWords([]);
    try {
      const results = await withRetry(() => validateCustomWords(words));
      const valid = results.filter(r => r.valid);
      const invalid = results.filter(r => !r.valid);
      saveExtracted(valid);
      setInvalidWords(invalid);
      saveAdded(() => new Set(valid.map(w => w.word)));
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdd = (w) => {
    saveAdded(prev => {
      const next = new Set(prev);
      if (next.has(w.word)) next.delete(w.word);
      else next.add(w.word);
      return next;
    });
  };

  const addAll = () => saveAdded(() => new Set(extracted.map(w => w.word)));
  const deselectAll = () => saveAdded(() => new Set());

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const saveSelected = async () => {
    const selectedWords = extracted.filter(w => added.has(w.word));
    if (selectedWords.length === 0) return;
    setSaving(true);
    try {
      await saveWordsToDeck(selectedWords, source, text.slice(0, 3000), userId, grammarTopics);
      setSaved(true);
      showToast(`${selectedWords.length} word${selectedWords.length === 1 ? '' : 's'} added — head to the Learn tab to study them`);
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="extract-wrap">
      {toast && (
        <div className="toast-banner">
          <IconCheck />{toast}
        </div>
      )}

      {/* Mode toggle */}
      <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 8, padding: 3, gap: 2, marginBottom: 16, alignSelf: 'flex-start' }}>
        {[['text', 'Extract from text'], ['custom', 'Add custom words']].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
            background: mode === m ? '#fff' : 'transparent',
            color: mode === m ? 'var(--ink)' : 'var(--ink-3)',
            fontWeight: mode === m ? 600 : 400,
            boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {mode === 'custom' ? (
        <div className="dropzone">
          <div className="dz-icon">✎</div>
          <div className="dz-title">Add custom German words</div>
          <div className="dz-sub">Enter one word per line or separate with commas — we'll verify each word is real German and generate entries</div>
          <textarea
            className="dz-textarea"
            placeholder={"Schadenfreude\nWeltanschauung\nZeitgeist\nGesundheit"}
            value={customText}
            onChange={e => setCustomText(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
            <button className="btn btn-primary btn-sm" onClick={onExtractCustom}
              disabled={!customText.trim() || loading}>
              Validate & add words →
            </button>
          </div>
        </div>
      ) : (
      <div className="dropzone">
        <div className="dz-icon"><IconKeyboard /></div>
        <div className="dz-title">Paste German text or YouTube transcript</div>
        <div className="dz-sub">
          {hasApiKey
            ? "Powered by Groq AI · extracts real vocabulary from any text"
            : "Add VITE_GROQ_KEY to .env to enable AI extraction"}
        </div>
        <textarea
          className="dz-textarea"
          placeholder="Paste the actual text or transcript here — not a URL…"
          value={text}
          onChange={e => saveText(e.target.value)}
        />
        {wordCount > 0 && (
          <div style={{ textAlign: 'right', fontSize: 12, marginTop: 4,
            color: wordCountOver ? 'var(--red)' : wordCountWarn ? '#b07000' : 'var(--ink-4)' }}>
            {wordCount} words
            {wordCountWarn && ' · long text — consider pasting one section at a time'}
            {wordCountOver && ' · too long — paste a shorter section (under 1000 words)'}
          </div>
        )}
        {isUrl && (
          <div style={{
            margin: '8px 0', padding: '12px 14px', borderRadius: 10,
            background: '#fff8e6', border: '1px solid #f0c040',
            fontSize: 13, color: '#7a5800', lineHeight: 1.6,
          }}>
            <b>Paste the transcript, not the URL.</b> Wortgraph reads text — URLs contain no words to extract.
            <div style={{ marginTop: 6, color: '#5a4200' }}>
              {source === 'YouTube' && <span><b>YouTube:</b> open the video → click <b>···</b> below the title → <b>Show transcript</b> → select all → paste here.</span>}
              {source === 'Text' && <span><b>Text:</b> open the article, select all text and paste it here.</span>}
            </div>
          </div>
        )}
        <div className="source-chips">
          {sources.map(s => (
            <button
              key={s}
              className={`chip${source === s ? " active" : ""}`}
              onClick={() => saveSource(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 22 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => saveText(sampleText)}>
            <IconPaste />
            Use sample text
          </button>
          <button className="btn btn-primary btn-sm" onClick={onExtract} disabled={!text.trim() || loading || isUrl || wordCountOver}>
            Extract vocabulary →
          </button>
        </div>
      </div>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, background: "var(--red-soft)", color: "var(--red)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {invalidWords.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 8, background: '#fff8e6', border: '1px solid #f0c040', fontSize: 13, color: '#7a5800' }}>
          <b>Not valid German words:</b> {invalidWords.map(w => `${w.word}${w.reason ? ` (${w.reason})` : ''}`).join(' · ')}
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
            <div className="word-grid" key={extractionId}>
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
                <button className="btn btn-ghost btn-sm" onClick={deselectAll} disabled={added.size === 0}>
                  Deselect all
                </button>
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
