# Deployment and local development

Hosting is one Cloudflare Worker (`fpi-market`) with one D1 database (`fpi-market`), on the
free plan. See [ADR 0010](decisions/0010-deployment-and-hosting.md) for why.

- Production: https://fpi.shrutsureja.com (Cloudflare Custom Domain)
- Fallback: https://fpi-market.shrutsureja.workers.dev

## Local development

Requires Node.js 20+.

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

## Rolling back

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
