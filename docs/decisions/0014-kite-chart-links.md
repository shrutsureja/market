# 0014 — Resolve Kite chart links from Zerodha's NSE instrument list

Status: Accepted (2026-10-18)

## Context

Kite web chart URLs contain both an NSE symbol and a Zerodha instrument token. The owner supplied
three examples; all three tokens matched Zerodha's public NSE instrument list. A fixed mapping
would become stale when the company list changes.

## Decision

Stream the public CSV from `https://api.kite.trade/instruments/NSE` through a same-origin Worker
endpoint. The browser extracts equity symbols and tokens and caches the result for the current
page; HTTP responses may be cached for one hour. Link the company name directly to Kite only when the
current directory symbol is in that list. Temporary index entries are not linked. The Worker does not parse the 10,000-row CSV,
store Kite credentials or copy the instrument list into D1.

Some constituent symbols need their NSE series appended in Kite's instrument list, such as
`EMBASSY-RR` and `LOTUSDEV-BE`. For non-`EQ` entries, try the exact symbol plus series first,
then the plain symbol when Kite lists it that way. If neither is present, leave the name unlinked.

Use the owner's observed Kite web ChartIQ URL structure:
`/markets/chart/web/ciq/NSE/{symbol}/{instrument_token}`. This opens Kite in a browser signed
in there. The owner also supplied a working `/markets/ext/chart/web/ciq/NSE/...` example;
both routes accept the same NSE symbol and instrument token, so the site uses the shorter URL
consistently. Zerodha documents mobile-browser access, but no verified native-app deep link for a
specific chart was found; do not claim that browser links always launch the native app.

## Consequences

Kite links depend on Zerodha's public CSV being available. If it fails, show a short error and
leave company names unlinked. If a symbol is absent from Kite's current NSE list, leave its
name unlinked instead of guessing a token. The one-hour cache can briefly lag a new listing.
