# 0013 — One upload button with bounded server processing

Status: Accepted (2026-10-18); amends 0012

## Context

After testing the preview, the owner requested one Nifty Total Market source, an upload button,
automatic upload time, and production promotion through a PR. They will upload production
companies themselves. Initial full-file validation used 17–32 ms CPU, above the free-plan target.

## Decision

Remove source/date selectors and the EQUITY_L explanation from the screen. Record upload time
on the server (display IST); it is not a download date or proof of source freshness. One CSV
replaces the complete current list after count review and explicit confirmation.

The browser parses CSV quoting and sends batches of at most 100 rows. Every batch is validated
on the server and stored as an expiring D1 draft. Migration 0005 marks partial batches so they
cannot be reviewed or activated as a full directory. SQLite assembles the complete snapshot,
checks cross-batch duplicate symbols/ISINs, and sorts the companies. Assembly rejects missing,
expired or stale batches. The server accepts at most 50 batches / 5,000 entries.

Comparison is a separate request. Confirmation retains the conditional atomic active-pointer
swap. Interrupted uploads leave the active list intact. Expired drafts are cleaned on the next
upload. No in-memory queue: Worker lifetimes do not provide durable job ownership, and merely
deferring work does not reduce its CPU requirement. No new queue service or paid plan is needed.

Compact tuples use a sector index plus an optional original industry label. Existing snapshot
formats remain readable. The audit digest now identifies the sorted set of validated batch
digests, not the original whole-file bytes. The legacy downloaded_on column remains populated
for schema compatibility; the API and UI use server-owned uploadedAt.

## Verification and consequences

23 automated tests passed, including cross-batch duplicates, partial-batch confirmation refusal,
stale previews, transaction rollback, and caller attempts to override the source/upload time.
Deployed preview browser test with 755 entries measured 2–8 ms CPU per validation batch,
4 ms assembly, 8 ms comparison, and 3 ms confirmation. These are observed measurements, not a
guarantee for every input or cold start. Continue measuring if upload limits or schema change.
Desktop and 390px phone layouts were checked. Successful confirmation was tested only in preview.

Cloudflare documents CPU limits separately from time awaiting network/database I/O:
https://developers.cloudflare.com/workers/platform/limits/#cpu-time
