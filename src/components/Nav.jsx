export function Logo({ dark }) {
  const c = dark ? "#9d96e8" : "#7f77dd";
  return (
    <span className="nav-logo">
      <svg className="logo-mark" viewBox="0 0 24 24" fill="none">
        <circle cx="6" cy="6" r="2.5" fill={c} />
        <circle cx="18" cy="6" r="1.8" fill={c} opacity="0.55" />
        <circle cx="6" cy="18" r="1.8" fill={c} opacity="0.55" />
        <circle cx="18" cy="18" r="2.5" fill={c} />
        <circle cx="12" cy="12" r="2" fill={c} opacity="0.85" />
        <path d="M6 6 L12 12 L18 18 M18 6 L12 12 L6 18" stroke={c} strokeWidth="0.8" opacity="0.45" />
      </svg>
      <span>Wortgraph</span>
    </span>
  );
}

export function Nav({ route, setRoute, dark, streak }) {
  const links = [
    { id: "learn", label: "Learn" },
    { id: "explore", label: "Explore" },
    { id: "progress", label: "Progress" },
    { id: "agent", label: "Agent" },
  ];
  return (
    <nav className={`nav${dark ? " dark" : ""}`}>
      <div onClick={() => setRoute("home")} style={{ cursor: "pointer" }}>
        <Logo dark={dark} />
      </div>
      <div className="nav-links">
        {links.map(l => (
          <span
            key={l.id}
            className={`nav-link${route === l.id ? " active" : ""}`}
            onClick={() => setRoute(l.id)}
          >
            {l.label}
          </span>
        ))}
      </div>
      <div className="nav-right">
        <span className="streak">
          <span className="streak-dot"></span>
          <span>{streak}-day streak</span>
        </span>
        <button className={`btn btn-sm ${dark ? "btn-ghost-dark" : "btn-ghost"}`}>Sign in</button>
      </div>
    </nav>
  );
}
