import { useState } from "react";
import { flowShare, number, pct, period, signed, sum, tone, transition } from "../lib/format.js";
import { Ranking } from "../components/Ranking.jsx";

// A sector with a tiny AUC base can show a huge % of AUC from a small, unremarkable crore
// amount — dividing by a small number inflates the percentage without real significance. This
// floor keeps such sectors out of the %-ranked "top movers" lists (the ₹ crore ranking and the
// heatmap are unaffected; they don't have this divide-by-small-number problem).
const RANK_MIN_AUC_CR = 100;

function rankedRows(rows, rankBy, { ascending = false } = {}) {
  const valueOf = rankBy === "pct" ? (r) => flowShare(r.equityNetInvestmentCr, r.openingAucCr) ?? 0 : (r) => r.equityNetInvestmentCr;
  const filtered = rankBy === "pct" ? rows.filter((r) => (r.openingAucCr ?? 0) >= RANK_MIN_AUC_CR) : rows;
  return [...filtered].sort((a, b) => (ascending ? valueOf(a) - valueOf(b) : valueOf(b) - valueOf(a))).slice(0, 5);
}

export function Overview({ reports, selected, flows, before, previous, onSelectSector }) {
  const [query, setQuery] = useState("");
  const [rankBy, setRankBy] = useState("cr");
  const report = reports.find((r) => r.report_date === selected);
  const total = report?.totalNet ?? sum(flows);
  const prevTotal = previous?.totalNet ?? sum(before);
  const positive = flows.filter((f) => f.equityNetInvestmentCr > 0);
  const negative = flows.filter((f) => f.equityNetInvestmentCr < 0);
  const flat = flows.filter((f) => f.equityNetInvestmentCr === 0);
  const positiveTotal = positive.reduce((s, f) => s + f.equityNetInvestmentCr, 0);
  const negativeTotal = negative.reduce((s, f) => s + Math.abs(f.equityNetInvestmentCr), 0);
  const topInflowShare = positive[0] && positiveTotal ? (positive[0].equityNetInvestmentCr / positiveTotal) * 100 : null;
  const topOutflow = negative.at(-1);
  const topOutflowShare = topOutflow && negativeTotal ? (Math.abs(topOutflow.equityNetInvestmentCr) / negativeTotal) * 100 : null;

  // A single fortnight can just be noise; look at the last few together to see whether it's
  // part of a run in the same direction or a reversal.
  const windowSize = Math.min(3, reports.length);
  const recentReports = reports.slice(0, windowSize);
  const rollingTotal = recentReports.reduce((s, r) => s + r.totalNet, 0);
  const sustained = windowSize > 1 && recentReports.every((r) => r.totalNet === 0 || Math.sign(r.totalNet) === Math.sign(recentReports[0].totalNet));

  return (
    <>
      <div className="metrics">
        <section className="hero-card">
          <div className="card-label">
            TOTAL NET FLOW <span>₹ crore</span>
          </div>
          <div className="big-number">
            {total < 0 ? "−" : total > 0 ? "+" : ""}₹{number(total)}
            <small>Cr</small>
          </div>
          <div className="hero-caption">{total < 0 ? "More money moved out than in" : total > 0 ? "More money moved in than out" : "Money in and out was balanced"}</div>
          <div className="hero-bottom">
            {previous ? `${total - prevTotal >= 0 ? "↑" : "↓"} ₹${number(total - prevTotal)} Cr ${total >= prevTotal ? "higher" : "lower"} than previous fortnight` : "Add an earlier report to see the change"}
          </div>
        </section>
        <section className="metric-card">
          <div className="card-label">
            MONEY MOVING IN <span className="circle positive">↗</span>
          </div>
          <strong>
            {positive.length}
            <small> / {flows.length} sectors</small>
          </strong>
          <p>Foreign investors added money</p>
          <div className="meter">
            <i style={{ width: `${(positive.length / flows.length) * 100}%` }} />
          </div>
        </section>
        <section className="metric-card">
          <div className="card-label">
            MONEY MOVING OUT <span className="circle negative">↘</span>
          </div>
          <strong>
            {negative.length}
            <small> / {flows.length} sectors</small>
          </strong>
          <p>Foreign investors withdrew money</p>
          <div className="meter red">
            <i style={{ width: `${(negative.length / flows.length) * 100}%` }} />
          </div>
        </section>
      </div>

      {flat.length > 0 && (
        <p className="flat-note">
          {flat.length === 1 ? `${flat[0].sectorName} was flat this fortnight` : `${flat.map((f) => f.sectorName).join(", ")} were flat this fortnight`} — no net change either way, so {flat.length === 1 ? "it isn't" : "they aren't"} counted in "moving in" or "moving out" above ({positive.length} + {negative.length} + {flat.length} flat = {flows.length} sectors).
        </p>
      )}

      <div className="insight">
        <span>✦</span>
        <p>
          <b>This fortnight at a glance.</b> {positive.length > negative.length ? "More sectors received money than lost money." : negative.length > positive.length ? "Outflows were spread across more sectors than inflows." : "The number of sectors with inflows and outflows was equal."}{" "}
          {positive[0] && `${positive[0].sectorName} led inflows, ${Math.round(topInflowShare)}% of all money that moved in.`} {topOutflow && `${topOutflow.sectorName} saw the largest outflow, ${Math.round(topOutflowShare)}% of all money that moved out.`}
        </p>
      </div>

      {windowSize > 1 && (
        <div className="insight">
          <span>⟳</span>
          <p>
            <b>Trend, not just this fortnight.</b> Across the last {windowSize} fortnights ({period(recentReports.at(-1))} through {period(recentReports[0])}), net flow has totalled {signed(rollingTotal)} Cr.{" "}
            {sustained
              ? ` Every one of those fortnights moved the same way — a sustained ${rollingTotal <= 0 ? "outflow" : "inflow"}, not a one-off.`
              : " That's a mix of inflow and outflow fortnights, not a one-directional run."}
            {reports.length < 3 && " Add a few more reports for this to mean more."}
          </p>
        </div>
      )}

      <div className="rank-control">
        <label>
          Rank by
          <select value={rankBy} onChange={(e) => setRankBy(e.target.value)}>
            <option value="cr">₹ crore</option>
            <option value="pct">% of sector AUC</option>
          </select>
        </label>
      </div>
      <div className="two-columns">
        <Ranking
          title="Where money moved in"
          subtitle={rankBy === "pct" ? "Biggest moves relative to sector AUC" : "Largest positive net investments"}
          rows={rankedRows(positive, rankBy)}
          rankBy={rankBy}
          onSelect={onSelectSector}
        />
        <Ranking
          title="Where money moved out"
          subtitle={rankBy === "pct" ? "Biggest moves relative to sector AUC" : "Largest negative net investments"}
          rows={rankedRows(negative, rankBy, { ascending: true })}
          rankBy={rankBy}
          onSelect={onSelectSector}
        />
      </div>

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Every sector, at a glance</h2>
            <p>Tap a sector to explore its history. All amounts in ₹ crore.</p>
          </div>
          <input className="search" aria-label="Search sectors" placeholder="Search a sector…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sector</th>
                <th>Net flow</th>
                <th>% of sector AUC</th>
                <th>Change vs previous</th>
                <th>Direction</th>
              </tr>
            </thead>
            <tbody>
              {flows
                .filter((f) => f.sectorName.toLowerCase().includes(query.toLowerCase()))
                .map((f) => {
                  const b = before.find((b) => b.sectorName === f.sectorName);
                  return (
                    <tr key={f.id}>
                      <td>
                        <button className="text-button" onClick={() => onSelectSector(f.sectorName)}>
                          {f.sectorName} <span>↗</span>
                        </button>
                      </td>
                      <td className={tone(f.equityNetInvestmentCr)}>{signed(f.equityNetInvestmentCr)}</td>
                      <td className={tone(f.equityNetInvestmentCr)}>{pct(flowShare(f.equityNetInvestmentCr, f.openingAucCr))}</td>
                      <td>{b ? signed(f.equityNetInvestmentCr - b.equityNetInvestmentCr) : "—"}</td>
                      <td>
                        <span className="direction">{transition(b?.equityNetInvestmentCr, f.equityNetInvestmentCr)}</span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
