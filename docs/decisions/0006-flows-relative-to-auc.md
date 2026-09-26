# 0006 — Measure flows against opening AUC

Status: Accepted (2026-09-26). Amended by [0011](0011-opening-auc-from-page.md): opening AUC now comes from the NSDL page.

## Context

Absolute crore figures favour big sectors: Financial Services' −6,204 Cr (Sept 15, 2026) was
only −0.29% of what FPIs held there, while Utilities' +194 Cr was over +7%. The first version of
"% of AUC" divided by the fortnight's closing AUC, which already includes that fortnight's flow
and price moves.

## Decision

- "% of AUC" = net flow ÷ **opening AUC**, i.e. the same sector's AUC in the previous report
  (`web/src/lib/flows.js`). A sector's first report has no previous one and falls back to its
  own closing AUC.
- It's shown next to every flow: rankings, the sector table, sector detail, heatmap, tooltips.
- Top movers can be ranked by ₹ crore or by % of AUC. The % ranking leaves out sectors with less
  than ₹100 Cr of AUC, where a tiny base turns small amounts into huge percentages.
- The Overview also shows how concentrated flows were (the top sector's share of all money in
  or out), sectors with exactly zero flow (so the in/out counts add up), and a rolling
  three-fortnight trend to separate noise from a run.

## Consequences

- As first built, the oldest fortnight fell back to its own closing AUC and a missing fortnight
  made the base two fortnights old. Both are fixed by [0011](0011-opening-auc-from-page.md).
- AUC changes are flows plus price movement. The UI and explainer text must never present an
  AUC change as money moved.
