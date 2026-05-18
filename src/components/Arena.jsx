import { useState } from 'react';
import { GAMES, getGame } from '../games/registry';

export function Arena({ userId, setRoute }) {
  const [activeId, setActiveId] = useState(null);
  const game = getGame(activeId);

  if (game) {
    return (
      <div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setActiveId(null)}
          style={{ marginBottom: 16 }}
        >
          ← All games
        </button>
        {game.selfContained && <game.Component userId={userId} setRoute={setRoute} />}
      </div>
    );
  }

  return (
    <div className="arena-grid">
      {GAMES.map(g => (
        <button key={g.id} className="arena-card" onClick={() => setActiveId(g.id)}>
          <div className="arena-card-top">
            <span className="arena-card-title">{g.label}</span>
            <span className={`arena-tag ${g.tag}`}>
              {g.tag === 'graph' ? 'Neo4j' : 'Classic'}
            </span>
          </div>
          <p className="arena-card-blurb">{g.blurb}</p>
          <span className="arena-card-cta">Play →</span>
        </button>
      ))}
    </div>
  );
}
