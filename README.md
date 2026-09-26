# Flowfolio — FPI sector flow dashboard

Turns NSDL's fortnightly "Sector-wise FII Investment data" HTML report into a normalized Excel
workbook and a small dashboard: overall flow, a sector heatmap, per-sector history, and
period-over-period comparison. Built for personal use (family, not the public) — no login,
free-tier Cloudflare hosting.

## How you get new data in

Every fortnight, NSDL publishes a new report. Open it in the browser, save the page
(Ctrl+S, "Webpage, HTML only"), and upload that `.html` file with the **+ Add report** button.
The same date can't be imported twice.

## Architecture

One Cloudflare Worker (`src/worker.js`) serves the built React app and a small JSON/XLSX API,
backed by one D1 (SQLite) database. Everything is plain JavaScript — no Python, no Go, no
Pyodide, no Cloudflare Access. There's no server to keep running: it only does work when
someone opens the page or uploads a report.

```
src/worker.js    fetch handler: static assets + API routes
src/parser.js    parses the NSDL HTML table into sectors/net-investment/AUC
src/db.js        D1 queries (reports, flows, import + duplicate detection)
src/xlsx.js      builds the downloadable workbook
migrations/      D1 schema
web/             React (Vite) frontend — web/src/App.jsx plus one file per view
fixtures/        real NSDL reports, used by tests
```

API: `GET /api/reports`, `GET /api/flows[/latest]`, `POST /api/reports/import` (multipart
`file`), `GET /export/:id` (XLSX download).

## Local development

Install [Node.js](https://nodejs.org) 20+, then:

```sh
npm install
npm --prefix web install
npm run db:migrate:local          # creates the local D1 database from migrations/
npx wrangler dev                  # serves the API + last-built frontend on :8787
```

For frontend hot-reload, in a second terminal:

```sh
npm --prefix web run dev          # Vite on :5173, proxies /api and /export to :8787
```

## Tests

```sh
npm test          # parser + API-contract tests (node:test), against fixtures/
npm run test:web  # frontend unit tests
npm run build     # production frontend build
```

## Deploying (Cloudflare Workers, free tier)

You need a Cloudflare account and the `wrangler` CLI (already a dependency). Log in once:

```sh
npx wrangler login
```

Then, one-time setup:

```sh
npx wrangler d1 create fpi-market
```

Copy the `database_id` it prints into `wrangler.jsonc` (`d1_databases[0].database_id`),
then:

```sh
npm run db:migrate:remote
npm run deploy
```

That deploys to `https://fpi-market.<your-subdomain>.workers.dev` — Wrangler prints the exact
URL. No DNS setup, no custom domain, no paid plan required. There is no login screen: anyone
with the link can view the dashboard and upload reports, so don't share the URL beyond your
family. If you outgrow that later, Cloudflare Access can be layered on in front without
changing this app.

To redeploy after future changes, `npm run deploy` again. Schema changes go in a new file
under `migrations/` (e.g. `0002_*.sql`) — never edit `0001_initial.sql` after it's been
applied anywhere — followed by `db:migrate:remote`.

## Import semantics

An accepted report requires a report date, a matching reporting period, a sector table, direct
equity net-investment and AUC columns, finite numeric rows, and a source grand total. Reported
crore values are whole numbers; a half-crore rounding tolerance per sector (plus one for the
total) is allowed against the source's own Grand Total row. Sector values are never adjusted to
force equality with it. Duplicate report dates (or byte-identical uploads) are rejected with a
friendly error instead of a duplicate row.
