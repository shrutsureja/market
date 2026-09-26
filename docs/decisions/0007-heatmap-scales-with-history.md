# 0007 — Heatmap: time window and colour basis

Status: Accepted (2026-09-26)

## Context

The sector heatmap has one column per fortnight. After a few years that's 50–80 columns, with
the latest fortnight pushed furthest right. Colouring by absolute crore also repeats the size
bias [0006](0006-flows-relative-to-auc.md) addresses.

## Decision

- A "Show" control limits columns to the last 3 months, 6 months (default), 1 year, 2 years or
  all time. The Cumulative column sums only what's shown.
- A "Color by" control switches between % of sector AUC (default) and ₹ crore; each cell shows
  both numbers, primary first.

## Consequences

- The latest fortnight stays in view however much history accumulates.
- The two colour modes can highlight different sectors; that's intended, not a bug.
- The rest of the app loads all flows at once; that's fine at ~624 rows a year, and pagination
  isn't needed at any realistic size.
