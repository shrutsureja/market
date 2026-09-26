# 0002 — No login; anyone with the link can use it

Status: Accepted (2026-09-26)

## Context

The first version used Cloudflare Access (Zero Trust) with JWT verification in the Worker. It
needed an identity provider, an Access application and account permissions the owner's token
didn't have, and it was one of the reasons nothing ever deployed. The users are the owner and
their parents, on phones.

## Decision

No authentication. Anyone with the URL can view the dashboard, upload reports and download Excel
files. The footer carries a disclaimer that this is a personal, experimental project and not
investment advice.

## Consequences

- Nothing to set up or forget; parents just open a link.
- The URL shouldn't be shared publicly. Uploads are limited to valid NSDL pages (the parser
  rejects anything else) and can't overwrite existing figures ([0003](0003-store-parsed-page-not-html.md)),
  which limits the damage a stranger could do.
- If this is ever needed, Cloudflare Access can be put in front of the Worker without code
  changes.
