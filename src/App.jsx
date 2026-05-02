import { useState } from 'react';
import './styles.css';
import { Nav } from './components/Nav';
import { Sidebar } from './components/Sidebar';
import { Landing } from './components/Landing';
import { Flashcards } from './components/Flashcards';
import { Extract } from './components/Extract';
import { Dashboard } from './components/Dashboard';
import { IconGraph } from './components/Icons';

function ScreenHeader({ title, sub, right }) {
  return (
    <div className="main-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState("home");

  return (
    <div className="app">
      <Nav route={route} setRoute={setRoute} dark={route === "home"} streak={5} />

      {route === "home" ? (
        <Landing setRoute={setRoute} />
      ) : (
        <div className="app-layout">
          <Sidebar route={route} setRoute={setRoute} counts={{ due: 23 }} />
          <main className="main">
            {route === "learn" && (
              <>
                <ScreenHeader
                  title="Today's review"
                  sub="23 words due · spaced repetition queue"
                  right={<button className="btn btn-ghost btn-sm">End session</button>}
                />
                <Flashcards />
              </>
            )}
            {route === "explore" && (
              <>
                <ScreenHeader
                  title="Extract vocabulary"
                  sub="Paste any German source — we'll surface the words worth learning"
                />
                <Extract />
              </>
            )}
            {route === "progress" && (
              <>
                <ScreenHeader
                  title="Your progress"
                  sub="847 words across 12 topics · started 4 weeks ago"
                  right={<button className="btn btn-ghost btn-sm">Export data</button>}
                />
                <Dashboard />
              </>
            )}
            {route === "graph" && (
              <>
                <ScreenHeader
                  title="Word graph"
                  sub="Explore connections between roots, related forms, and topics"
                />
                <div style={{
                  border: "0.5px solid var(--line)",
                  borderRadius: 12,
                  background: "var(--bg-2)",
                  minHeight: 520,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ink-3)",
                  fontSize: 13
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ marginBottom: 12, opacity: 0.6 }}><IconGraph /></div>
                    <div>Interactive graph view — coming next iteration</div>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
