import { useState } from "react";
import { useReports } from "./hooks/useReports.js";
import { withOpeningAuc } from "./lib/flows.js";
import { Sidebar } from "./components/Sidebar.jsx";
import { Header } from "./components/Header.jsx";
import { Toolbar } from "./components/Toolbar.jsx";
import { Explainer } from "./components/Explainer.jsx";
import { Overview } from "./views/Overview.jsx";
import { SectorHeatmap } from "./views/SectorHeatmap.jsx";
import { SectorDetail } from "./views/SectorDetail.jsx";
import { ComparePeriods } from "./views/ComparePeriods.jsx";
import { Reports } from "./views/Reports.jsx";

export function App() {
  const { reports, flows: rawFlows, loading, busy, error, message, load, upload } = useReports();
  const all = withOpeningAuc(rawFlows);
  const [view, setView] = useState("Overview");
  const [selected, setSelected] = useState("");
  const [compare, setCompare] = useState("");
  const [sector, setSector] = useState("");

  const activeSelected = reports.some((r) => r.report_date === selected) ? selected : reports[0]?.report_date || "";
  const activeCompare = reports.some((r) => r.report_date === compare) ? compare : reports[1]?.report_date || reports[0]?.report_date || "";
  const sectors = [...new Set(all.map((f) => f.sectorName))].sort();
  const activeSector = sector || sectors[0] || "";

  const report = reports.find((r) => r.report_date === activeSelected);
  const previous = reports[reports.findIndex((r) => r.report_date === activeSelected) + 1];
  const flows = all.filter((f) => f.reportDate === activeSelected).sort((a, b) => b.equityNetInvestmentCr - a.equityNetInvestmentCr);
  const before = all.filter((f) => f.reportDate === previous?.report_date);
  const history = all.filter((f) => f.sectorName === activeSector).sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const comparison = all.filter((f) => f.reportDate === activeCompare);
  const differences = flows
    .map((f) => {
      const old = comparison.find((x) => x.sectorName === f.sectorName);
      return { ...f, old, delta: old ? f.equityNetInvestmentCr - old.equityNetInvestmentCr : null };
    })
    .sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity));

  const inspect = (name) => {
    setSector(name);
    setView("Sector detail");
  };

  return (
    <div className="shell">
      <Sidebar view={view} setView={setView} />
      <main>
        <Header view={view} busy={busy} onUpload={upload} />
        {error && (
          <div className="alert" role="alert">
            {error} <button onClick={load}>Try again</button>
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        {loading ? (
          <div className="panel empty">Loading your reports…</div>
        ) : !reports.length ? (
          <div className="panel empty">
            <div className="empty-icon">▤</div>
            <h2>Your first insight starts with a report.</h2>
            <p>Add a fortnightly NSDL HTML report using "Add report". You can select several files together.</p>
          </div>
        ) : (
          <>
            <Toolbar reports={reports} selected={activeSelected} setSelected={setSelected} report={report} />
            {view === "Overview" && <Overview reports={reports} selected={activeSelected} flows={flows} before={before} previous={previous} onSelectSector={inspect} />}
            {view === "Sector heatmap" && <SectorHeatmap reports={reports} flows={all} sectors={sectors} onSelectSector={inspect} />}
            {view === "Sector detail" && (
              <SectorDetail
                reports={reports}
                sector={activeSector}
                setSector={(name) => {
                  setSector(name);
                }}
                sectors={sectors}
                currentFlow={flows.find((f) => f.sectorName === activeSector)}
                history={history}
              />
            )}
            {view === "Compare periods" && <ComparePeriods reports={reports} selected={activeSelected} compare={activeCompare} setCompare={setCompare} differences={differences} onSelectSector={inspect} />}
            {view === "Reports" && <Reports reports={reports} />}
            <Explainer reportCount={reports.length} />
          </>
        )}
      </main>
    </div>
  );
}
