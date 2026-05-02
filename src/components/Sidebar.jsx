import { IconLearn, IconExplore, IconProgress, IconGraph, IconDeck, IconHelp } from './Icons';

export function Sidebar({ route, setRoute, counts }) {
  const items = [
    { id: "learn", label: "Learn", icon: <IconLearn />, count: counts.due },
    { id: "explore", label: "Explore", icon: <IconExplore /> },
    { id: "progress", label: "Progress", icon: <IconProgress /> },
    { id: "graph", label: "Graph", icon: <IconGraph /> }
  ];
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
          {it.count != null && <span className="sb-count">{it.count}</span>}
        </div>
      ))}
      <div className="sb-section">Decks</div>
      <div className="sb-link"><IconDeck /><span>Politics & policy</span><span className="sb-count">312</span></div>
      <div className="sb-link"><IconDeck /><span>Climate</span><span className="sb-count">186</span></div>
      <div className="sb-link"><IconDeck /><span>Lage der Nation</span><span className="sb-count">94</span></div>
      <div className="sb-link"><IconDeck /><span>Zeit Online</span><span className="sb-count">241</span></div>
      <div style={{ flex: 1 }}></div>
      <div className="sb-link" style={{ color: "var(--ink-3)", fontSize: 12 }}>
        <IconHelp /><span>Keyboard shortcuts</span>
      </div>
    </aside>
  );
}
