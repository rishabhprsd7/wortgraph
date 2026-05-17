import { useState, useEffect, useRef } from 'react';

const TOKENS = [
  { t: "Die" }, { t: " " },
  { t: "Inflation", ext: true, id: "w1", article: "die" },
  { t: " in der " },
  { t: "Eurozone", ext: true, id: "w2", article: "die" },
  { t: " ist im April erneut leicht gestiegen. " },
  { t: "Verbraucher", ext: true, id: "w3", article: "der" },
  { t: " spüren die höheren " },
  { t: "Lebenshaltungskosten", ext: true, id: "w4", article: "die" },
  { t: " vor allem bei " },
  { t: "Lebensmitteln", ext: true, id: "w5", article: "die" },
  { t: " und Energie. Die " },
  { t: "Notenbank", ext: true, id: "w6", article: "die" },
  { t: " hält am " },
  { t: "Leitzins", ext: true, id: "w7", article: "der" },
  { t: " fest." }
];

const extractable = TOKENS.filter(x => x.ext);

export function ExtractAnim() {
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(280);

  useEffect(() => {
    const measure = () => {
      if (stageRef.current) setStageW(stageRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const [activeIds, setActiveIds] = useState(new Set());
  const [stacked, setStacked] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timers = [];
    setActiveIds(new Set());
    setStacked([]);

    timers.push(setTimeout(() => {}, 400));

    extractable.forEach((w, i) => {
      timers.push(setTimeout(() => {
        setActiveIds(prev => new Set([...prev, w.id]));
      }, 600 + i * 220));
      timers.push(setTimeout(() => {
        setStacked(prev => [...prev, w.id]);
      }, 600 + i * 220 + 900));
    });

    timers.push(setTimeout(() => {
      setTick(t => t + 1);
    }, 600 + extractable.length * 220 + 2400));

    return () => timers.forEach(clearTimeout);
  }, [tick]);

  const restart = () => setTick(t => t + 1);

  const stackTarget = (i) => ({
    x: stageW - 180 + 6 + ((i * 11) % 8) - 2,
    y: 16 + i * 30,
    rot: -3 + ((i * 37) % 7)
  });

  return (
    <div className="ex-anim" onClick={restart}>
      <div className="ex-text">
        <div className="ex-text-head">
          <span className="ex-dot"></span>
          <span className="ex-text-title">zeit.de · article</span>
          <span className="ex-text-time">paste.txt</span>
        </div>
        <p className="ex-text-body">
          {TOKENS.map((tok, i) => {
            if (!tok.ext) return <span key={i}>{tok.t}</span>;
            const isActive = activeIds.has(tok.id);
            const isStacked = stacked.includes(tok.id);
            return (
              <span key={i} className={`ex-w${isActive ? " on" : ""}${isStacked ? " gone" : ""}`}>
                {tok.t}
              </span>
            );
          })}
        </p>
        <div className="ex-text-foot">
          <span>{stacked.length} of {extractable.length} extracted</span>
          <span className="ex-replay">↻ Replay</span>
        </div>
      </div>

      <div className="ex-stage" ref={stageRef}>
        {extractable.map((w, i) => {
          const isActive = activeIds.has(w.id);
          const isStacked = stacked.includes(w.id);
          const stackIdx = stacked.indexOf(w.id);
          const target = isStacked ? stackTarget(stackIdx) : null;
          const midX = Math.max(20, (stageW - 180) / 2 - 70);
          const startY = 70 + (i % 4) * 36;

          let style;
          if (isStacked) {
            style = {
              transform: `translate(${target.x}px, ${target.y}px) rotate(${target.rot}deg) scale(1)`,
              opacity: 1,
              transition: "transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 300ms ease"
            };
          } else if (isActive) {
            style = {
              transform: `translate(${midX}px, ${startY}px) scale(1.05)`,
              opacity: 1,
              transition: "transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms ease"
            };
          } else {
            style = {
              transform: `translate(0px, ${startY}px) scale(0.7)`,
              opacity: 0,
              transition: "transform 220ms ease, opacity 220ms ease"
            };
          }

          return (
            <div key={w.id} className={`fly-card${isStacked ? " landed" : ""}`} style={style}>
              <span className="fly-art">{w.article}</span>
              <span className="fly-word">{w.t}</span>
            </div>
          );
        })}

        <svg className="ex-beams" viewBox={`0 0 ${stageW} 420`} preserveAspectRatio="none">
          {extractable.map((w, i) => {
            const isActive = activeIds.has(w.id) && !stacked.includes(w.id);
            const startY = 70 + (i % 4) * 36 + 14;
            const midX = Math.max(20, (stageW - 180) / 2 - 70);
            return (
              <line key={w.id}
                x1="0" y1={startY}
                x2={midX} y2={startY}
                stroke="#9d96e8"
                strokeOpacity={isActive ? 0.55 : 0}
                strokeWidth="0.5"
                strokeDasharray="2 3"
                style={{ transition: "stroke-opacity 320ms ease" }}
              />
            );
          })}
        </svg>

        <div className="ex-deck-frame">
          <div className="ex-deck-label">DECK · 7 cards</div>
        </div>
      </div>
    </div>
  );
}
