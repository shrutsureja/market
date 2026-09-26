# 0003 — Store the parsed page, not the HTML file

Status: Accepted (2026-09-26)

## Context

The first version kept every uploaded HTML file in R2. R2 wasn't enabled on the account, and
keeping raw files wasn't needed for the dashboard. Later, the Excel export needed the whole NSDL
page (all tables and notes), not just the equity figures.

## Decision

- No R2. The unused `fpi-market-raw` bucket was deleted.
- On import, the parser reads the whole page into blocks (loose text and tables, each cell with
  its colspan) and stores them as JSON in `reports.source_doc` (migration 0002). That's about
  66 KB per fortnight. The equity figures go into `reports` and `flows` as before.
- A fortnight can only be imported once (unique report date and file hash). Re-uploading a
  fortnight that has no `source_doc` (imported before 0002) fills it in, but only if the file's
  equity figures exactly match the stored ones. Otherwise it's refused, so the Excel sheet and
  the dashboard can never disagree about the same fortnight.

## Consequences

- Everything the Excel needs is in D1; no second storage service.
- The original HTML bytes aren't kept, so a future parser can't re-read an old upload; the file
  has to be uploaded again.
- If NSDL republishes corrected figures for a fortnight, there's no update path yet: the new file
  is refused as a duplicate. That would need its own decision.
- `listReports` names its columns so `source_doc` isn't sent with every page load.
