import { date, number, period, signed, tone } from "../lib/format.js";

export function ComparePeriods({ reports, selected, compare, setCompare, differences, onSelectSector }) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h2>Selected period vs an earlier snapshot</h2>
          <p>Change = selected fortnight minus comparison fortnight. All values in ₹ crore.</p>
        </div>
        <label>
          Compare with
          <select value={compare} onChange={(e) => setCompare(e.target.value)}>
            {reports.map((r) => (
              <option key={r.id} value={r.report_date}>
                {period(r)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selected === compare && <p className="notice">Choose two different periods to see what changed.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sector</th>
              <th>{date(compare)} flow</th>
              <th>{date(selected)} flow</th>
              <th>Change</th>
              <th>AUC then → now</th>
            </tr>
          </thead>
          <tbody>
            {differences.map((f) => (
              <tr key={f.id}>
                <td>
                  <button className="text-button" onClick={() => onSelectSector(f.sectorName)}>
                    {f.sectorName}
                  </button>
                </td>
                <td>{f.old ? signed(f.old.equityNetInvestmentCr) : "—"}</td>
                <td>{signed(f.equityNetInvestmentCr)}</td>
                <td className={tone(f.delta)}>{f.delta == null ? "—" : signed(f.delta)}</td>
                <td>
                  {f.old ? number(f.old.equityAucCr) : "—"} → {number(f.equityAucCr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
