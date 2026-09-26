# CLAUDE.md

Orientation for AI assistants (Claude or otherwise) working in this repo. Read this first, then
the files it points to. The repo is public: never add secrets, tokens or personal data.

## What this is

NSDL FPI Analysis: a Cloudflare Worker + D1 app that imports NSDL's fortnightly "Sector-wise FII
Investment data" HTML page, shows where foreign investors moved money across Indian equity
sectors, and exports the full NSDL page to Excel. Used by one family, mostly on phones, by
people without a finance background — clarity beats density of features. Live at
https://fpi.shrutsureja.com. Not investment advice.

## Read before changing anything

1. [docs/decisions/](docs/decisions/README.md) — why things are the way they are. Don't undo a
   recorded decision without saying so; record new ones as a new ADR.
2. [docs/rules.md](docs/rules.md) — the rules below, in full.
3. [docs/deployment.md](docs/deployment.md) — how to run, migrate and deploy.

## Map

```
src/worker.js         Worker routes (static assets, /api/*)
src/parser.js         readDocument (whole page as blocks) + parseDocument (sector equity flows)
src/db.js             D1 access; importReport handles duplicates and re-upload backfill
src/errors.js         UserError = message safe to show the user (400); anything else is a 503
migrations/           append-only D1 schema
web/src/App.jsx       top-level state and derived data
web/src/views/        one file per screen (Overview, SectorHeatmap, SectorDetail, ...)
web/src/components/   shared pieces (Ranking, FlowChart, Header, ...)
web/src/lib/          format.js (numbers/%), flows.js (opening AUC), xlsx.js (Excel builder)
fixtures/             real NSDL pages; tests depend on their exact figures
```

## Commands

```sh
npm install && npm --prefix web install
npm run db:migrate:local      # local D1
npm run dev                   # build frontend + wrangler dev on :8787
npm --prefix web run dev      # optional: Vite hot reload on :5173 (proxies /api to :8787)
npm test                      # all tests (root discovers web tests too)
npm run build                 # production frontend build
```

## Key rules (full list in docs/rules.md)

- **No deploys, commits or pushes without the owner's explicit go-ahead.** Show changes locally first.
- **Schema changes are new migration files**, never edits to applied ones, and are applied to the
  remote database *before* deploying code that needs them.
- **Every figure must trace back to the NSDL page.** Never adjust, round or "fix" source numbers;
  the parser rejects reports that don't reconcile with their own Grand Total.
- **% of AUC uses the opening AUC** (previous fortnight's closing AUC), not the closing AUC.
- **Worker requests must stay light** — the free plan allows ~10 ms CPU. Heavy work (like building
  Excel files) runs in the browser.
- **Verify UI changes in a real browser at desktop and phone widths**, not just with tests.
- **Keep files small and single-purpose**: one view per file, shared logic in `web/src/lib/`.
- **Errors meant for the user are `UserError`**; everything else must not leak details.
- **Commit as the owner's personal GitHub identity (`shrutsureja`)**, never a work identity.

## Glossary

- **FPI** — foreign portfolio investor (the report calls them FII).
- **Net flow / net investment** — money in minus money out for a fortnight, ₹ crore.
- **AUC** — market value of FPI holdings at a date. Changes with flows *and* share prices, so a
  fortnight's AUC change is not its net flow.
- **Opening AUC** — AUC at the start of the fortnight (the previous report's closing AUC).
- **Fortnight / report** — one NSDL page: the 1st–15th or 16th–end of a month.
