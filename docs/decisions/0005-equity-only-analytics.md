# 0005 — Analytics cover equity only

Status: Accepted (2026-09-26)

## Context

The NSDL page has figures for 11 investment types per sector. A review considered adding Debt,
Hybrid, Mutual Fund and AIF flows to the dashboard. Debt flows follow different drivers (rate
differentials, RBI policy, bond index inclusion) and are normally read as a national total, not
per sector. In the real data, Hybrid, Mutual Fund and AIF were near zero for most sectors.

## Decision

The owner chose equity only. The dashboard, rankings, heatmap and sector detail use direct
equity net investment and equity AUC. Other investment types appear only in the Excel export,
which reproduces the full page.

## Consequences

- One asset class keeps the screens simple for non-expert users.
- Anyone who wants debt analysis has the raw figures in Excel.
- The data is FPI-only; DII (domestic institutional) flows aren't in this source at all. FPI
  selling on its own doesn't mean the market fell.
