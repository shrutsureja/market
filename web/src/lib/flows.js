// Net flow as a % of AUC should be measured against the base you started the fortnight with,
// not the closing AUC (which already includes this period's own flow and price moves). This
// annotates each flow row with the prior period's closing AUC for the same sector, so "% of
// AUC" everywhere else can use a proper opening balance. A sector's first-ever appearance has
// no prior period, so it falls back to its own closing AUC for that one report only.
export function withOpeningAuc(flows) {
  const sorted = [...flows].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const lastAucBySector = new Map();
  const openingById = new Map();
  for (const f of sorted) {
    openingById.set(f.id, lastAucBySector.get(f.sectorName) ?? f.equityAucCr);
    lastAucBySector.set(f.sectorName, f.equityAucCr);
  }
  return flows.map((f) => ({ ...f, openingAucCr: openingById.get(f.id) }));
}
