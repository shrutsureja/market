# Rules

How to work on this repo. They exist because of specific decisions (linked) or specific
mistakes made while building it — follow them unless the owner says otherwise.

## Working with the owner

- Don't deploy, commit or push without an explicit go-ahead. The default is: change it, run it
  locally, show the result, wait.
- Explain analytics in plain language. The people using this don't have a finance background.
- When a request is ambiguous and changes the data or the schema, ask before building.

## Development

- One language: JavaScript on the Worker and in the browser ([ADR 0001](decisions/0001-single-javascript-worker.md)).
- Keep files small and single-purpose: one screen per file in `web/src/views/`, shared UI in
  `web/src/components/`, shared logic in `web/src/lib/`. Large files are hard for anyone
  (including AI tools) to change safely.
- Throw `UserError` only for messages the user should see (bad file, duplicate). Anything else
  becomes a generic 503 so internals never leak.
- Worker requests must stay well under ~10 ms CPU (free plan). Measure anything that loops over
  a whole report; move heavy work to the browser ([ADR 0008](decisions/0008-excel-built-in-browser.md)).
- Don't add dependencies for things a few lines can do. Pin exact versions.
- Remove code that's no longer used instead of leaving it behind.

## Data correctness

- Every number shown or exported must come from the NSDL page. Never adjust source figures to
  make totals match ([ADR 0004](decisions/0004-parsing-and-validation.md)).
- Changes to `src/parser.js` must keep all tests passing against every file in `fixtures/`. If
  NSDL changes its page layout, add the new page as a fixture before changing the parser.
- % of AUC uses the opening AUC ([ADR 0006](decisions/0006-flows-relative-to-auc.md)). A
  fortnight's AUC change is flows plus price movement — never present it as flows.
- Analytics are equity-only ([ADR 0005](decisions/0005-equity-only-analytics.md)); other asset
  classes appear only in the Excel export.
- Numbers that don't add up on screen (e.g. counts that miss a category) are bugs even if each
  number is individually correct — show the missing piece.

## Database

- Schema changes go in a new `migrations/NNNN_*.sql` file. Never edit a migration that has been
  applied anywhere.
- Migrations are additive where possible; code rollback does not undo them.
- Apply migrations to the remote database before deploying code that depends on them
  ([deployment.md](deployment.md)).
- Don't `SELECT *` into API responses; list columns so large columns (like `source_doc`) stay out.

## UI

- Mobile first: every screen must work at 390 px wide without hiding analytics.
- Verify changes in a real browser at desktop and phone widths, and check the console for errors.
  Tests don't catch layout problems.
- Visual language follows Zerodha Kite ([ADR 0009](decisions/0009-frontend-structure-and-look.md)):
  Inter, `#387ED1` accent, `#2A9D4A` gains, `#DF514C` losses, flat 2–4 px corners.
- Keep the footer disclaimer (personal, experimental, not investment advice).

## Documentation

- A decision that changes architecture, data meaning or the analytics gets a new ADR in
  `docs/decisions/` (next number, and an entry in its README). Superseded ADRs stay, marked as such.
- Update `README.md`, `CLAUDE.md` and `docs/deployment.md` in the same change when commands,
  structure or deployment steps change.
- Comments in code explain *why* something non-obvious is done, not what the code does.

## Git and security

- The repository is public. Never commit tokens, API keys, `.dev.vars`, `.env` files, or personal
  data. Cloudflare credentials live only in `wrangler login` on the owner's machine.
- Commit as the owner's personal GitHub identity (`shrutsureja`), never a work identity.
- Never rewrite or force-push published history on `master`.
- Commit messages say why, not just what.
