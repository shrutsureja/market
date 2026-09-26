import { useState } from "react";
import { date, flowShare, pct, signed, sum } from "../lib/format.js";

const WINDOWS = [
  [6, "Last 3 months"],
  [12, "Last 6 months"],
  [26, "Last year"],
  [52, "Last 2 years"],
  [Infinity, "All time"],
];

const MODES = [
  ["pct", "% of sector AUC"],
  ["cr", "₹ crore"],
];

export function SectorHeatmap({ reports, flows, sectors, onSelectSector }) {
  const [windowSize, setWindowSize] = useState(12);
  const [mode, setMode] = useState("pct");
  // Reports are newest-first; keep only the N most recent so the latest fortnight never has
  // to compete with years of history for a spot on screen as more reports pile up.
  const visible = reports.slice(0, windowSize);
  const visibleDates = new Set(visible.map((r) => r.report_date));
  const windowFlows = flows.filter((f) => visibleDates.has(f.reportDate));
  const maxCr = Math.max(...windowFlows.map((x) => Math.abs(x.equityNetInvestmentCr)), 1);
  // % of AUC avoids the size bias of crore — a large sector's routine wobble no longer looks
  // "hotter" than a small sector's real move — but crore is still there for whoever wants it.
  const maxPct = Math.max(...windowFlows.map((x) => Math.abs(flowShare(x.equityNetInvestmentCr, x.openingAucCr)) || 0), 1);
  const ordered = [...visible].reverse();
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h2>Follow the flow over time</h2>
          <p>Each cell is one sector's net investment. {mode === "pct" ? "Darker shades mean a bigger move for that sector's own holdings, not just a bigger number." : "Darker shades mean a larger absolute flow."}</p>
        </div>
        <label>
          Color by
          <select aria-label="Color by" value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Show
          <select aria-label="Time window" value={windowSize} onChange={(e) => setWindowSize(Number(e.target.value))}>
            {WINDOWS.map(([n, label]) => (
              <option key={label} value={n}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="legend">
          <i /> Outflow <i /> Inflow
        </span>
      </div>
      <div className="table-wrap heatmap">
        <table>
          <thead>
            <tr>
              <th>Sector / ₹ crore</th>
              {ordered.map((r) => (
                <th key={r.id}>
                  {date(r.report_date)}
                  <small>{r.report_date.slice(0, 4)}</small>
                </th>
              ))}
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((s) => (
              <tr key={s}>
                <td>
                  <button className="text-button" onClick={() => onSelectSector(s)}>
                    {s}
                  </button>
                </td>
                {ordered.map((r) => {
                  const flow = windowFlows.find((f) => f.sectorName === s && f.reportDate === r.report_date);
                  const v = flow?.equityNetInvestmentCr;
                  const share = flow ? flowShare(flow.equityNetInvestmentCr, flow.openingAucCr) : null;
                  const intensity = mode === "pct" ? (share == null ? 0 : 0.1 + (Math.abs(share) / maxPct) * 0.7) : v == null ? 0 : 0.1 + (Math.abs(v) / maxCr) * 0.7;
                  return (
                    <td key={r.id} style={{ background: v == null ? "#f4f5f6" : v >= 0 ? `rgba(36,149,116,${intensity})` : `rgba(225,97,81,${intensity})` }}>
                      {v == null ? (
                        "—"
                      ) : mode === "pct" ? (
                        <>
                          {pct(share)}
                          <small>{signed(v)} Cr</small>
                        </>
                      ) : (
                        <>
                          {signed(v)}
                          <small>{pct(share)} of AUC</small>
                        </>
                      )}
                    </td>
                  );
                })}
                <td>{signed(sum(windowFlows.filter((f) => f.sectorName === s)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
