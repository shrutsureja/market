import { period } from "../lib/format.js";
import { downloadExcel } from "../api.js";

export function Reports({ reports }) {
  return (
    <section className="panel">
      <h2>Your saved fortnights</h2>
      <p>Add a new HTML report every fortnight. Existing dates are protected from duplicate imports.</p>
      {reports.map((r) => (
        <div className="report-row" key={r.id}>
          <span className="document-icon">▤</span>
          <div>
            <b>{period(r)}</b>
            <small>{r.hasSource ? r.filename : "Upload this fortnight's HTML again to include the full NSDL table in its Excel"}</small>
          </div>
          <span className="badge">{r.hasSource ? "Full table" : "Summary only"}</span>
          <button type="button" className="export" onClick={() => downloadExcel(r.id).catch((e) => alert(e.message))}>
            ↓ Excel
          </button>
        </div>
      ))}
    </section>
  );
}
