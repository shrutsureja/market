export const number = (n) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.abs(n));
export const signed = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${number(n)}`;
export const date = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const period = (r) => (r ? `${Number(r.period_start.slice(8))}–${date(r.period_end)}, ${r.report_date.slice(0, 4)}` : "Choose a period");
export const sum = (rows) => rows.reduce((s, r) => s + r.equityNetInvestmentCr, 0);
export const tone = (n) => (n > 0 ? "positive" : n < 0 ? "negative" : "neutral");
export const transition = (a, b) =>
  a == null ? "No earlier report" : a === 0 || b === 0 ? "Includes a flat period" : a > 0 && b > 0 ? "Continued inflow" : a < 0 && b < 0 ? "Continued outflow" : b > 0 ? "Turned to inflow" : "Turned to outflow";

// Net investment as a share of the sector's own holdings (AUC) — how big a rotation this is
// for that sector, not just in absolute crore. AUC already includes this period's flow, so
// this is a same-period ratio, not a return; still the standard way to size a flow.
export const flowShare = (net, auc) => (auc ? (net / auc) * 100 : null);
export const pct = (v) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`);
