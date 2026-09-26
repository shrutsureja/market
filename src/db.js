// D1 persistence for reports and sector flows.
import { parseDocument } from "./parser.js";
import { UserError } from "./errors.js";

const MAX_UPLOAD = 10 * 1024 * 1024;

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listReports(db) {
  const { results } = await db
    .prepare(
      `SELECT id, report_date, period_start, period_end, filename, imported_at, totalNet, totalAuc,
              source_doc IS NOT NULL AS hasSource
       FROM reports ORDER BY report_date DESC`,
    )
    .all();
  return results;
}

export async function listFlows(db, latestOnly) {
  const where = latestOnly ? "WHERE r.report_date = (SELECT MAX(report_date) FROM reports)" : "";
  const { results } = await db
    .prepare(
      `SELECT f.report_id, f.sector, f.net, f.auc, f.opening_auc, r.report_date, r.period_start, r.period_end
       FROM flows f JOIN reports r ON r.id = f.report_id ${where}
       ORDER BY r.report_date DESC, f.net DESC`,
    )
    .all();
  return results.map((r) => ({
    id: `${r.report_id}-${r.sector}`,
    sectorName: r.sector,
    equityNetInvestmentCr: r.net,
    equityAucCr: r.auc,
    openingAucCr: r.opening_auc,
    reportDate: r.report_date,
    periodStart: r.period_start,
    periodEnd: r.period_end,
  }));
}

export async function getReportWithFlows(db, id) {
  const report = await db.prepare("SELECT * FROM reports WHERE id = ?").bind(id).first();
  if (!report) return null;
  const { results: flows } = await db.prepare("SELECT sector, net, auc FROM flows WHERE report_id = ? ORDER BY sector").bind(id).all();
  return { report, flows: flows.map((f) => [f.sector, f.net, f.auc]), source: report.source_doc ? JSON.parse(report.source_doc) : null };
}

export async function importReport(db, raw, filename) {
  if (raw.byteLength > MAX_UPLOAD) throw new UserError("Please choose a report smaller than 10 MB");
  const hash = await sha256Hex(raw);
  const html = new TextDecoder("utf-8", { fatal: false }).decode(raw);
  const doc = parseDocument(html);

  const sourceDoc = JSON.stringify(doc.source);
  const duplicate = await db
    .prepare(
      `SELECT id, report_date,
              source_doc IS NULL OR EXISTS (SELECT 1 FROM flows WHERE report_id = reports.id AND opening_auc IS NULL) AS incomplete
       FROM reports WHERE report_date = ? OR hash = ?`,
    )
    .bind(doc.reportDate, hash)
    .first();
  if (duplicate) {
    // Reports imported before the full page and opening AUC were kept can be topped up by
    // uploading them again.
    if (duplicate.incomplete && duplicate.report_date === doc.reportDate) {
      // Only attach the page if its figures are the ones already stored; otherwise the Excel
      // sheet and the dashboard would disagree about the same fortnight.
      const { results: stored } = await db.prepare("SELECT sector, net, auc FROM flows WHERE report_id = ?").bind(duplicate.id).all();
      const key = (sector, net, auc) => `${sector.toLowerCase()}|${net}|${auc}`;
      const storedKeys = new Set(stored.map((f) => key(f.sector, f.net, f.auc)));
      if (stored.length !== doc.flows.length || !doc.flows.every(([s, n, a]) => storedKeys.has(key(s, n, a)))) {
        throw new UserError("This file's figures differ from the ones already saved for this fortnight, so it wasn't used");
      }
      await db.batch([
        db.prepare("UPDATE reports SET source_doc = ? WHERE id = ?").bind(sourceDoc, duplicate.id),
        ...doc.flows.map(([sector, , , opening]) =>
          db.prepare("UPDATE flows SET opening_auc = ? WHERE report_id = ? AND sector = ?").bind(opening, duplicate.id, sector),
        ),
      ]);
      return { id: duplicate.id, reportDate: doc.reportDate, sectorCount: doc.flows.length, backfilled: true };
    }
    throw new UserError("This fortnight is already in your dashboard");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [
    db
      .prepare(
        `INSERT INTO reports (id, report_date, period_start, period_end, filename, hash, imported_at, totalNet, totalAuc, source_doc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, doc.reportDate, doc.periodStart, doc.periodEnd, filename, hash, now, doc.totalNet, doc.totalAuc, sourceDoc),
    ...doc.flows.map(([sector, net, auc, opening]) =>
      db.prepare("INSERT INTO flows (report_id, sector, net, auc, opening_auc) VALUES (?, ?, ?, ?, ?)").bind(id, sector, net, auc, opening),
    ),
  ];

  try {
    await db.batch(statements);
  } catch (e) {
    // A competing import may have won the unique report_date/hash race.
    const stillDuplicate = await db
      .prepare("SELECT id FROM reports WHERE report_date = ? OR hash = ?")
      .bind(doc.reportDate, hash)
      .first();
    if (stillDuplicate) throw new UserError("This fortnight is already in your dashboard");
    throw e;
  }

  return { id, reportDate: doc.reportDate, sectorCount: doc.flows.length };
}
