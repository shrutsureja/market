# 0009 — Frontend structure and Kite-style look

Status: Accepted (2026-09-26)

## Context

The original frontend was one dense `src.jsx` with each screen on a single line, which was hard
for AI assistants to edit without breaking something. Users are non-technical and mostly on
phones. The owner asked for a Zerodha Kite-like look.

## Decision

- React + Vite, split by concern: `App.jsx` holds state and derived data; one file per screen in
  `views/`; shared pieces in `components/`; pure helpers in `lib/`; data loading in `hooks/`.
- Charts use Recharts. Custom bar shapes normalise negative heights (SVG won't draw a rect with
  a negative height).
- Styling is one plain CSS file, not a framework.
- Look follows Zerodha's real brand, taken from zerodha.com's live stylesheet and their published
  brand colours: Inter, `#387ED1` accent, `#2A9D4A` for gains, `#DF514C` for losses, grey
  neutrals, flat 2–4 px corners, dense tables, no gradients.
- Every screen must work at 390 px width without dropping analytics; wide tables scroll
  sideways.
- Name: "NSDL FPI Analysis".

## Consequences

- A change to one screen usually touches one small file.
- The main JavaScript bundle is ~600 KB (~180 KB gzipped), mostly Recharts; acceptable for a
  handful of users.
