# Cloudflare deployment plan

Status: proposed; no cloud resources have been created and nothing has been deployed.
Documentation checked on 25 September 2026.

## Recommended setup

Keep Python and React. Use one Cloudflare Worker application with the built React assets, a Python API, a D1 database, and a private R2 bucket. Protect the entire application with Cloudflare Access so only the family’s approved email addresses can use it.

| Current local component | Cloudflare destination |
| --- | --- |
| React/Vite frontend in `web/` | Worker Static Assets, built from `web/dist/` |
| Python WSGI server in `app.py` | Python Worker request handler |
| `data/market.db` | D1 database, accessed through a binding |
| `data/raw/` HTML uploads | Private R2 bucket, accessed through a binding |
| Unauthenticated localhost access | Cloudflare Access on the application hostname |

This avoids a second hosting provider or a server to maintain. The Python Worker and Excel library must pass a compatibility test first. Cloudflare supports Python through its Workers runtime, but that does not make the current WSGI server deployable unchanged. See [Python Workers](https://developers.cloudflare.com/workers/languages/python/) and [supported Python packages](https://developers.cloudflare.com/workers/languages/python/packages/).

Workers can serve the frontend build alongside application code. D1 provides SQLite semantics through its API; it is not a persistent local `.db` file. R2 provides persistent object storage. See [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [D1](https://developers.cloudflare.com/d1/), and [storage options](https://developers.cloudflare.com/workers/platform/storage-options/).

## 1. Prove runtime compatibility locally

- Create a Python Worker using Cloudflare’s documented `pywrangler` workflow; pin its Python dependencies and compatibility date.
- Extract the parser from `app.py` into a reusable module without server, database, or filesystem imports. Run all three fixtures through the Worker runtime.
- Test `openpyxl`, including its dependencies, by generating an XLSX in memory and reading it back locally. Verify the 24 sector rows, cell types, dates, and financial values.
- Exercise multipart upload parsing with the Worker request API. Replace `cgi.FieldStorage` and `wsgiref`; do not try to start a listening server inside a Worker. The existing local application currently requires Python 3.12 because `cgi` was removed in Python 3.13.
- Measure import and export runtime and memory using the real reports. Compare with the selected Workers plan’s current limits before choosing it.

Gate: do not deploy the frontend alone and call it a working app. If the Python/XLSX compatibility test fails, resolve that blocker before proceeding. No Go rewrite is needed.

## 2. Adapt persistence and API routing

- Preserve the existing `/api/reports`, `/api/flows`, `/api/flows/latest`, `/api/reports/import`, and `/export/:id` contracts.
- Replace local `sqlite3` operations with parameterized D1 binding calls. Use a transactional D1 batch for the accepted report and all sector rows, and enforce uniqueness in the database to handle simultaneous duplicate uploads.
- Add checked-in schema migrations. Keep report IDs, date ranges, source hash, parser version, source grand totals, import status/error, and timestamps. Retain unique report-date/source constraints and unique `(report_id, sector)` rows. Add a separate import-attempt record for failed and duplicate uploads.
- Store raw uploads in R2 before parsing, using a hash-based object key. Failed validation must retain the object and diagnostics, but create no accepted sector rows. Keep R2 private; access it only through the Worker.
- R2 and D1 do not share a transaction. Use idempotent object keys, transactional D1 writes, and retryable import attempts. If a database write fails after upload, retain the object for retry and inspection.
- Parse source grand totals once during import and persist them. The current reports endpoint rereads the HTML from disk; replace this with a database read.
- Convert local raw-file paths to R2 keys. Do not return filesystem paths in the cloud API.
- Keep upload size checks, strict numeric validation, duplicate protection, and total reconciliation with documented whole-crore rounding tolerance.
- Use relative frontend requests on the shared origin instead of hard-coded `http://localhost:8000`. Configure a Vite development proxy for `/api` and `/export` so local development still works.
- Serve `/api/*` and `/export/*` through the Python handler and other requests through the static assets binding. Ensure SPA fallback never turns a missing API route into a successful HTML response.
- Generate Excel in memory and return it directly; no server-side export directory is required. Keep the current normalized report export. A faithful original-layout Excel export is separate feature work, not something the current app already supports.

## 3. Prepare a private staging environment

Account prerequisites: a Cloudflare account with Workers, D1 and R2 access; a hostname/domain choice; approved family email addresses; and agreement to any applicable account or billing requirements. Do not assume every service is free—check current pricing and configure usage notifications before enabling uploads.

Create staging resources first: one Worker, one D1 database and one private R2 bucket. Record identifiers in the Worker configuration; keep credentials in Cloudflare secrets or CI secrets, never in React build variables or Git.

Add Cloudflare Access to the full staging hostname, covering the dashboard, API, and downloads. Test an allowed email and an unapproved email. Prevent bypass through default `workers.dev`, preview URLs, or any alternate route: disable them or protect them too. Do not rely on hiding the upload button. See [Access web applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/).

Future build/deploy sequence, after the Worker adapter and configuration exist:

```sh
python3 -m unittest -v test_app.py
npm --prefix web ci
npm --prefix web run build
# From the planned Python Worker project, with pywrangler installed/configured:
uv run pywrangler deploy --env staging
```

These are planning instructions, not commands supported by the repository yet. Add the Worker project, environment bindings, asset directory, secrets, migrations and a repeatable deployment script during implementation. The current repository has no deployable Worker configuration.

## 4. Move the existing reports

Back up local SQLite and raw HTML first. For these three reports, the simplest migration is to upload the original HTML files through the protected staging app. This revalidates the data and avoids copying absolute local paths or earlier incorrectly parsed records.

Expected published equity net totals:

| Report date | NSDL grand total, ₹ crore | Sum of displayed sector values, ₹ crore |
| --- | ---: | ---: |
| 15 Aug 2026 | 16,621 | 16,618 |
| 31 Aug 2026 | 13,010 | 13,010 |
| 15 Sep 2026 | -14,116 | -14,116 |

The August 15 difference is within the rounding tolerance for individually rounded source rows. Show source totals as source totals; do not adjust sector values to force equality. Each report has 24 sectors. Verify September’s 48 equity flow/AUC values against the provided workbook again after migration.

## 5. Release checks and production deployment

- Authorized users can browse; unauthorized users cannot reach any page, API or export.
- The overview, period selector, heatmap, sector history, comparison and Excel download work on desktop and a phone.
- Duplicate, malformed, missing-column and invalid-total uploads fail clearly and preserve raw input without partial normalized rows.
- Reloading or redeploying does not lose reports or uploaded objects.
- Excel contains the selected report’s 24 sectors and correct numeric values.
- No browser requests point to localhost; no secrets or SQLite backups are in the frontend bundle.
- Record the tested Git commit, dependency locks and migration version. Pin dependencies before enabling automated cloud deployment; the frontend manifest currently uses `latest` ranges, although the lockfile fixes `npm ci` installs.

After staging passes, create separate production D1/R2 resources and Access rules, deploy the tested version, and import the same source reports. Connect GitHub deployment only after the initial manual release works. Keep production deployment explicit rather than deploying every branch; give previews their own data and access controls.

## 6. Backup and rollback

Keep source HTML recoverable and retain periodic D1 exports in private storage. Take a database backup before schema changes. Record each application release so a previous Worker version can be restored. Code rollback does not undo database migrations: use additive migrations, verify old-code compatibility, and restore data separately only if required. Test recovery into staging before relying on it.

## Current scope and next implementation task

This commit is a local MVP plus this plan. Cloudflare deployment requires the Python runtime adapter, D1/R2 persistence, shared-origin frontend routing, Access setup, and staging validation above. The old Go prototype under `cmd/` and `internal/` is not part of the running application or cloud design; `internal/sources/nsdl/testdata/` still contains the Python test fixtures. Remove obsolete Go code and relocate fixtures in a separate cleanup when preparing the Worker port.
