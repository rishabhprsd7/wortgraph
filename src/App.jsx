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

function WelcomeModal({ onSubmit }) {
  const [name, setName] = useState('');
  const handle = () => {
    const id = name.trim().toLowerCase().replace(/\s+/g, '-') || 'learner';
    onSubmit(id);
  };
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,8,20,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px', width: 360,
        boxShadow: '0 24px 60px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Welcome to Wortgraph</div>
          <div style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Enter your name to start building your personal vocabulary graph.
          </div>
        </div>
        <button
          onClick={() => onSubmit('demo')}
          style={{
            width: '100%', padding: '11px 0', fontSize: 14, borderRadius: 10, cursor: 'pointer',
            background: 'var(--violet-soft)', border: '1.5px solid var(--violet-line)',
            color: 'var(--violet)', fontWeight: 600, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}
        >
          <span>✨</span> Try with demo data
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
        <input
          autoFocus
          style={{
            border: '1.5px solid var(--violet)', borderRadius: 10, padding: '10px 14px',
            fontSize: 15, outline: 'none', color: 'var(--ink)', background: 'var(--bg)',
          }}
          placeholder="Your name…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && handle()}
        />
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '11px 0', fontSize: 15 }}
          disabled={!name.trim()}
          onClick={handle}
        >
          Start learning
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState('home');
  const [userId, setUserId] = useState(() => localStorage.getItem('wg_user'));

  const handleSetUser = (id) => {
    localStorage.setItem('wg_user', id);
    setUserId(id);
  };

  const handleSwitchUser = () => {
    localStorage.removeItem('wg_user');
    setUserId(null);
  };

  const handleTryDemo = () => {
    localStorage.setItem('wg_user', 'demo');
    setUserId('demo');
  };

  return (
    <div className="app">
      {!userId && <WelcomeModal onSubmit={handleSetUser} />}
      <Nav
        route={route} setRoute={setRoute} dark={route === 'home'} streak={5}
        userId={userId} onSwitchUser={handleSwitchUser} onTryDemo={handleTryDemo}
      />

      {route === 'home' ? (
        <Landing setRoute={setRoute} />
      ) : (
        <div className="app-layout">
          <Sidebar route={route} setRoute={setRoute} counts={{ due: 23 }} />
          <main className="main">
            {route === 'learn' && (
              <>
                <ScreenHeader title="Learn" sub="Study by source or practice all words with flashcards" />
                <Learn userId={userId} />
              </>
            )}
            {route === 'explore' && (
              <>
                <ScreenHeader title="Extract vocabulary" sub="Paste any German source — we'll surface the words worth learning" />
                <Extract userId={userId} />
              </>
            )}
            {route === 'progress' && (
              <>
                <ScreenHeader
                  title="Your progress"
                  sub="847 words across 12 topics · started 4 weeks ago"
                  right={<button className="btn btn-ghost btn-sm">Export data</button>}
                />
                <Dashboard />
              </>
            )}
            {route === 'graph' && (
              <>
                <ScreenHeader
                  title="Your vocabulary graph"
                  sub="Every word you've saved, connected to others by CO_OCCURS_WITH edges from shared sources"
                />
                <Graph userId={userId} />
              </>
            )}
            {route === 'agent' && (
              <>
                <ScreenHeader
                  title="AI learning coach"
                  sub="Powered by Neo4j · analyses your graph to suggest what to study next"
                />
                <Agent userId={userId} />
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
