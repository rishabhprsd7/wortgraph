import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';
import './styles.css';
import { Nav } from './components/Nav';
import { Sidebar } from './components/Sidebar';
import { Landing } from './components/Landing';
import { Learn } from './components/Learn';
import { Extract } from './components/Extract';
import { Dashboard } from './components/Dashboard';
import { Agent } from './components/Agent';
import { Graph } from './components/Graph';
import { About } from './components/About';
import { Arena } from './components/Arena';

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
        background: 'var(--bg-2)', borderRadius: 16, padding: '40px 36px', width: 360,
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
  const [deckStats, setDeckStats] = useState({ due: 0, wordCount: 0, sources: [] });
  const [theme, setTheme] = useState(() => localStorage.getItem('wg_theme') || 'light');

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('wg_theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    if (!userId || !API_URL) return;
    const q = `?userId=${encodeURIComponent(userId)}`;
    Promise.all([
      fetch(`${API_URL}/api/weak${q}`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/api/words${q}`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/api/sources${q}`).then(r => r.json()).catch(() => []),
    ]).then(([weak, words, sources]) => {
      setDeckStats({ due: weak.length, wordCount: words.length, sources });
    });
  }, [userId]);

  const handleSetUser = (id) => {
    localStorage.setItem('wg_user', id);
    setUserId(id);
    // New users → Explore (add vocab first). Demo users → Learn (populated deck).
    setRoute(id === 'demo' ? 'learn' : 'explore');
  };

  const handleExport = async () => {
    try {
      let words = [], sources = [];
      if (API_URL) {
        const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        [words, sources] = await Promise.all([
          fetch(`${API_URL}/api/words${q}`).then(r => r.json()).catch(() => []),
          fetch(`${API_URL}/api/sources${q}`).then(r => r.json()).catch(() => []),
        ]);
      }
      const payload = {
        app: 'Wortgraph',
        exportedAt: new Date().toISOString(),
        user: userId || 'default',
        wordCount: words.length,
        sources,
        words,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wortgraph-${userId || 'deck'}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleSwitchUser = () => {
    localStorage.removeItem('wg_user');
    setUserId(null);
  };

  const handleTryDemo = () => {
    localStorage.setItem('wg_user', 'demo');
    setUserId('demo');
    setRoute('learn');
  };

  return (
    <div className="app">
      {!userId && <WelcomeModal onSubmit={handleSetUser} />}
      <Nav
        route={route} setRoute={setRoute} dark={route === 'home' || theme === 'dark'}
        userId={userId} onSwitchUser={handleSwitchUser} onTryDemo={handleTryDemo}
        theme={theme} onToggleTheme={toggleTheme}
      />

      {route === 'home' ? (
        <Landing setRoute={setRoute} />
      ) : (
        <div className="app-layout">
          <Sidebar route={route} setRoute={setRoute} counts={{ due: deckStats.due }} sources={deckStats.sources} />
          <main className="main">
            {route === 'learn' && (
              <>
                <ScreenHeader title="Learn" sub="Study by source or practice all words with flashcards" />
                <Learn userId={userId} setRoute={setRoute} />
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
                  sub={deckStats.wordCount > 0
                    ? `${deckStats.wordCount} words across ${deckStats.sources.length} source${deckStats.sources.length !== 1 ? 's' : ''}`
                    : 'Track your vocabulary growth and retention over time'}
                  right={<button className="btn btn-ghost btn-sm" onClick={handleExport}>Export data</button>}
                />
                <Dashboard userId={userId} />
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
                  title="AI Coach"
                  sub="Powered by Neo4j · analyses your graph to suggest what to study next"
                />
                <Agent userId={userId} />
              </>
            )}
            {route === 'arena' && (
              <>
                <ScreenHeader title="Arena" sub="Pick a game — each one is built from your vocabulary graph" />
                <Arena userId={userId} setRoute={setRoute} />
              </>
            )}
            {route === 'about' && (
              <>
                <ScreenHeader title="About Wortgraph" sub="Why this exists, how it works, and who it's for" />
                <About setRoute={setRoute} />
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
