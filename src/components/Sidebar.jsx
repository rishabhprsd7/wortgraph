import { IconLearn, IconExplore, IconProgress, IconGraph, IconDeck, IconHelp } from './Icons';

export function Sidebar({ route, setRoute, counts, sources = [] }) {
  const items = [
    { id: "learn", label: "Learn", icon: <IconLearn />, count: counts.due || null },
    { id: "explore", label: "Explore", icon: <IconExplore /> },
    { id: "arena", label: "Arena", icon: <span style={{ fontSize: 15 }}>⊞</span> },
    { id: "progress", label: "Progress", icon: <IconProgress /> },
    { id: "concepts", label: "Clusters", icon: <span style={{ fontSize: 15 }}>🧩</span> },
    { id: "graph", label: "Graph", icon: <IconGraph /> },
    { id: "agent", label: "AI Coach", icon: <span style={{ fontSize: 16 }}>✦</span> }
  ];

  const label = (s) => {
    const text = s.snippet || s.type || 'Source';
    return text.length > 26 ? text.slice(0, 26) + '…' : text;
  };

  return (
    <aside className="sidebar">
      <div className="sb-section">Workspace</div>
      {items.map(it => (
        <div
          key={it.id}
          className={`sb-link${route === it.id ? " active" : ""}`}
          onClick={() => setRoute(it.id)}
        >
          {it.icon}
          <span>{it.label}</span>
          {it.count != null && it.count > 0 && <span className="sb-count">{it.count}</span>}
        </div>
      ))}
      <div className="sb-section">Sources</div>
      {sources.length === 0 ? (
        <div className="sb-link" style={{ color: 'var(--ink-4)', fontSize: 12, cursor: 'default' }}>
          <IconDeck /><span>No sources yet</span>
        </div>
      ) : (
        sources.slice(0, 6).map(s => (
          <div key={s.id} className="sb-link" onClick={() => setRoute('learn')} title={s.snippet || s.type}>
            <IconDeck />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(s)}</span>
            {s.wordCount > 0 && <span className="sb-count">{s.wordCount}</span>}
          </div>
        ))
      )}
      <div style={{ flex: 1 }}></div>
      <div className="sb-link" style={{ color: "var(--ink-3)", fontSize: 12 }}>
        <IconHelp /><span>Keyboard shortcuts</span>
      </div>
    </aside>
  );
}
