const VIEWS = [
  ["Overview", "◫"],
  ["Sector heatmap", "▦"],
  ["Sector detail", "⌁"],
  ["Compare periods", "⇄"],
  ["Reports", "▤"],
];

export function Sidebar({ view, setView }) {
  return (
    <aside>
      <a className="brand" href="#" onClick={() => setView("Overview")}>
        <span className="brand-icon">↗</span>
        <span className="brand-name">
          NSDL FPI<small>Analysis</small>
        </span>
      </a>
      <div className="workspace">YOUR MARKET NOTEBOOK</div>
      <nav>
        {VIEWS.map(([name, icon]) => (
          <button key={name} className={view === name ? "active" : ""} onClick={() => setView(name)}>
            <span>{icon}</span>
            {name}
          </button>
        ))}
      </nav>
      <div className="sidebar-note">
        <span className="status-dot" /> Your market notebook
        <p>Your saved reports, across fortnights.</p>
      </div>
    </aside>
  );
}
