import { useState, useRef, useEffect } from 'react';
import { GAMES, getGame } from '../games/registry';
import { loadDeck, recordReview } from '../games/api';
import { planGame, plannerAvailable } from '../games/planner';

const CHIPS = [
  'Something with synonyms',
  'Quick der / die / das',
  'Test me with a sentence',
  'Surprise me',
];

const excludeKeyOf = d => d?.anchor?.word ?? d?.anchor ?? d?.answer ?? d?.word ?? null;

export function Arena({ userId, setRoute }) {
  const [activeId, setActiveId] = useState(null);
  const game = getGame(activeId);

  // ── chat (planner agent) ──
  const [msgs, setMsgs] = useState([
    { role: 'agent', text: "Hi! Tell me what you feel like practising and I'll set up a game — or just pick one below." },
  ]);
  const [input, setInput] = useState('');
  const [planning, setPlanning] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, planning]);

  const send = async text => {
    const message = (text ?? input).trim();
    if (!message || planning) return;
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: message }]);
    setPlanning(true);
    try {
      const history = msgs.slice(-4).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant', content: m.text,
      }));
      const { reply, gameId } = await planGame(message, GAMES, history);
      setMsgs(m => [...m, { role: 'agent', text: reply, gameId }]);
    } catch {
      setMsgs(m => [...m, { role: 'agent', text: "I couldn't reach the coach — pick a game below to start." }]);
    } finally {
      setPlanning(false);
    }
  };

  if (game) {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setActiveId(null)} style={{ marginBottom: 16 }}>
          ← All games
        </button>
        {game.selfContained
          ? <game.Component userId={userId} setRoute={setRoute} />
          : <ShellGame key={game.id} game={game} userId={userId} setRoute={setRoute} />}
      </div>
    );
  }

  return (
    <div className="arena">
      {plannerAvailable && (
        <div className="arena-chat">
          <div className="arena-chat-log">
            {msgs.map((m, i) => (
              <div key={i} className={`arena-bubble ${m.role}`}>
                <div>{m.text}</div>
                {m.gameId && getGame(m.gameId) && (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => setActiveId(m.gameId)}>
                    Start {getGame(m.gameId).label} →
                  </button>
                )}
              </div>
            ))}
            {planning && <div className="arena-bubble agent"><span className="arena-typing">thinking…</span></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="arena-chips">
            {CHIPS.map(c => (
              <button key={c} className="arena-chip" onClick={() => send(c)} disabled={planning}>{c}</button>
            ))}
          </div>
          <form className="arena-input" onSubmit={e => { e.preventDefault(); send(); }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="e.g. quiz my weak words, or give me a crossword"
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={planning || !input.trim()}>Send</button>
          </form>
        </div>
      )}

      <div className="arena-or">or pick a game</div>

      <div className="arena-grid">
        {GAMES.map(g => (
          <button key={g.id} className="arena-card" onClick={() => setActiveId(g.id)}>
            <div className="arena-card-top">
              <span className="arena-card-title">{g.label}</span>
              <span className={`arena-tag ${g.tag}`}>{g.tag === 'graph' ? 'Neo4j' : 'Classic'}</span>
            </div>
            <p className="arena-card-blurb">{g.blurb}</p>
            <span className="arena-card-cta">Play →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ShellGame({ game, userId, setRoute }) {
  const [round, setRound] = useState({ status: 'loading' });
  const [roundId, setRoundId] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState({ streak: 0, best: 0, correct: 0, total: 0 });
  const [showCypher, setShowCypher] = useState(false);
  const excludeRef = useRef([]);
  const deckRef = useRef(null);

  async function newRound() {
    setAnswered(false);
    setShowCypher(false);
    setRound({ status: 'loading' });
    if (game.needsDeck && !deckRef.current) deckRef.current = await loadDeck(userId);
    const res = await game.generate({
      userId,
      exclude: excludeRef.current,
      deck: deckRef.current || [],
    });
    if (res.error) setRound({ status: 'error', message: res.message });
    else setRound({ status: 'ready', data: res.data });
    setRoundId(n => n + 1);
  }

  // Mount-time round fetch (same pattern as Crossword.init).
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { newRound(); }, []);

  const onAnswer = correct => {
    if (answered) return;
    setAnswered(true);
    setScore(s => {
      const streak = correct ? s.streak + 1 : 0;
      return {
        streak,
        best: Math.max(s.best, streak),
        correct: s.correct + (correct ? 1 : 0),
        total: s.total + 1,
      };
    });
    const lemma = game.reviewWord?.(round.data);
    if (lemma) recordReview(userId, lemma, correct);
    const key = excludeKeyOf(round.data);
    if (key) {
      excludeRef.current = [...excludeRef.current, key].slice(-12);
    }
  };

  const { status, data, message } = round;

  return (
    <div className="arena-play">
      <div className="arena-scorebar">
        <span className="arena-score-name">{game.label}</span>
        <span className="arena-score-stats">
          <span className="arena-stat streak" title="current streak">
            <span className="arena-stat-ico">🔥</span>{score.streak}
          </span>
          <span className="arena-stat correct" title="correct / total">
            <span className="arena-stat-ico">✓</span>{score.correct}/{score.total}
          </span>
          <span className="arena-stat best" title="best streak">
            <span className="arena-stat-ico">★</span>{score.best}
          </span>
        </span>
      </div>

      {status === 'loading' && (
        <div className="arena-center"><div className="cw-spinner" /></div>
      )}

      {status === 'error' && (
        <div className="arena-center" style={{ textAlign: 'center', gap: 12 }}>
          <div style={{ fontSize: 30 }}>🌱</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', maxWidth: 360, margin: 0 }}>{message}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={newRound}>Try again</button>
            {setRoute && <button className="btn btn-primary btn-sm" onClick={() => setRoute('explore')}>Add words →</button>}
          </div>
        </div>
      )}

      {status === 'ready' && (
        <>
          <game.Component key={roundId} data={data} onAnswer={onAnswer} />

          {answered && (
            <div className="arena-after">
              {game.tag === 'graph' && data.cypher && (
                <details className="arena-cypher" open={showCypher}
                  onToggle={e => setShowCypher(e.target.open)}>
                  <summary>How the graph built this round</summary>
                  <pre>{data.cypher}</pre>
                </details>
              )}
              <button className="btn btn-primary" onClick={newRound}>Next round →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
