# Cloudflare deployment and release record

## Current status — 25 September 2026

Implementation and local verification are available. **Production has not been deployed.** No Cloudflare Tunnel, frontend-only stub, DNS record, or public upload endpoint was created.

Requested URL: `https://fpi.shrutsureja.com` (DNS lookup currently fails).

Existing account: `552fb83dc41d7e9a61b0be7bc97471ea`.
Existing zone: `0a6b6d8f01dad87929e79e597a150837` (`shrutsureja.com`).

Live API attempts using the supplied credential returned:

| Operation | Result |
| --- | --- |
| List/create D1 database `fpi-market` | HTTP 401, code 10000, authentication error |
| List/create R2 bucket `fpi-market-raw` | HTTP 403, code 10042, enable R2 in the dashboard |
| Read Access organization | HTTP 403, code 10000 |
| List Access identity providers | Success, empty list |
| List Access applications | Success, empty list |
| Create deny-all `fpi-market` Access application | HTTP 403, code 1010, `auth.forbidden` |
| Read account owner through `/user` or account members | HTTP 403 |

The account display name suggests `Shrutsureja.code@gmail.com`; that is **not a verified owner identity**. Obtain confirmation before provisioning its allow policy. No new resource IDs or deployment version IDs exist. Zero UUIDs in `wrangler.jsonc` are deliberately non-deployable placeholders, not real resources.

Required account work: enable R2; authorize account D1 Edit, Workers Scripts Edit, R2 Edit, Access Apps and Policies Edit, Access Organizations/Identity Providers Read, and zone/DNS access for this domain; complete existing Zero Trust login-provider setup; confirm the owner email. The scripts never change a billing plan or enroll an identity provider automatically. Review the Workers plan and usage notifications in the dashboard before enabling imports.

Production import/export, owner login, unauthorized-email login, remote migration, remote persistence, R2 privacy and persistence after **production redeploy** remain unverified. Local-runtime restart tests are not evidence of a production redeploy.

## Architecture and contracts

One Python Worker serves the React build and these unchanged API contracts:

- `GET /api/reports`: report records in descending date order, including persisted `totalNet`.
- `GET /api/flows` and `/api/flows/latest`: `id`, `sectorName`, `equityNetInvestmentCr`, `equityAucCr`, `reportDate`, `periodStart`, `periodEnd`.
- `POST /api/reports/import`: multipart `file`; 201 with `id`, `reportDate`, `sectorCount`, or 400 with `error` for invalid/duplicate input.
- `GET /export/:id`: normalized XLSX, 24 sectors for each fixture. Missing API/export routes return JSON 404, never SPA HTML.

Cloud `raw_path` is an R2 key, not a local filesystem path. Internal failures return 503 with a retry message. Auth denial is 403 at the Worker; Access may intercept earlier with its login redirect. Same-origin write checks reject cross-origin browser uploads.

`cloud/fpi/core.py` contains the portable parser and Excel generator. `cloud/fpi/store.py` uses bound parameters and a D1 transaction for report, sector rows and accepted-attempt status. `migrations/0001_initial.sql` preserves report date/period, source hash, parser version, source totals, status/error and timestamps, plus separate import attempts.

Raw objects use `raw/<sha256>.html`. Accepted, malformed and duplicate uploads retain source bytes; identical bytes reuse the object. Oversized requests are rejected before storage. R2/D1 are not a distributed transaction: a D1 outage can leave a raw object without an attempt; a failed report batch leaves a pending attempt. Retry the same source after recovery. Retain pending attempts as diagnostics; inspect orphaned objects during maintenance, and do not delete them automatically.

All frontend requests and fonts use the same origin. `assets.run_worker_first=true` gates every asset/page/API/download. `workers_dev=false` and `preview_urls=false` disable alternate public URLs. Worker code independently verifies Access JWT RS256 signatures against the configured team's JWKS, issuer, audience, expiry, issue time and owner email. Missing configuration or failed verification denies access. A supplied email header alone never authorizes a request. No service-token bypass is enabled.

## Toolchain and local gates

Install uv, Node and Chrome. Use `.python-version` (3.12) for the legacy local server. Python Workers run their separate Pyodide runtime. The checked-in locks pin frontend packages, Wrangler 4.139.0, workers-py 1.17.4, the runtime SDK and openpyxl 3.1.5. `pylock.toml` pins the Worker packages. Compatibility date is `2026-09-23`, supported by the pinned workerd binary.

```sh
uv sync --locked
npm ci
npm --prefix web ci
uv run python -m unittest -v test_app
uv run python -m unittest discover -s tests -v
npm --prefix web test
npm --prefix web run build
uv run python -m scripts.test_worker
uv run pywrangler deploy --dry-run
```

The Worker test creates isolated local D1/R2 state, applies the checked-in migration, imports all fixtures, checks every exported financial value, exercises bad totals/missing columns/malformed/oversized/duplicate uploads, checks API 404 and cross-origin rejection, uses Chrome at desktop and phone widths, restarts the Worker and compares IDs/data, retrieves accepted/rejected R2 objects byte-for-byte, queries attempt statuses, and checks anonymous/forged auth denial on pages, assets, APIs and exports.

The dry run packages the complete backend and static build; it does not create resources or deploy. Only `cloud/` and vendored dependencies are bundled, excluding local credentials, databases, test fixtures and Python virtual environments.

Local workerd import wall times were several seconds per 324 KiB fixture, with XLSX exports around 0.1–0.2 seconds after warmup. These are local wall measurements, not production CPU or memory measurements. Do not assume the free plan is sufficient: Cloudflare documents a 10 ms free CPU budget and a default 30-second paid CPU budget. Verify CPU, memory, cold start and account plan on protected staging before releasing; see [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). No paid-plan change has been made.

