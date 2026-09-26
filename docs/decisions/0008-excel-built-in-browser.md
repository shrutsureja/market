# 0008 — Excel reproduces the NSDL page and is built in the browser

Status: Accepted (2026-09-26)

## Context

The owner originally got a spreadsheet by having ChatGPT convert the saved HTML page, and wants
the download to contain the same data as that page. The first export had only the 24 equity
rows. Building a styled workbook of the full page (~2,700 cells) took ~10 ms warm and ~29 ms
cold on a laptop — at or over the Workers free plan's ~10 ms CPU limit, which would fail some
downloads in production (and can't be seen locally, where there is no limit).

## Decision

- The workbook has three sheets:
  - **Sector data**: the page title and the full 98-column sector table, header rows merged as
    on the page, numbers stored as numbers.
  - **Notes & other tables**: everything after the sector table (notes, top 10 companies,
    conversion rates), on its own sheet so column widths fit it.
  - **Equity summary**: the normalised 24-row equity sheet.
- Group headers are left-aligned so labels spanning 12–24 columns are visible where the group
  starts; column widths are fitted to content per sheet.
- The Worker only returns data (`GET /api/reports/:id/export`). The browser builds the file with
  `xlsx-js-style` (`web/src/lib/xlsx.js`), loaded on the first click.
- Fortnights imported before full pages were stored get a one-line note sheet asking for a
  re-upload ([0003](0003-store-parsed-page-not-html.md)).

## Consequences

- Downloads can't hit the Worker's CPU limit.
- The first download fetches ~320 KB (gzipped) of spreadsheet library; the dashboard itself
  doesn't get heavier.
- Workbooks are rebuilt on every download from stored data; nothing is cached or stored.
- Tests compare the Excel output against the HTML cell by cell (`web/src/lib/xlsx.test.mjs`).
- The library in use can't freeze panes.
