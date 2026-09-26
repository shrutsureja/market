# Architecture decision records

Each file records one decision: the situation, what was decided, and what it costs. Read these
before changing how the app is built or what its numbers mean. To change a decision, add a new
record that supersedes the old one (and mark the old one "Superseded by NNNN") rather than
editing history.

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-single-javascript-worker.md) | One JavaScript Cloudflare Worker with D1, replacing Go and Python | Accepted |
| [0002](0002-no-login.md) | No login; anyone with the link can use it | Accepted |
| [0003](0003-store-parsed-page-not-html.md) | Store the parsed page, not the HTML file | Accepted |
| [0004](0004-parsing-and-validation.md) | How an NSDL page is parsed and validated | Accepted |
| [0005](0005-equity-only-analytics.md) | Analytics cover equity only | Accepted |
| [0006](0006-flows-relative-to-auc.md) | Measure flows against opening AUC | Accepted, amended by 0011 |
| [0007](0007-heatmap-scales-with-history.md) | Heatmap: time window and colour basis | Accepted |
| [0008](0008-excel-built-in-browser.md) | Excel reproduces the NSDL page and is built in the browser | Accepted |
| [0009](0009-frontend-structure-and-look.md) | Frontend structure and Kite-style look | Accepted |
| [0010](0010-deployment-and-hosting.md) | Deployment and hosting | Accepted |
| [0011](0011-opening-auc-from-page.md) | Read opening AUC from the NSDL page | Accepted |

Template for new records:

```markdown
# NNNN — Title

Status: Accepted (YYYY-MM-DD)

## Context
What situation forced a decision.

## Decision
What was decided.

## Consequences
What this makes easier, harder, or rules out.
```
