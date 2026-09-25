# FPI Flow Dashboard

Import NSDL fortnightly FPI HTML reports, browse sector equity flows in React, and download normalized Excel workbooks. The same parser powers the local Python application and the Cloudflare Python Worker.

**Production is blocked, not deployed.** The requested hostname is `https://fpi.shrutsureja.com`. The available Cloudflare credential cannot create D1 or Access applications, and R2 is not enabled. No public stub or Tunnel was created. See [DEPLOYMENT.md](DEPLOYMENT.md) for evidence and the release procedure.

## Local application

Install [uv](https://docs.astral.sh/uv/) and Node.js. Python 3.12 is pinned for the existing WSGI server, which uses `cgi`.

```sh
uv sync --locked
npm ci
npm --prefix web ci
uv run python app.py
# In another terminal:
npm --prefix web run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/export` to Python on port 8000. The frontend uses relative URLs in development and production. Python dependencies now live in `pyproject.toml` and `uv.lock`; pywrangler does not accept a root `requirements.txt`.

Local reports are in `data/market.db`; raw HTML, including rejected sources, is in `data/raw/`. The old Go directories are not the running backend. `internal/sources/nsdl/testdata/` contains the three shared report fixtures.

## Verification

```sh
uv run python -m unittest -v test_app
uv run python -m unittest discover -s tests -v
npm --prefix web test
npm --prefix web run build
uv run python -m scripts.test_worker
uv run pywrangler deploy --dry-run
```

`test_worker` runs the real local workerd runtime, applies migrations to an isolated database, exercises D1/R2 and XLSX through HTTP, drives desktop/mobile Chrome, restarts the Worker, checks stored bytes and database rows, and tests full-origin anonymous/forged-header denial. Set `CHROME_PATH` if Chrome is not at `/usr/bin/google-chrome`. Test state is temporary and does not touch local application data or cloud resources.

For interactive Worker development:

```sh
npx wrangler d1 migrations apply DB --local --env local
uv run pywrangler dev --env local --ip 127.0.0.1 --port 8787
```

The `local` environment bypasses Access **only on loopback hosts**. Never deploy that environment. The production template has no authentication bypass and rejects every request until valid Access configuration exists.

## Import semantics

An accepted report requires a report date, matching reporting period, sector table, direct-equity INR net-investment and AUC columns, finite numeric rows, and source grand totals. Whole-crore rounding tolerance is half a crore per displayed sector plus half a crore for the total. Sector values are never adjusted to force equality.

Cloud uploads are size-bounded to 10 MiB, stored under a SHA-256 key in private R2 before parsing, and recorded in D1 import attempts. Accepted report/flow writes are one transactional batch; unique date/hash and sector constraints protect against duplicate races. Invalid and duplicate uploads retain their raw source and diagnostics. Infrastructure failures retain raw objects for retry. Excel generation is entirely in memory.
