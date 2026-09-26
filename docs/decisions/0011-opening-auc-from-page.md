# 0011 — Read opening AUC from the NSDL page

Status: Accepted (2026-09-26). Amends [0006](0006-flows-relative-to-auc.md).

## Context

[0006](0006-flows-relative-to-auc.md) took each fortnight's opening AUC from the previous
report on the site. That fails in two cases: the oldest report has no previous one (it fell back
to its own closing AUC, e.g. 15 Jul 2026), and a skipped fortnight makes the base a month old.
Each NSDL page already prints the opening figure: its first column group is "AUC as on
[previous fortnight]".

## Decision

- The parser reads each sector's opening AUC from the first AUC group (direct Equity, INR crore),
  checks that group's date is before the report date, and validates the column against the
  page's Grand Total like the other figures.
- It's stored in `flows.opening_auc` (migration 0003) and returned by `/api/flows`.
- `web/src/lib/flows.js` uses it when present; otherwise it falls back as before (previous
  report's closing AUC, then the sector's own closing AUC).
- Re-uploading a fortnight that lacks it (or lacks `source_doc`) fills both in, under the same
  figures-must-match rule as [0003](0003-store-parsed-page-not-html.md).

## Consequences

- Every fortnight's % of AUC uses the figure NSDL published, including the first one and any
  after a gap.
- Tests check that each fixture's opening AUC equals the previous fixture's closing AUC for every
  sector, which also guards the parser's column choice.
- Reports imported before migration 0003 keep the fallback until their HTML is uploaded again.
