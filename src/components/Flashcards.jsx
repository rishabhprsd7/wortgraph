import { useState, useEffect } from 'react';
import { flashcards } from '../data/vocab';
import { IconX, IconCheck } from './Icons';

export function Flashcards() {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ hard: 0, again: 0, good: 0 });
  const card = flashcards[idx];
  const progress = (idx / flashcards.length) * 100;

  const respond = (kind) => {
    setStats(s => ({ ...s, [kind]: s[kind] + 1 }));
    setFlipped(false);
    setTimeout(() => {
      setIdx(i => (i + 1) % flashcards.length);
    }, 240);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space") { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === "1") respond("hard");
      else if (e.key === "2") respond("again");
      else if (e.key === "3") respond("good");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flash-stage">
      <div className="flash-progress">
        <span>{idx + 1} / {flashcards.length}</span>
        <div className="flash-bar">
          <div className="flash-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <span>Politics & policy</span>
      </div>

      <div className="card-frame">
        <div className={`card${flipped ? " flipped" : ""}`} onClick={() => setFlipped(f => !f)}>
          <div className="face face-front">
            <span className="face-corner">FRONT</span>
            <div className="card-meta">
              <span className="article">{card.article}</span>
            </div>
            <h2 className="card-word">{card.word}</h2>
            <div className="card-tags">
              <span className="tag cefr">{card.cefr}</span>
              <span className="tag">{card.topic}</span>
            </div>
          </div>
          <div className="face face-back">
            <span className="face-corner">BACK</span>
            <div className="card-meta">
              <span className="article" style={{ color: "#9d96e8" }}>{card.article}</span>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{card.word}</span>
            </div>
            <p className="translation">{card.translation}</p>
            <p className="example">"{card.example}"</p>
            <p className="example" style={{ marginTop: 6, fontStyle: "normal", fontSize: 12 }}>
              {card.exampleEn}
            </p>
          </div>
        </div>
      </div>

      <div className="flip-hint">Click card or press space to flip</div>

      <div className="response-row">
        <button className="resp-btn hard" onClick={() => respond("hard")}>
          <span className="glyph"><IconX /></span>
          <span>Hard</span>
          <span className="kb">1</span>
        </button>
        <button className="resp-btn again" onClick={() => respond("again")}>
          <span>Again</span>
          <span className="kb">2</span>
        </button>
        <button className="resp-btn good" onClick={() => respond("good")}>
          <span className="glyph"><IconCheck /></span>
          <span>Got it</span>
          <span className="kb">3</span>
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 28, fontSize: 12, color: "var(--ink-3)" }}>
        <span>Hard: <b style={{ color: "var(--red)" }}>{stats.hard}</b></span>
        <span>Again: <b>{stats.again}</b></span>
        <span>Got it: <b style={{ color: "var(--green)" }}>{stats.good}</b></span>
      </div>
    </div>
  );
}