## Credentials and safe preflight

Never paste tokens into commands, Git or frontend variables. The helper loads `~/.openclaw/credentials/cloudflare.json`, exports `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` inside the process, and runs a child command without printing either secret value. It also respects already exported credentials.

```sh
uv run python -m scripts.deployment preflight
# Example of safely credentialing a Wrangler command:
uv run python scripts/cloudflare.py npx wrangler d1 list
```

Preflight is read-only. It reports all unavailable prerequisites and exits nonzero. Provisioning does no mutations if this preflight fails. Deployment additionally checks real resource IDs, owner-only Access policy, matching application audience, disabled alternate URLs, authentication before static assets, and private R2 domains. It refuses the checked-in placeholder template.

## Staging, then production

After the prerequisites above are fixed, supply the confirmed owner email:

```sh
uv run python -m scripts.provision staging --owner-email CONFIRMED_OWNER_EMAIL
uv run python -m scripts.deployment deploy --config wrangler.staging.json
```

Provisioning uses `fpi-market-staging`, D1 `fpi-market-staging`, private R2 `fpi-market-staging-raw`, and Access on the complete hostname `fpi-market-staging.shrutsureja.com`. Existing resources are reused by name, and public buckets are rejected. The only Access allow policy includes the owner's exact email through existing identity providers. It writes a concrete Wrangler config containing the returned resource IDs, audience and custom domain. Review and commit that nonsecret config.

The deploy script repeats Python/frontend/Worker gates, applies the remote migrations, then deploys the complete Python Worker and React assets. Access must exist before the hostname is published. There is no Tunnel and no anonymous staging route.

Sign in as the owner in a browser, verify every screen, and run the HTTP smoke suite using an owner session. Set `FPI_TEST_URL` and `FPI_TEST_HEADERS` in a private environment, with `FPI_TEST_HEADERS` a JSON object containing the session's `Cookie` header. Never put the session value in a command argument, log or committed file. The suite imports the three real sources, so run it only against the intended empty/three-fixture environment.

```sh
uv run python -m unittest runtime_tests.smoke -v
```

Without a session, check `/`, asset URLs, every API and `/export/:id`: each must redirect to Access or deny access, never return app data or accept an upload. Repeat with a forged JWT/email header and an unapproved email login. Check the workers.dev and preview addresses remain disabled. In authenticated Chrome, verify overview, period selector, heatmap, sector history, comparison, malformed/duplicate feedback and download at desktop and phone widths. Check browser network requests have no localhost references.

Inspect remote D1 and R2 directly, using the credential helper:

```sh
uv run python scripts/cloudflare.py npx wrangler d1 execute DB --remote --config wrangler.staging.json --command 'SELECT report_date,totalNet FROM reports ORDER BY report_date'
uv run python scripts/cloudflare.py npx wrangler d1 execute DB --remote --config wrangler.staging.json --command 'SELECT status,COUNT(*) FROM import_attempts GROUP BY status'
# Replace HASH with a source's SHA-256; save output in private ignored data/.
uv run python scripts/cloudflare.py npx wrangler r2 object get fpi-market-staging-raw/raw/HASH.html --remote --file data/verified-source.html
```

Expected source totals are 16,621 (15 Aug), 13,010 (31 Aug), and −14,116 (15 Sep 2026). There are 3 reports and 72 sector rows. August 15 sector values sum to 16,618: the documented source rounding tolerance permits that difference. Test XLSX against all 48 September equity flow/AUC values in the HTML fixture. The originally mentioned separate workbook is not present in this repository and cannot be independently rechecked here.

Record report IDs and R2 hashes, redeploy the same configuration, rerun the smoke suite, and confirm all IDs/values/object bytes survive. Capture the actual Worker version, migration version, Git commit, resource IDs and authenticated/denied check results in this release record. Only after protected staging passes:

```sh
uv run python -m scripts.provision production --owner-email CONFIRMED_OWNER_EMAIL
uv run python -m scripts.deployment deploy --config wrangler.production.json
```

Production names are Worker/D1 `fpi-market`, R2 `fpi-market-raw`, Access application `fpi-market`, hostname `fpi.shrutsureja.com`. Repeat all remote checks and redeploy persistence checks against production. Commit concrete configs and verified release evidence, then push the existing default branch. Do not claim completion based on a deployment upload alone.

## Backup, rollback and maintenance

Keep source HTML private and back up local `data/` before moving existing reports. Reimport original files through the protected API; do not copy filesystem paths into D1. Before future schema changes, export D1 into private ignored storage:

```sh
mkdir -p data/backups
uv run python scripts/cloudflare.py npx wrangler d1 export DB --remote --config wrangler.production.json --output data/backups/fpi-market.sql
```

Retain raw R2 objects and copy exports to private backup storage according to the owner's retention policy. Never enable an R2 public URL for convenience. Test restoring backups into staging before relying on them. Record each Worker deployment/version; restore a known-good version with Wrangler rollback if necessary. Code rollback does not undo D1 migrations, so prefer additive changes and handle data restore separately. Keep Access in place throughout failures and rollback.

References: [Python Workers](https://developers.cloudflare.com/workers/languages/python/), [packages](https://developers.cloudflare.com/workers/languages/python/packages/), [static assets](https://developers.cloudflare.com/workers/static-assets/), [D1](https://developers.cloudflare.com/d1/), [Access applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/).
