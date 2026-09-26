import { date, flowShare, number, pct, signed, sum, tone } from "../lib/format.js";
import { FlowChart } from "../components/FlowChart.jsx";

export function SectorDetail({ reports, sector, setSector, sectors, currentFlow, history }) {
  return (
    <>
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>A closer look</h2>
            <p>History across all {reports.length} available reporting periods.</p>
          </div>
          <select aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value)}>
            {sectors.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <h2 className="sector-title">{sector}</h2>
        <div className="detail-metrics">
          <div>
            <small>Selected period · Net flow</small>
            <strong className={tone(currentFlow?.equityNetInvestmentCr || 0)}>{signed(currentFlow?.equityNetInvestmentCr || 0)} Cr</strong>
          </div>
          <div>
            <small>Selected period · As % of AUC</small>
            <strong className={tone(currentFlow?.equityNetInvestmentCr || 0)}>{pct(currentFlow && flowShare(currentFlow.equityNetInvestmentCr, currentFlow.openingAucCr))}</strong>
          </div>
          <div>
            <small>Cumulative · {history.length} available periods</small>
            <strong>{signed(sum(history))} Cr</strong>
          </div>
          <div>
            <small>Periods with inflows</small>
            <strong>
              {history.filter((f) => f.equityNetInvestmentCr > 0).length} / {history.length}
            </strong>
          </div>
        </div>
      </section>
      <div className="two-columns">
        <section className="panel">
          <h2>Money in and money out</h2>
          <p>Fortnightly net investment · ₹ crore</p>
          <FlowChart rows={history} field="equityNetInvestmentCr" colorBySign />
        </section>
        <section className="panel">
          <h2>Holdings at period end</h2>
          <p>Equity AUC · ₹ crore · includes market-price effects</p>
          <FlowChart rows={history} field="equityAucCr" />
        </section>
      </div>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Report ending</th>
              <th>Net investment · Cr</th>
              <th>% of AUC</th>
              <th>Equity AUC · Cr</th>
            </tr>
          </thead>
          <tbody>
            {history.map((f) => (
              <tr key={f.id}>
                <td>
                  {date(f.reportDate)} {f.reportDate.slice(0, 4)}
                </td>
                <td className={tone(f.equityNetInvestmentCr)}>{signed(f.equityNetInvestmentCr)}</td>
                <td className={tone(f.equityNetInvestmentCr)}>{pct(flowShare(f.equityNetInvestmentCr, f.openingAucCr))}</td>
                <td>{number(f.equityAucCr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
