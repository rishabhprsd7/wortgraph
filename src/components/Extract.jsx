import { useState, useEffect, useRef } from 'react';
import { extractedWords, sampleText } from '../data/vocab';
import { IconKeyboard, IconPaste, IconCheck } from './Icons';
import { groqChat, groqAvailable } from '../groqClient';
import { useSpeechToText } from '../useSpeechToText';

const API_URL = import.meta.env.VITE_API_URL || '';

const LIMITS = {
  Text:    { min: 10, max: 26, ratio: 0.18 },
  YouTube: { min: 15, max: 44, ratio: 0.14 },
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
  return `You are a strict German language teacher helping a B1+ learner FULLY UNDERSTAND this text.

Extract up to ${target} items. Return ONLY a JSON array, no markdown, no explanation.
Each item: {"word":"base lemma (INFINITIVE for verbs)","pos":"noun|verb|adjective|adverb|phrase","article":"der/die/das for nouns, otherwise empty string","cefr":"B1/B2/C1/C2","translation":"English meaning in 2-4 words","example":"one sentence (10–16 words), simple A2/B1 grammar, present tense, that makes the meaning clear from context","exampleTranslation":"natural English translation of that sentence"}

CRITICAL — VERBS CARRY THE MEANING:
- A sentence cannot be understood without its verbs. You MUST capture the meaningful verbs, not only nouns. Aim for a balanced mix across nouns, verbs, and adjectives — roughly a third verbs whenever the text contains them.
- Return every verb as its INFINITIVE. Reconstruct separable verbs from split or conjugated forms: "geht … hinaus" / "hinausgeht" → "hinausgehen"; "geschmissen" → "schmeißen"; "stellt … fest" → "feststellen".
- CRITICAL for separable verbs: when a small word (hin, her, auf, ab, an, aus, ein, mit, vor, zu, weg, los, nach, fest, …) sits at the END of the clause, it is the verb's separated prefix — REATTACH it to the stem to form the infinitive. Never return the bare stem. E.g. "weist darauf hin" → "hinweisen" (NOT "weisen"); "fällt … weg" → "wegfallen" (NOT "fallen"); "nimmt … zu" → "zunehmen".
- NEVER return a participle or any conjugated form — always the plain infinitive: "zugenommen" → "zunehmen" (NOT "zugenommen"); "gestiegen" → "steigen"; "gestellt" → "stellen"; "vermisst" → "vermissen".
- List each verb only ONCE: never output both a verb and its participle (zunehmen AND zugenommen) or both a stem and its separable form (weisen AND hinweisen) — pick the single correct infinitive.
- Capture fixed verb phrases as ONE item with pos "phrase": e.g. "auf Rechnung stellen", "in Kraft treten", "zur Verfügung stehen".

PRIORITISE BY DIFFICULTY (most important selection rule):
- The learner is B1+ and ALREADY KNOWS easy, high-frequency words. When you have to leave words out, DROP the easy ones and KEEP the harder, higher-value ones.
- Easy → drop first: arbeiten, sparen, fühlen, finden, brauchen, zeigen, leben, spielen, kaufen, and similar everyday A2/B1 verbs.
- Hard → always keep: separable verbs (wegfallen, hinweisen, zunehmen, abnehmen, durchsetzen), figurative/abstract verbs, low-frequency or B2/C1 verbs, and German-specific compounds.
- A genuinely useful HARD verb must NEVER be dropped in favour of an easy one. If forced to choose between "wegfallen" and "sparen", keep "wegfallen".

INCLUDE:
- Genuinely useful German words a learner would look up: nouns, verbs, adjectives, adverbs.
- Compound words specific to German (e.g. Sperrmüll, Krafttraining).
- Less common or figurative verbs even if short (schmeißen, gehören in the sense of "to belong", hinausgehen).

EXCLUDE — do not include any of these:
- Proper nouns: place names (Berlin, Tiergarten), people, brand names, AND organisation/agency names or acronyms (e.g. BSR, ADAC, DHL, Deutsche Bahn).
- Obvious English loanwords already known to English speakers: Gym, Training, Marathon, Smoothie, Fitness, Studio, Podcast, etc.
- A1/A2 basics: the most common concrete nouns (Tisch, Stuhl, Haus, Auto, Buch, Schule, Kind, Mann, Frau, Zeit, Jahr…) and the most common verbs (haben, sein, werden, gehen, kommen, machen, sagen, sehen, wissen, geben…).
- The article must always be der/die/das — never ein/eine.
- Do NOT repeat the same lemma twice.

Text:
${text}`;
};

