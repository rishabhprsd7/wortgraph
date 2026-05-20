import { useState, useMemo } from 'react';

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

function useStreakData(userId) {
  return useMemo(() => {
    try {
      const key = `wg_activity_${userId || 'default'}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      const dateSet = new Set(stored);
      const today = new Date().toISOString().slice(0, 10);

      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const iso = d.toISOString().slice(0, 10);
        return {
          label: 'SMTWTFS'[d.getDay()],
          active: dateSet.has(iso),
          isToday: iso === today,
        };
      });

      let streak = 0;
      const startOffset = dateSet.has(today) ? 0 : 1;
      for (let i = startOffset; i < 365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (dateSet.has(d.toISOString().slice(0, 10))) streak++;
        else break;
      }

      return { days, streak };
    } catch {
      return { days: [], streak: 0 };
    }
  }, [userId]);
}

function UserMenu({ userId, dark, onSwitchUser, onTryDemo }) {
  const [open, setOpen] = useState(false);
  const label = userId === 'demo' ? '✨ demo' : userId;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`btn btn-sm ${dark ? 'btn-ghost-dark' : 'btn-ghost'}`}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%', background: 'var(--violet)',
          color: '#fff', fontSize: 11, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {(userId?.[0] || '?').toUpperCase()}
        </span>
        <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100,
            background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>Signed in as</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{userId}</div>
            </div>
            {userId !== 'demo' && (
              <button
                onClick={() => { setOpen(false); onTryDemo(); }}
                style={{
                  width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                  textAlign: 'left', cursor: 'pointer', fontSize: 13, color: 'var(--violet)',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                  borderBottom: '1px solid var(--line)',
                }}
              >
                ✨ Try demo data
              </button>
            )}
            <button
              onClick={() => { setOpen(false); onSwitchUser(); }}
              style={{
                width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                textAlign: 'left', cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              ↩ Switch user
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Nav({ route, setRoute, dark, userId, onSwitchUser, onTryDemo, theme, onToggleTheme }) {
  const { days, streak } = useStreakData(userId);
  const primaryLinks = [
    { id: "explore", label: "Explore" },
    { id: "learn", label: "Learn" },
    { id: "arena", label: "Arena" },
  ];
  const middleLinks = [
    { id: "agent", label: "AI Coach" },
    { id: "progress", label: "Progress" },
  ];
  const secondaryLinks = [
    { id: "graph", label: "Graph" },
    { id: "about", label: "About" },
  ];
  const renderLink = l => (
    <span
      key={l.id}
      className={`nav-link${route === l.id ? " active" : ""}`}
      onClick={() => setRoute(l.id)}
    >
      {l.label}
    </span>
  );
  return (
    <nav className={`nav${dark ? " dark" : ""}`}>
      <div onClick={() => setRoute("home")} style={{ cursor: "pointer" }}>
        <Logo dark={dark} />
      </div>
      <div className="nav-links">
        <div className="nav-group">{primaryLinks.map(renderLink)}</div>
        <span className="nav-divider" aria-hidden="true" />
        <div className="nav-group">{middleLinks.map(renderLink)}</div>
        <span className="nav-divider" aria-hidden="true" />
        <div className="nav-group">{secondaryLinks.map(renderLink)}</div>
      </div>
      <div className="nav-right">
        <span className="streak" title={streak > 0 ? `${streak}-day streak` : 'Start streak'}>
          {days.map((d, i) => (
            <span key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: d.active ? (dark ? '#c4bff5' : 'var(--violet)') : (dark ? 'rgba(255,255,255,0.25)' : 'var(--ink-4)') }}>
                {d.label}
              </span>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: d.active ? (dark ? '#c4bff5' : 'var(--violet)') : (dark ? 'rgba(255,255,255,0.15)' : 'var(--line)'),
                outline: d.isToday ? `2px solid ${dark ? 'rgba(196,191,245,0.5)' : 'rgba(127,119,221,0.35)'}` : 'none',
                outlineOffset: 1,
              }} />
            </span>
          ))}
          <span style={{ marginLeft: 6, fontSize: 12, whiteSpace: 'nowrap' }}>
            {streak > 0 ? `${streak}-day streak` : 'Start streak'}
          </span>
        </span>
        {onToggleTheme && (
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        )}
        {userId
          ? <UserMenu userId={userId} dark={dark} onSwitchUser={onSwitchUser} onTryDemo={onTryDemo} />
          : null
        }
      </div>
    </nav>
  );
}
