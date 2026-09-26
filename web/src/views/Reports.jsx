import { period } from "../lib/format.js";
import { exportUrl } from "../api.js";

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
            <small>{r.filename}</small>
          </div>
          <span className="badge">Imported</span>
          <a className="export" href={exportUrl(r.id)}>
            ↓ Excel
          </a>
        </div>
      ))}
    </section>
  );
}