// Collapse repeated lemmas (case-insensitive) — guards against the model
// returning the same word twice (e.g. "Jahresputz" appearing in two clauses).
function dedupeByLemma(list) {
  const seen = new Set();
  return list.filter(w => {
    const key = (w.word || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Part-of-speech buckets, in display order. Verbs first — they carry meaning.
const POS_GROUPS = [
  { key: 'verb', label: 'Verbs' },
  { key: 'noun', label: 'Nouns' },
  { key: 'adjective', label: 'Adjectives' },
  { key: 'adverb', label: 'Adverbs' },
  { key: 'phrase', label: 'Phrases' },
];

// Normalise the model's pos field (and fall back to article/shape heuristics).
function normalizePos(w) {
  const p = (w.pos || '').toLowerCase();
  if (p.startsWith('verb')) return 'verb';
  if (p.startsWith('adj')) return 'adjective';
  if (p.startsWith('adv')) return 'adverb';
  if (p.startsWith('phrase')) return 'phrase';
  if (p.startsWith('noun')) return 'noun';
  // No usable pos — infer: has article → noun, has a space → phrase, else noun.
  if (['der', 'die', 'das'].includes((w.article || '').toLowerCase())) return 'noun';
  if ((w.word || '').trim().includes(' ')) return 'phrase';
  return 'noun';
}

// German separable prefixes (longest first). Only true separables — NOT the
// inseparable ver-/be-/ent-/er-/ge-/zer- which form genuinely distinct verbs
// (verstehen ≠ stehen), so those are deliberately excluded.
const SEP_PREFIXES = [
  'auseinander', 'gegenüber', 'zusammen', 'zurück', 'voran', 'voraus', 'hervor',
  'herunter', 'hinunter', 'herauf', 'hinauf', 'heraus', 'hinaus', 'herein',
  'hinein', 'herum', 'entgegen', 'nieder', 'empor', 'fort',
  'ab', 'an', 'auf', 'aus', 'bei', 'ein', 'fest', 'her', 'hin', 'los',
  'mit', 'nach', 'vor', 'weg', 'zu',
];

// Collapse a bare verb stem into its separable form when BOTH appear, e.g. the
// model emitting "weisen" alongside "hinweisen" — keep the prefixed infinitive,
// drop the stem. Conservative: only fires when both are present in this batch.
function collapseVerbVariants(list) {
  const lemmas = new Set(list.map(w => (w.word || '').trim().toLowerCase()));
  const drop = new Set();
  for (const w of list) {
    if (normalizePos(w) !== 'verb') continue;
    const stem = (w.word || '').trim().toLowerCase();
    if (!stem) continue;
    for (const p of SEP_PREFIXES) {
      const prefixed = p + stem;
      if (prefixed !== stem && lemmas.has(prefixed)) { drop.add(stem); break; }
    }
  }
  if (drop.size === 0) return list;
  return list.filter(w => !drop.has((w.word || '').trim().toLowerCase()));
}

async function withRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      if (i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}

function parseJsonArray(raw) {
  const text = raw
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try direct parse first
  try {
    const result = JSON.parse(text);
    if (Array.isArray(result)) return result;
  } catch {}

  // Find the start of the first array
  const start = text.indexOf('[');
  if (start === -1) throw new Error('No JSON array found in response');

  // Walk backwards from the last ']' until we get a valid parse.
  // This handles trailing LLM commentary after the closing bracket.
  for (let end = text.lastIndexOf(']'); end > start; end = text.lastIndexOf(']', end - 1)) {
    try {
      const result = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(result)) return result;
    } catch {}
  }

  throw new Error('Could not parse JSON array from response');
}

async function extractWithGroq(text, source) {
  const data = await groqChat({
    messages: [{ role: 'user', content: PROMPT(text, source) }],
    temperature: 0.1,
    max_tokens: 4096,
  });
  return parseJsonArray((data?.choices?.[0]?.message?.content || "").trim());
}

function fallbackExtract(text) {
  const inText = extractedWords.filter(w =>
    text.toLowerCase().includes(w.word.toLowerCase())
  );
  const rest = extractedWords.filter(w => !inText.includes(w));
  return [...inText, ...rest.slice(0, 8 - inText.length)];
}

async function extractGrammarTopics(text) {
  const data = await groqChat({
    messages: [{ role: 'user', content: GRAMMAR_PROMPT(text) }],
    temperature: 0.2,
    max_tokens: 1024,
  });
  return parseJsonArray((data?.choices?.[0]?.message?.content || "").trim());
}

// Retrieval-augmented anti-hallucination: ask the server to check each lemma
// against Wiktionary. Annotates each word with `verified` (true/false/null).
// Fail-open — if the call breaks, words pass through unannotated.
async function annotateVerification(words) {
  if (!API_URL || words.length === 0) return words;
  try {
    const res = await fetch(`${API_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: words.map(w => w.word) }),
    });
    if (!res.ok) return words;
    const map = await res.json();
    return words.map(w => ({ ...w, verified: map[w.word]?.verified }));
  } catch {
    return words;
  }
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
  const prompt = `You are a German language expert AND a spell-corrector. For each entry in this list, check if it is real German — this includes single words AND multi-word expressions (collocations, verb phrases, fixed expressions like "Gemeinsamkeiten feststellen", "zur Verfügung stehen", "auf den Punkt bringen"). If valid, generate a full vocabulary entry. Return ONLY a JSON array, no markdown.

Each item must be:
- {"word":"the expression exactly as given (or corrected base form for phrases)","valid":true,"article":"der/die/das for nouns, empty string for verbs/phrases/adjectives","cefr":"A2/B1/B2/C1/C2","translation":"English meaning in 2-5 words","example":"one sentence (10-16 words) showing it in realistic context","exampleTranslation":"natural English translation"}
- {"word":"original input","valid":false,"reason":"short reason","suggestion":"REQUIRED: the single closest real German word or phrase the user most likely intended. Always make your best guess. Never use null, never leave it empty."}

The suggestion field must ALWAYS contain a real German word or phrase — treat misspellings like a search engine's "did you mean". Example: input "gehobenich" → suggestion "gehoben". Input "freundschft" → suggestion "Freundschaft". Input "Gemeinsamkeiten feststelen" → suggestion "Gemeinsamkeiten feststellen".

Words/phrases to validate: ${list}`;

  const data = await groqChat({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 2048,
  });
  return parseJsonArray((data?.choices?.[0]?.message?.content || "").trim());
}

// Module-level cache: survives SPA tab switches, cleared on full page reload
let _cache = { text: '', source: 'Text', extracted: [], grammar: [], added: [] };

export function Extract({ userId }) {
  const [text, setText] = useState(_cache.text);
  const [source, setSource] = useState(_cache.source);
  const [extracted, setExtracted] = useState(_cache.extracted);
  const [grammarTopics, setGrammarTopics] = useState(_cache.grammar);
  const [added, setAdded] = useState(() => new Set(_cache.added));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [extractionId, setExtractionId] = useState(0);

  const saveText = (v) => { _cache.text = v; setText(v); };
  const saveSource = (v) => { _cache.source = v; setSource(v); };
  const saveExtracted = (v) => { _cache.extracted = v; setExtracted(v); };
  const saveGrammar = (v) => { _cache.grammar = v; setGrammarTopics(v); };
  const saveAdded = (fn) => setAdded(prev => {
    const next = fn(prev);
    _cache.added = [...next];
    return next;
  });

  const [customText, setCustomText] = useState('');
  const [invalidWords, setInvalidWords] = useState([]);
  const [mode, setMode] = useState('text'); // 'text' | 'custom'

  // Live German dictation → streams into the text box. Final chunks are
  // appended to whatever's already there so you can mix typing, pasting and
  // speaking. textRef avoids a stale closure over `text`.
  const textRef = useRef(text);
  textRef.current = text;
  const {
    supported: speechSupported, listening, interim, error: sttError,
    start: startDictation, stop: stopDictation,
  } = useSpeechToText({
    lang: 'de-DE',
    onFinalText: (chunk) => {
      const base = textRef.current ? textRef.current.replace(/\s+$/, '') + ' ' : '';
      saveText(base + chunk);
    },
  });

  // Clear results when switching modes (and stop any in-progress dictation)
  useEffect(() => {
    stopDictation();
    saveExtracted([]);
    saveAdded(() => new Set());
    setSaved(false);
    setInvalidWords([]);
    setError(null);
  }, [mode]);

  const hasApiKey = groqAvailable;
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
        const deduped = collapseVerbVariants(dedupeByLemma(words));
        saveExtracted(await annotateVerification(deduped));
        saveGrammar(grammar);
      } else {
        saveExtracted(dedupeByLemma(fallbackExtract(text)));
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
      // Cross-check the LLM's "valid" words against Wiktionary. A word the LLM
      // accepted but the dictionary can't find is likely a hallucination.
      const verified = await annotateVerification(valid);
      saveExtracted(verified);
      setInvalidWords(invalid);
      // Pre-select everything except known hallucinations (verified === false).
      saveAdded(() => new Set(verified.filter(w => w.verified !== false).map(w => w.word)));
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addSuggestion = async (suggestion) => {
    setLoading(true);
    try {
      const results = await withRetry(() => validateCustomWords([suggestion]));
      const valid = results.filter(r => r.valid);
      if (valid.length > 0) {
        saveExtracted(prev => [...prev, ...valid.filter(v => !prev.find(p => p.word === v.word))]);
        saveAdded(prev => { const next = new Set(prev); valid.forEach(v => next.add(v.word)); return next; });
        setInvalidWords(prev => prev.filter(w => w.suggestion !== suggestion));
      }
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
      const isNeo4j = e.message?.includes('routing') || e.message?.includes('discovery');
      setError(isNeo4j
        ? 'Could not save — the database is offline. Go to console.neo4j.io and resume your AuraDB instance, then try again.'
        : `Could not save: ${e.message}`);
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

      {/* Mode tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--line)', marginBottom: 24, gap: 0 }}>
        {[['text', 'Extract from text'], ['custom', 'Add custom words']].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: 14,
            background: 'transparent',
            color: mode === m ? 'var(--violet)' : 'var(--ink-3)',
            fontWeight: mode === m ? 600 : 400,
            borderBottom: mode === m ? '2px solid var(--violet)' : '2px solid transparent',
            marginBottom: -2,
            transition: 'color 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {mode === 'custom' ? (
        <div className="dropzone">
          <div className="dz-icon">✎</div>
          <div className="dz-title">Add custom German words</div>
          <div className="dz-sub">Enter words or phrases per line (e.g. "Gemeinsamkeiten feststellen") — we'll verify each is real German and generate entries</div>
          <textarea
            className="dz-textarea"
            placeholder={"Schadenfreude\nWeltanschauung\nGemeinsamkeiten feststellen\nzur Verfügung stehen"}
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
            : "Connect the backend (VITE_API_URL) to enable AI extraction"}
        </div>
        <textarea
          className="dz-textarea"
          placeholder="Paste the actual text or transcript here — not a URL…"
          value={text}
          onChange={e => saveText(e.target.value)}
        />

        {/* Live German voice dictation (Web Speech API) — streams into the box. */}
        {speechSupported ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={listening ? stopDictation : startDictation}
              style={listening
                ? { background: 'var(--red)', color: '#fff', border: 'none' }
                : { background: 'var(--bg-2)', color: 'var(--ink-2)', border: 'var(--hairline-strong)' }}
            >
              {listening ? '■ Stop listening' : '🎤 Dictate in German'}
            </button>
            {listening ? (
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                Listening… speak German, or play a video near your mic
                {interim && <span style={{ fontStyle: 'italic', color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{interim}”</span>}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                Speak, or point your mic at German audio — words appear in the box, then extract as usual.
              </span>
            )}
            {sttError === 'not-allowed' && (
              <span style={{ fontSize: 12, color: 'var(--red)' }}>Microphone blocked — allow mic access and try again.</span>
            )}
            {sttError === 'network' && (
              <span style={{ fontSize: 12, color: 'var(--amber-text)' }}>Speech service unreachable — check your connection.</span>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-4)' }}>
            🎤 Voice input needs Chrome, Edge, or Safari.
          </div>
        )}

        {wordCount > 0 && (
          <div style={{ textAlign: 'right', fontSize: 12, marginTop: 4,
            color: wordCountOver ? 'var(--red)' : wordCountWarn ? 'var(--amber-text)' : 'var(--ink-4)' }}>
            {wordCount} words
            {wordCountWarn && ' · long text — consider pasting one section at a time'}
            {wordCountOver && ' · too long — paste a shorter section (under 1000 words)'}
          </div>
        )}
        {isUrl && (
          <div style={{
            margin: '8px 0', padding: '12px 14px', borderRadius: 10,
            background: 'var(--amber-soft)', border: '1px solid rgba(186,117,23,0.40)',
            fontSize: 13, color: 'var(--amber-text)', lineHeight: 1.6,
          }}>
            <b>Paste the transcript, not the URL.</b> Wortgraph reads text — URLs contain no words to extract.
            <div style={{ marginTop: 6, color: 'var(--amber-text-dim)' }}>
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
        <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 8, background: 'var(--amber-soft)', border: '1px solid rgba(186,117,23,0.40)', fontSize: 13, color: 'var(--amber-text)' }}>
          <b>Couldn't find:</b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {invalidWords.map(w => (
              <div key={w.word} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontStyle: 'italic' }}>{w.word}</span>
                {w.suggestion && w.suggestion.toLowerCase() !== w.word.toLowerCase() ? (
                  <>
                    <span style={{ color: 'var(--amber-text-dim)' }}>— Did you mean</span>
                    <button
                      onClick={() => addSuggestion(w.suggestion)}
                      style={{ background: 'var(--violet)', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    >
                      {w.suggestion}
                    </button>
                    <span style={{ color: 'var(--amber-text-dim)' }}>?</span>
                  </>
                ) : (
                  w.reason && <span style={{ color: 'var(--amber-text-dim)' }}>— {w.reason}</span>
                )}
              </div>
            ))}
          </div>
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
          {!loading && extracted.some(w => w.verified === false) && (
            <div style={{ margin: '0 20px', padding: '8px 12px', borderRadius: 8, background: 'var(--amber-soft)', border: '1px solid rgba(186,117,23,0.40)', fontSize: 12.5, color: 'var(--amber-text)', lineHeight: 1.5 }}>
              Words marked <b>?</b> weren’t found in Wiktionary or the DWDS corpus — they may be misspelled or not real German. They’re left unselected; verify before adding.
            </div>
          )}
          <div className="er-body">
            {loading ? (
              <div className="word-grid">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className="word-chip skel" style={{ width: 80 + (i % 5) * 20 }}>placeholder</span>
                ))}
              </div>
            ) : (
              <div className="word-groups" key={extractionId}>
                {POS_GROUPS.map(g => {
                  const items = extracted.filter(w => normalizePos(w) === g.key);
                  if (items.length === 0) return null;
                  return (
                    <div className="word-group" key={g.key}>
                      <div className="word-group-head">
                        {g.label} <span className="word-group-count">{items.length}</span>
                      </div>
                      <div className="word-grid">
                        {items.map(w => {
                          const isAdded = added.has(w.word);
                          const unverified = w.verified === false;
                          return (
                            <button
                              key={w.word}
                              className={`word-chip${isAdded ? " added" : ""}${unverified ? " unverified" : ""}`}
                              onClick={() => toggleAdd(w)}
                              title={unverified ? "Not found in Wiktionary or the DWDS corpus — may not be a real German word" : undefined}
                            >
                              {w.article && <span className="wart">{w.article}</span>}
                              <span>{w.word}</span>
                              {unverified && <span className="wflag" title="Not in dictionary">?</span>}
                              <span className="wadd">{isAdded ? <IconCheck /> : "+"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
