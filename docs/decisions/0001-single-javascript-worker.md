# 0001 — One JavaScript Cloudflare Worker with D1, replacing Go and Python

Status: Accepted (2026-09-26)

## Context

The first version mixed a Go API, a local Python WSGI server and a Python Cloudflare Worker
running on Pyodide, with R2, Cloudflare Access and staging/production provisioning scripts.
Production was never deployed: Pyodide packaging was hard to get working, the setup kept losing
AI assistants' context, and the API token lacked permissions for D1 and Access. The actual need
is small: a few people open a page every fortnight, upload one HTML file, and look at charts.

## Decision

Rewrite everything as plain JavaScript: one Cloudflare Worker (`src/worker.js`) that serves the
built React app as static assets and a small JSON API, with one D1 (SQLite) database. Delete the
Go code, the Python code, the Pyodide Worker and the provisioning scripts.

## Consequences

- One language and one deploy command (`npm run deploy`); fits the free plan.
- No server to keep running; the Worker only uses resources on requests.
- The Worker's ~10 ms CPU budget per request on the free plan constrains server-side work
  (see [0008](0008-excel-built-in-browser.md)).
- The HTML parser had to be ported from Python to JavaScript
  ([0004](0004-parsing-and-validation.md)).
