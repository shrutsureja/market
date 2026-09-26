// Net flow as a % of AUC is measured against the AUC the fortnight started with, not the closing
// AUC (which already includes the fortnight's own flow and price moves). The opening AUC printed
// on the NSDL page is used when the report has it; reports imported before that was stored fall
// back to the previous report's closing AUC, and a sector's first report to its own closing AUC.
export function withOpeningAuc(flows) {
  const sorted = [...flows].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const lastAucBySector = new Map();
  const openingById = new Map();
  for (const f of sorted) {
    openingById.set(f.id, f.openingAucCr ?? lastAucBySector.get(f.sectorName) ?? f.equityAucCr);
    lastAucBySector.set(f.sectorName, f.equityAucCr);
  }
  return flows.map((f) => ({ ...f, openingAucCr: openingById.get(f.id) }));
}
