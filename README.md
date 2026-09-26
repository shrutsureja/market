# NSDL FPI Analysis

Turns NSDL's fortnightly "Sector-wise FII Investment data" HTML page into a dashboard of where
foreign portfolio investors (FPIs) are moving money across Indian equity sectors, plus an Excel
download of the full NSDL page. A personal, experimental project for one family's use — not
investment advice. Live at https://fpi.shrutsureja.com.

## Adding a fortnight

Every fortnight, NSDL publishes a new report. Open it in the browser, save the page
(Ctrl+S, "Webpage, HTML only") and upload that `.html` file with **+ Add report**. A fortnight
can't be imported twice; re-uploading one saved before full pages were kept fills in its Excel.

## How it's built

One Cloudflare Worker serves the React app and a small JSON API, backed by one D1 (SQLite)
database. Plain JavaScript throughout; no login.

```
src/worker.js         routes: static assets + /api/*
src/parser.js         reads the NSDL page, extracts and validates sector equity flows
src/db.js             D1 queries: reports, flows, import, duplicate/re-upload handling
migrations/           D1 schema, append-only
web/src/              React (Vite): App.jsx, views/, components/, hooks/, lib/
web/src/lib/xlsx.js   builds the Excel download in the browser
fixtures/             real NSDL reports used by tests
docs/                 decisions, rules, deployment runbook
```

API: `GET /api/reports`, `GET /api/flows[/latest]`, `POST /api/reports/import` (multipart
`file`), `GET /api/reports/:id/export` (data the browser turns into the Excel file).

## Documentation

- [docs/decisions/](docs/decisions/README.md) — every architecture and analysis decision, and why
- [docs/rules.md](docs/rules.md) — rules for development, data correctness, UI, docs and git
- [docs/deployment.md](docs/deployment.md) — local setup, deploying, migrations, rollback
- [CLAUDE.md](CLAUDE.md) — orientation for AI assistants working in this repo

## Quick start

Node.js 20+:

```sh
npm install && npm --prefix web install
npm run db:migrate:local
npm run dev                  # builds the frontend, serves everything on :8787
npm test                     # parser, API contract and Excel tests
```

Full details, including frontend hot-reload and deploying, are in
[docs/deployment.md](docs/deployment.md).
