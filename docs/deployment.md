# Deployment and local development

Hosting is one Cloudflare Worker (`fpi-market`) with one D1 database (`fpi-market`), on the
free plan. See [ADR 0010](decisions/0010-deployment-and-hosting.md) for why.

- Production: https://fpi.shrutsureja.com (Cloudflare Custom Domain)
- Fallback: https://fpi-market.shrutsureja.workers.dev

## Local development

Requires Node.js 20+.

Use Node.js 22.16+ when running tests (built-in node:sqlite is used for transaction tests).

```sh
npm install && npm --prefix web install
npm run db:migrate:local        # applies migrations/ to a local D1 under .wrangler/
npm run dev                     # builds web/dist and runs wrangler dev on http://127.0.0.1:8787
```

For frontend hot reload, keep `wrangler dev` running and in a second terminal:

```sh
npm --prefix web run dev        # Vite on :5173, proxies /api to :8787
```

The local database starts empty; upload files from `fixtures/` with **+ Add report**. Local data
is keyed to the `database_id` in `wrangler.jsonc`, so if that ever changes, rerun
`npm run db:migrate:local`.

Local runs have no CPU limit, so they can't show free-plan CPU problems. Measure anything heavy
(see [rules](rules.md#development)).

## Before every deploy

```sh
npm test                        # parser, API contract, Excel builder
npm run build
```

Then check the change in a browser at desktop and phone widths.

## Deploying

Credentials come from `npx wrangler login` on the deploying machine. Never put tokens in the repo.

1. **If there are new files in `migrations/`, apply them first:**
   ```sh
   npx wrangler d1 migrations list DB --remote     # shows what's pending
   npm run db:migrate:remote
   ```
   Code that expects a new column fails until its migration is applied.
2. Deploy:
   ```sh
   npm run deploy                                  # builds web/dist, then wrangler deploy
   ```
3. Verify on https://fpi.shrutsureja.com: the dashboard loads, an Excel download works, and the
   browser console has no errors.

## Isolated company-directory preview

Branch: `feature/sector-company-directory`. Config: `wrangler.companies-preview.jsonc`.
Worker/database: `fpi-market-companies-preview`. Preview has no production custom domain route.
Database ID: `29530f45-0b51-47a1-b84f-676589552467` (separate from production).

```sh
npm test
npm run build
npx wrangler d1 migrations apply DB --local --config wrangler.companies-preview.jsonc
npx wrangler dev --config wrangler.companies-preview.jsonc --port 8788
# After browser checks, deploy ONLY the isolated preview:
npx wrangler d1 migrations apply DB --remote --config wrangler.companies-preview.jsonc
npx wrangler deploy --config wrangler.companies-preview.jsonc
```

Expected URL: https://fpi-market-companies-preview.shrutsureja.workers.dev . Verify the actual
URL printed by Wrangler. Upload the three fixture reports and the latest official company CSV
through the application. Company CSV upload requires preview and explicit confirmation.
No production data is copied automatically. Anyone with the preview link can change its data,
consistent with the existing no-login design.

Review desktop/390px mobile layouts, company searches, 755→501 preview and cancellation,
invalid CSV rejection, confirmation and stale-preview rejection before approving a PR.
Do not merge or deploy production until the owner approves. After an approved merge, apply
0004 and 0005 to production using the normal migration command before deploying, then let the owner upload
and confirm their desired company directory there. Do not seed production companies. Preview data is not migrated automatically.
Rollback preview code using `wrangler rollback <version-id> --config wrangler.companies-preview.jsonc`;
the active directory and additive migration remain. Confirm a prior CSV to restore membership.

### Verification on 2026-10-18

All 21 automated tests passed; production build passed (existing large-chunk warnings remain).
Desktop 1440px and phone 390px browser checks passed with no page-level horizontal overflow.
Remote tests covered initial confirmation, a 755→501 preview and cancellation, invalid-file
rejection, and rejection of a stale confirmation. The active preview list remains 755 entries
with four explicitly marked temporary entries; all three fixture reports are loaded. Browser
console was clean on the deployed normal flows. An intentionally rejected local upload logged
the expected HTTP 400, with a readable error and unchanged saved data.

**Initial preview measurement (superseded implementation):** Cloudflare tail measured 17–32 ms CPU on full-list preview requests;
all returned 200, but this exceeds the repository's conservative free-plan target. Reads and
confirmations measured 1–8 ms. See ADR 0013 for the bounded upload implementation and updated verification.

## Production rollback

```sh
npx wrangler deployments list
npx wrangler rollback <version-id>
```

Rollback restores code only; D1 migrations are not undone, which is why migrations stay
additive. D1 Time Travel can restore the database to an earlier point if data goes wrong:
`npx wrangler d1 time-travel restore DB --timestamp=<ISO time>` (check `--help` first; it
replaces the current data).

## First-time setup (new account or rebuild from scratch)

```sh
npx wrangler login
npx wrangler d1 create fpi-market       # copy database_id into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

The custom domain comes from `routes` in `wrangler.jsonc` (`custom_domain: true`); it needs the
domain's zone on the same Cloudflare account. Then re-upload the NSDL HTML files.

## Re-uploading older fortnights

Fortnights imported before migrations 0002 (full NSDL page for Excel) and 0003 (opening AUC)
lack that data. Upload the same HTML again to fill it in; the Reports page shows "Summary only"
for any missing the full page. A re-upload is refused if its figures differ from the stored ones.

### Approved company upload revision

The owner approved promotion after the one-button revision. Apply migrations 0004 and 0005
before deployment. Production company data must remain empty until the owner uploads their CSV;
do not copy preview snapshots or seed company fixtures. The new flow automatically batches the
single selected file and records upload time. See ADR 0013 for CPU measurements (2–8 ms per
validation batch in the 755-entry live check), API changes, and 23 passing tests.
