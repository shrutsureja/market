const TITLES = {
  Overview: "Where is the money moving?",
  "Sector heatmap": "The bigger picture.",
  "Sector detail": "Get to know a sector.",
  "Compare periods": "What changed between periods?",
  Reports: "Your report library.",
};

export function Header({ view, busy, onUpload }) {
  return (
    <>
      <div className="topbar">
        <span>
          INDIAN EQUITIES <span className="separator">/</span> FOREIGN INVESTOR FLOWS
        </span>
        <a className="source" href="https://www.fpi.nsdl.co.in/web/Reports/FPI_Fortnightly_Selection.aspx" target="_blank" rel="noopener noreferrer">
          ● NSDL reports ↗
        </a>
      </div>
      <header>
        <div>
          <div className="eyebrow">FOLLOW THE MONEY, EVERY FORTNIGHT</div>
          <h1>{TITLES[view]}</h1>
          <p>Understand where foreign investors are adding money—and where they are pulling back.</p>
        </div>
        <label className="upload">
          {busy ? "Importing…" : "+ Add report"}
          <input disabled={busy} type="file" multiple accept=".html,.htm,text/html" onChange={(e) => { onUpload([...e.target.files]); e.target.value = ""; }} />
        </label>
      </header>
    </>
  );
}
