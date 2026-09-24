# FPI Flow Dashboard

A local-first MVP for importing NSDL fortnightly FPI HTML reports and viewing sector-level equity flows.

## Run locally

Use Python 3.12 (the current upload handler uses `cgi`) and Node.js. Install Python dependencies with `python3 -m pip install -r requirements.txt`.

```sh
python3 app.py
```

In a second terminal:

```sh
cd web && npm install && npm run dev
```

Open the React dashboard at `http://localhost:5173`. Python provides the local API, SQLite storage, HTML validation, and Excel export; React provides the mobile-friendly screens.

## Import rules

The importer stores every raw upload, including failed imports. It detects tables by visible headings and column labels rather than HTML classes. A report is accepted only when a report date, sector table, `Net Investment / IN INR Cr. / Equity`, and `AUC ... / IN INR Cr. / Equity` columns can be found and numeric sector rows are valid.

Imported reports and normalized sector rows are stored locally in `data/market.db`. Raw HTML is kept in `data/raw/`, including a source that fails validation, so new NSDL formats can be investigated safely.

## Verification and cloud deployment

Run `python3 -m unittest -v test_app.py` and `npm --prefix web run build`.

See [the Cloudflare deployment plan](DEPLOYMENT.md) for the proposed Python Worker, React static assets, D1, R2 and family-only Access setup. The app currently runs locally; the Worker adapter is not implemented yet. The Go directories are an earlier prototype, not the active backend.
