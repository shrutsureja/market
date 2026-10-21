# 0015 — TradingView is the primary company chart

Status: Accepted (2026-10-21)

## Decision

The company name opens the owner's TradingView chart layout with the NSE symbol selected. On
Android, the link requests TradingView's installed app using a Chrome intent and falls back to
the same web chart. Other browsers use the regular HTTPS chart URL and their own app-link behavior.

On desktop, Kite remains a clearly labeled secondary link in the last table column when Zerodha's
current NSE instrument list contains the security. The Kite column is hidden in the mobile layout,
where selecting the company name is the only chart action. Temporary directory entries have no
chart link.

## Limits

The site can request the TradingView app, but TradingView and the phone decide whether that chart
URL opens natively. This needs a check on an Android device with TradingView installed. The
fallback preserves access to the selected chart in a browser.
