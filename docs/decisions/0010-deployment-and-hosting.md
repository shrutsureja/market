# 0010 — Deployment and hosting

Status: Accepted (2026-09-26)

## Context

Free services were a requirement, with Cloudflare preferred. The previous setup had staging and
production environments, provisioning scripts and a credentials helper, none of which ever
deployed.

## Decision

- One Worker (`fpi-market`) and one D1 database (`fpi-market`), deployed with Wrangler from the
  owner's machine after `wrangler login`. No staging environment and no CI.
- Served at `fpi.shrutsureja.com` as a Cloudflare Custom Domain (`routes` in `wrangler.jsonc`),
  with `fpi-market.shrutsureja.workers.dev` kept as a fallback.
- Migrations are applied with `wrangler d1 migrations apply DB --remote` before deploying code
  that needs them.
- The owner reviews changes locally before any deploy.

## Consequences

- Deploying is two commands; the steps are in [../deployment.md](../deployment.md).
- No automatic checks run before a deploy; running tests and checking in a browser is part of
  the deploy steps.
- `database_id` in `wrangler.jsonc` identifies the database but grants nothing without a login,
  so it's fine in a public repo.
