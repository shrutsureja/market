import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDocument } from "../src/parser.js";
import { UserError } from "../src/errors.js";

const fixture = (name) => readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf-8");

const cases = [
  { file: "2026-08-15.html", reportDate: "2026-08-15", periodStart: "2026-08-01", totalNet: 16621 },
  { file: "2026-08-31.html", reportDate: "2026-08-31", periodStart: "2026-08-16", totalNet: 13010 },
  { file: "2026-09-15.html", reportDate: "2026-09-15", periodStart: "2026-09-01", totalNet: -14116 },
];

for (const c of cases) {
  test(`parses ${c.file}`, () => {
    const doc = parseDocument(fixture(c.file));
    assert.equal(doc.reportDate, c.reportDate);
    assert.equal(doc.periodStart, c.periodStart);
    assert.equal(doc.periodEnd, c.reportDate);
    assert.equal(doc.flows.length, 24);
    assert.equal(doc.flows[0][0], "Automobile and Auto Components");
    assert.equal(doc.totalNet, c.totalNet);
  });
}

test("rejects a document without the expected sector table", () => {
  assert.throws(() => parseDocument("<table><tr><td>nothing useful</td></tr></table>"), UserError);
});

test("rejects a sectors table missing the net investment columns", () => {
  assert.throws(() => parseDocument("<table><tr><td>Sectors</td></tr></table>"), UserError);
});
