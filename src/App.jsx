import { useState } from 'react';
import './styles.css';
import { Nav } from './components/Nav';
import { Sidebar } from './components/Sidebar';
import { Landing } from './components/Landing';
import { Learn } from './components/Learn';
import { Extract } from './components/Extract';
import { Dashboard } from './components/Dashboard';
import { Agent } from './components/Agent';
import { Graph } from './components/Graph';

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
                  title="Learn"
                  sub="Study by source or practice all words with flashcards"
                />
                <Learn />
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
                  title="Your vocabulary graph"
                  sub="Every word you've saved, connected to others by CO_OCCURS_WITH edges from shared sources"
                />
                <Graph />
              </>
            )}
            {route === "agent" && (
              <>
                <ScreenHeader
                  title="AI learning coach"
                  sub="Powered by Neo4j · analyses your graph to suggest what to study next"
                />
                <Agent />
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
