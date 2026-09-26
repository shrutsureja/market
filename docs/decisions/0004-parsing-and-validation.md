# 0004 — How an NSDL page is parsed and validated

Status: Accepted (2026-09-26)

## Context

Input is NSDL's "Fortnightly Sector-wise FII Investment data" page, saved from Chrome. It has
five tables: the sector table (98 columns: 11 investment types — Equity, three Debt types,
Hybrid, five Mutual Fund types, AIF, Total — in INR and USD, for four column groups: previous
AUC, previous net investment, current net investment, current AUC), notes, the top 10 companies
under "Others" in Debt, INR/USD conversion rates, and a classification note. Headers span several
rows with colspans; there are no rowspans.

## Decision

- `readDocument` tokenises the HTML with a small regex tokenizer (no DOM available in Workers)
  and keeps loose text and tables, with each cell's colspan. Scripts, styles, comments and the
  doctype are skipped; `<br>` becomes a space.
- `parseDocument` finds the table containing a "Sectors" header, expands colspans, and takes the
  **direct Equity, INR crore** column of the **last** Net Investment group and the **last** AUC
  group — the current fortnight.
- The report date comes from the last "AUC as on …" header and must equal the end of the last
  Net Investment period.
- Validation: 10–100 unique non-blank sectors, a Grand Total row, and sector sums within
  half a crore per row (plus half for the total) of the Grand Total. Figures are never adjusted.
  Anything that fails raises a `UserError` with a readable message.

## Consequences

- A layout change by NSDL fails loudly instead of importing wrong numbers. Add the new page to
  `fixtures/` and adapt the parser against it.
- Only equity figures are extracted for analytics; everything else is kept verbatim for Excel
  ([0005](0005-equity-only-analytics.md), [0008](0008-excel-built-in-browser.md)).
- Tests pin exact figures from the fixtures (e.g. Sept 15, 2026 total net −14,116 Cr).
