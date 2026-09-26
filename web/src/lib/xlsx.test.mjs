import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import XLSX from "xlsx-js-style";
import { parseDocument } from "../../../src/parser.js";
import { exportWorkbook } from "./xlsx.js";

const doc = parseDocument(readFileSync(new URL("../../../fixtures/2026-09-15.html", import.meta.url), "utf-8"));
const report = { report_date: doc.reportDate, period_start: doc.periodStart, period_end: doc.periodEnd };
const rows = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });

test("the Sector data sheet reproduces the NSDL table cell for cell", () => {
  const wb = XLSX.read(exportWorkbook(report, doc.flows, doc.source));
  assert.deepEqual(wb.SheetNames, ["Sector data", "Notes & other tables", "Equity summary"]);
  const sheet = rows(wb, "Sector data");
  const table = doc.source.find((b) => b.type === "table").rows;
  const html = table.find((r) => r.some((c) => c.text === "Automobile and Auto Components")).flatMap((c) => Array(c.span).fill(c.text));
  const excel = sheet.find((r) => r.includes("Automobile and Auto Components"));
  assert.equal(excel.length, 98);
  html.forEach((text, i) => assert.equal(String(excel[i] ?? ""), text.replace(/,/g, "")));
  assert.equal(typeof excel[2], "number");
});

test("the notes and smaller tables get their own sheet", () => {
  const text = rows(XLSX.read(exportWorkbook(report, doc.flows, doc.source)), "Notes & other tables").flat().filter((v) => typeof v === "string");
  assert.ok(text.some((v) => v.startsWith("AUC of Top 10 companies under Others")));
  assert.ok(text.some((v) => v.startsWith("Note: RBI reference rate")));
});

test("fortnights saved before the full page was kept still export, with a note", () => {
  const wb = XLSX.read(exportWorkbook(report, doc.flows, null));
  assert.deepEqual(wb.SheetNames, ["Sector data", "Equity summary"]);
  assert.match(rows(wb, "Sector data")[0][0], /Upload its HTML file again/);
  assert.equal(rows(wb, "Equity summary").length, 25);
});
