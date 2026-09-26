import { period } from "../lib/format.js";
import { downloadExcel } from "../api.js";

export function Toolbar({ reports, selected, setSelected, report }) {
  return (
    <div className="toolbar">
      <label>
        Reporting period
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {reports.map((r) => (
            <option key={r.id} value={r.report_date}>
              {period(r)}
              {r === reports[0] ? " · Latest" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="toolbar-right">
        <span className="badge">FPI · Equity</span>
        <button type="button" className="export" onClick={() => downloadExcel(report.id).catch((e) => alert(e.message))}>
          ↓ Download Excel
        </button>
      </div>
    </div>
  );
}
