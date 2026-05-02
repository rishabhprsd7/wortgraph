import { ExtractAnim } from './ExtractAnim';

export function Landing({ setRoute }) {
  return (
    <>
      <section className="hero">
        <div className="hero-glow"></div>
        <div className="hero-inner">
          <div>
            <span className="hero-badge">
              <span className="dot"></span>
              Graph-powered · AI-native
            </span>
            <h1>Learn German the way <em>language actually works</em>.</h1>
            <p className="hero-sub">
              Paste any German text — articles, podcasts, interviews — and build vocabulary
              from real context, not random word lists.
            </p>
            <div className="hero-ctas">
              <button className="btn btn-primary btn-lg" onClick={() => setRoute("learn")}>
                Start for free
              </button>
              <button className="btn btn-ghost-dark btn-lg" onClick={() => setRoute("explore")}>
                Paste a text →
              </button>
            </div>
            <div className="hero-stats">
              <div>
                <div className="hero-stat-num">2,400+</div>
                <div className="hero-stat-lbl">Words in graph</div>
              </div>
              <div>
                <div className="hero-stat-num">AI-powered</div>
                <div className="hero-stat-lbl">Context extraction</div>
              </div>
              <div>
                <div className="hero-stat-num">Free</div>
                <div className="hero-stat-lbl">No account needed</div>
              </div>
            </div>
          </div>
          <div>
            <ExtractAnim />
          </div>
        </div>
      </section>

      <section className="hero-strip">
        <div className="hero-strip-inner">
          <div className="hs-item">
            <div className="hs-eyebrow">01 — INPUT</div>
            <div className="hs-title">Real text, not word lists</div>
            <div className="hs-body">
              Drop in articles, transcripts, or interviews. We surface the words worth learning
              from the context you actually read.
            </div>
          </div>
          <div className="hs-item">
            <div className="hs-eyebrow">02 — STRUCTURE</div>
            <div className="hs-title">A graph, not a stack</div>
            <div className="hs-body">
              Every word lives connected to roots, related forms, and the topics it appears in —
              so you remember meaning, not isolated tokens.
            </div>
          </div>
          <div className="hs-item">
            <div className="hs-eyebrow">03 — REVIEW</div>
            <div className="hs-title">Spaced, then forgotten</div>
            <div className="hs-body">
              Review surfaces words just before you'd forget them. No streak guilt, no fake
              gamification — just honest signal.
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">FOR ADULT LEARNERS</div>
        <h2>Built for B1 and beyond.</h2>
        <p className="lede">
          If you've cleared duolingo and you're now staring at Spiegel, Süddeutsche, or
          podcasts wondering what half the words mean — Wortgraph is the missing layer.
        </p>

        <div className="features">
          <div className="feat">
            <div className="feat-num">/01</div>
            <h3>CEFR-aware</h3>
            <p>
              Words are tagged B1 / B2 / C1 based on usage frequency in the corpus, so you can
              focus on the level just above your own.
            </p>
          </div>
          <div className="feat">
            <div className="feat-num">/02</div>
            <h3>Context preserved</h3>
            <p>
              Every card keeps the original sentence it was extracted from. You learn meaning
              the way the language uses it, not the way a dictionary describes it.
            </p>
          </div>
          <div className="feat">
            <div className="feat-num">/03</div>
            <h3>Honest review</h3>
            <p>
              Three responses — hard, again, got it. No XP, no leagues, no mascot. Your
              retention rate is the only metric that matters.
            </p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>© Wortgraph · Built for serious learners</div>
        <div className="footer-links">
          <span>Method</span>
          <span>Pricing</span>
          <span>Changelog</span>
          <span>Contact</span>
        </div>
      </footer>
    </>
  );
}
