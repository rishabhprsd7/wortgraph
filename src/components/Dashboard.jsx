import { weakWords, activity } from '../data/vocab';
import { IconCheck, IconProgress, IconDeck } from './Icons';

function Heatmap() {
  const weeks = 26;
  const cells = [];
  let seed = 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let w = 0; w < weeks; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const r = rand();
      let lvl = 0;
      if (w > weeks - 6) lvl = r > 0.15 ? 3 + Math.floor(rand() * 2) : 1;
      else if (w > weeks - 12) lvl = r > 0.3 ? 1 + Math.floor(rand() * 3) : 0;
      else lvl = r > 0.5 ? Math.floor(rand() * 4) : 0;
      week.push(lvl);
    }
    cells.push(week);
  }
  return (
    <div className="heat">
      <div className="heat-labels">
        <span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span>
      </div>
      {cells.map((week, wi) => (
        <div key={wi} className="heat-week">
          {week.map((lvl, di) => (
            <div key={di} className={`heat-cell${lvl ? ` l${Math.min(lvl, 4)}` : ""}`}
              title={lvl ? `${lvl * 8} reviews` : "no reviews"}></div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StreakWeek() {
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const states = ["done","done","done","done","today","future","future"];
  return (
    <div className="streak-row">
      {days.map((d, i) => (
        <div key={d} className="streak-day">
          <div className={`streak-pill${states[i] === "done" ? " done" : states[i] === "today" ? " today" : ""}`}>
            {states[i] === "done" ? <IconCheck /> : states[i] === "today" ? "Today" : ""}
          </div>
          <span>{d}</span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const metrics = [
    { lbl: "Words learned", val: "847", delta: "+12 this week" },
    { lbl: "Current streak", val: "5 days", delta: "Personal best: 14" },
    { lbl: "Due for review", val: "23", delta: "−4 from yesterday" },
    { lbl: "Retention rate", val: "89%", delta: "+2.4% (30d)" }
  ];

  return (
    <>
      <div className="metrics">
        {metrics.map(m => (
          <div key={m.lbl} className="metric">
            <div className="metric-lbl">{m.lbl}</div>
            <div className="metric-val">{m.val}</div>
            <div className="metric-delta">{m.delta}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-h">
            <span className="t">Review activity</span>
            <span className="s">Last 26 weeks</span>
          </div>
          <div className="panel-b">
            <Heatmap />
            <div className="heat-legend">
              <span>Less</span>
              <span className="heat-cell"></span>
              <span className="heat-cell l1"></span>
              <span className="heat-cell l2"></span>
              <span className="heat-cell l3"></span>
              <span className="heat-cell l4"></span>
              <span>More</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <span className="t">This week</span>
            <span className="s">5 of 7 days</span>
          </div>
          <div className="panel-b">
            <StreakWeek />
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-h">
            <span className="t">Weak words</span>
            <span className="s">Below 65% retention</span>
          </div>
          <div className="panel-b">
            <div className="weak-list">
              {weakWords.map(w => (
                <div key={w.word} className="weak-item">
                  <span className={`weak-dot${w.level === "med" ? " med" : ""}`}></span>
                  <div>
                    <div className="weak-word">{w.word}</div>
                    <div className="weak-trans">{w.trans}</div>
                  </div>
                  <span className="weak-stat">{w.retention}%</span>
                  <button className="btn btn-ghost btn-sm">Review</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <span className="t">Recent activity</span>
            <span className="s">Last 7 days</span>
          </div>
          <div className="panel-b">
            <div className="activity">
              {activity.map((a, i) => (
                <div key={i} className="act">
                  <div className="act-icon">
                    {a.type === "deck" ? <IconDeck /> : a.type === "review" ? <IconCheck /> : <IconProgress />}
                  </div>
                  <div>{a.text}</div>
                  <div className="act-time">{a.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
