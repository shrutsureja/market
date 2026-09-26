import { flowShare, pct, signed, tone } from "../lib/format.js";

export function Ranking({ title, subtitle, rows, onSelect, rankBy = "cr" }) {
  const share = (r) => flowShare(r.equityNetInvestmentCr, r.openingAucCr);
  const metric = (r) => (rankBy === "pct" ? Math.abs(share(r)) || 0 : Math.abs(r.equityNetInvestmentCr));
  const max = Math.max(...rows.map(metric), 1);
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>
        {subtitle} <span className="unit">{rankBy === "pct" ? "% of sector AUC" : "₹ crore"}</span>
      </p>
      {!rows.length ? (
        <p>No sectors in this direction.</p>
      ) : (
        rows.map((r, i) => (
          <button className="ranking-row" key={r.id} onClick={() => onSelect(r.sectorName)}>
            <span className="rank-number">{String(i + 1).padStart(2, "0")}</span>
            <span className="rank-body">
              <span className="rank-line">
                <b>{r.sectorName}</b>
                <strong className={tone(r.equityNetInvestmentCr)}>
                  {rankBy === "pct" ? pct(share(r)) : signed(r.equityNetInvestmentCr)} <span>↗</span>
                </strong>
              </span>
              <span className={`rank-track ${tone(r.equityNetInvestmentCr)}`}>
                <i style={{ width: `${(metric(r) / max) * 100}%` }} />
              </span>
              <small className="rank-detail">{rankBy === "pct" ? `${signed(r.equityNetInvestmentCr)} Cr` : `${pct(share(r))} of that sector's AUC`}</small>
            </span>
          </button>
        ))
      )}
    </section>
  );
}
