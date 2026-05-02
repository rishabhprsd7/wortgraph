import { useState } from 'react';
import { extractedWords, sampleText } from '../data/vocab';
import { IconKeyboard, IconPaste, IconCheck } from './Icons';

export function Extract() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("Article");
  const [extracted, setExtracted] = useState([]);
  const [added, setAdded] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const sources = ["Article", "Interview", "Podcast", "YouTube"];

  const onExtract = () => {
    if (!text.trim()) return;
    setLoading(true);
    setExtracted([]);
    setAdded(new Set());
    setTimeout(() => {
      const inText = extractedWords.filter(w =>
        text.toLowerCase().includes(w.word.toLowerCase())
      );
      const rest = extractedWords.filter(w => !inText.includes(w));
      setExtracted([...inText, ...rest.slice(0, 8 - inText.length)]);
      setLoading(false);
    }, 900);
  };

  const usePreset = () => {
    setText(sampleText);
  };

  const toggleAdd = (w) => {
    setAdded(prev => {
      const next = new Set(prev);
      if (next.has(w.word)) next.delete(w.word);
      else next.add(w.word);
      return next;
    });
  };

  const addAll = () => {
    setAdded(new Set(extracted.map(w => w.word)));
  };

  return (
    <div className="extract-wrap">
      <div className="dropzone">
        <div className="dz-icon"><IconKeyboard /></div>
        <div className="dz-title">Paste German text, article, or transcript</div>
        <div className="dz-sub">Or drag and drop a .txt file · YouTube URL coming soon</div>
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
          <button className="btn btn-ghost btn-sm" onClick={usePreset}>
            <IconPaste />
            Use sample text
          </button>
          <button className="btn btn-primary btn-sm" onClick={onExtract} disabled={!text.trim()}>
            Extract vocabulary →
          </button>
        </div>
      </div>

      {(loading || extracted.length > 0) && (
        <div className="extract-result">
          <div className="er-head">
            <span className="er-title">Extracted vocabulary</span>
            <span className="er-meta">
              {loading ? "Analyzing…" : `${extracted.length} words · ${source}`}
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
              <span className="er-foot-meta">
                {added.size} of {extracted.length} selected
              </span>
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
