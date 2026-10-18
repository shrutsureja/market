# 0012 — Replaceable sector company directory

Status: Amended by [0013](0013-simple-company-upload.md) (2026-10-18)

## Context

The family wants to see companies in a sector beside its historical FPI flows and replace
membership when NSE publishes new constituent lists. Constituents are not stock-level flows.

## Decision

Accept the five-column Nifty Total Market or Nifty 500 CSV. Map the Industry values to the
22 sector labels using exact labels and two explicit punctuation aliases. Unknown labels,
duplicate symbols/ISINs, unsupported series, malformed rows and invalid ISIN checksums reject
the whole file. EQUITY_L has no industry classification and is not accepted.

Preserve explicitly marked NSE Dummy entries using a narrow name/symbol/identifier rule and
label them temporary. The current official Total Market snapshot contains 755 entries including
four such entries. Do not silently discard them or pretend they have standard ISINs.

Store validated immutable snapshots in D1 and change an active pointer only after a count/diff
preview and explicit confirmation. Drafts expire after 30 minutes; conditional updates prevent
a stale preview from overwriting another replacement. D1 batch makes activation and its audit
timestamp atomic. Retain confirmed snapshots; delete expired drafts during subsequent previews.

Display current uploaded membership alongside every selected historical fortnight, with source,
user-supplied download date and coverage limitations. Files may be replaced without code changes
when they obey the supported schema; new sectors or series require a reviewed parser update.

## Consequences

No new runtime dependency or service. No authentication is added (ADR 0002): anyone with the
URL can replace the directory. Confirmation protects against accidental replacement, not access.
Validation proves structure and identifier consistency, not current factual classifications.
The July 2023 hierarchy PDFs explain taxonomy but do not establish company membership.
Feature preview uses a separate Worker and D1 database; production is unchanged until approved.

Confirmed data uses compact JSON tuples internally to reduce D1 transport size; API responses
use named fields. The decoder also understands the initial object-based preview snapshots.

## Preview performance limitation

Remote smoke tests succeeded, but Cloudflare tail recorded 17–32 ms CPU for full 755-entry
validation/review requests after compaction, above the repository's conservative 10 ms target.
Reads and confirmations measured 1–8 ms. Do not treat successful requests as proof of free-plan
headroom. Before production promotion, split validation/storage and comparison into separately
bounded requests, then measure cold requests again. No paid-plan change is authorized or made.
