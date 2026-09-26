// Parses NSDL's fortnightly FPI sector-flow HTML report into report metadata and sector rows.

import { UserError } from "./errors.js";
const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", ndash: "–", mdash: "—" };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

// Reduces every <table> in the document to rows of cell text, expanding colspan by repeating
// the cell value so column indices line up the same way html.parser-based logic expects.
function parseTables(html) {
  const tables = [];
  let table = null, row = null, cell = null, text = null, span = 1;
  const tokenRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
  let match;
  while ((match = tokenRe.exec(html))) {
    const [, closing, tagName, attrs, textChunk] = match;
    if (textChunk !== undefined) {
      if (cell) text.push(textChunk);
      continue;
    }
    const tag = tagName.toLowerCase();
    if (!closing) {
      if (tag === "table") table = [];
      else if (tag === "tr" && table) row = [];
      else if ((tag === "td" || tag === "th") && row) {
        cell = true;
        text = [];
        const spanMatch = /colspan\s*=\s*["']?(\d+)/i.exec(attrs);
        span = spanMatch ? parseInt(spanMatch[1], 10) || 1 : 1;
      }
    } else if ((tag === "td" || tag === "th") && cell) {
      const value = decodeEntities(text.join("")).replace(/\s+/g, " ").trim();
      for (let i = 0; i < span; i++) row.push(value);
      cell = false;
    } else if (tag === "tr" && row) {
      table.push(row);
      row = null;
    } else if (tag === "table" && table) {
      tables.push(table);
      table = null;
    }
  }
  return tables;
}

function parseDate(value) {
  const cleaned = value.trim().replace(/,/g, "");
  let m = /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/.exec(cleaned);
  if (m) return isoDate(m[3], MONTHS[m[1].toLowerCase()], m[2]);
  m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(cleaned);
  if (m) return isoDate(m[3], MONTHS[m[2].toLowerCase()], m[1]);
  m = /^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/.exec(cleaned);
  if (m) return isoDate(m[3], MONTHS[m[2].toLowerCase()] || monthAbbrev(m[2]), m[1]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned);
  if (m) return isoDate(m[3], m[2], m[1]);
  throw new UserError(`unrecognised date: ${value}`);
}

const ABBREV = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function monthAbbrev(name) {
  return ABBREV[name.slice(0, 3).toLowerCase()];
}

function isoDate(year, month, day) {
  const y = String(year).padStart(4, "0");
  const mo = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function number(raw) {
  const cleaned = raw.replace(/,/g, "").replace(/₹/g, "").trim();
  if (!cleaned) throw new UserError("A required financial value is blank");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new UserError("Invalid financial value");
  return value;
}

/**
 * Parses raw NSDL report bytes (as a UTF-8 string) into
 * { reportDate, periodStart, periodEnd, flows: [[sector, net, auc]], totalNet, totalAuc }.
 */
export function parseDocument(html) {
  const tables = parseTables(html);
  const table = tables.find(
    (t) =>
      t.some((row) => row.some((c) => c.toLowerCase() === "sectors")) &&
      t.flat().join(" ").toLowerCase().includes("net investment"),
  );
  if (!table) throw new UserError("Expected NSDL sector table was not found");

  const headerEnd = table.findIndex((row) => row.some((c) => c.toLowerCase() === "sectors"));
  const header = table.slice(0, headerEnd + 1);
  const lastHeaderRow = header[header.length - 1];
  const sectorCol = lastHeaderRow.findIndex((v) => v.trim().toLowerCase() === "sectors");

  const columnCount = Math.max(...header.map((r) => r.length));
  const netCols = [];
  const aucCols = [];
  for (let i = 0; i < columnCount; i++) {
    const cells = header.filter((r) => i < r.length).map((r) => r[i].toLowerCase());
    const labels = cells.join(" ");
    const directEquity = cells.filter((c) => c === "equity").length >= 2 && !labels.includes("mutual funds");
    if (labels.includes("net investment") && labels.includes("in inr cr") && directEquity) netCols.push(i);
    if (labels.includes("auc as on") && labels.includes("in inr cr") && directEquity) aucCols.push(i);
  }
  if (sectorCol < 0 || !netCols.length || !aucCols.length) {
    throw new UserError("Net Investment / Equity or AUC / Equity column not found");
  }

  const groups = header[0].filter((x) => x.toLowerCase().includes("auc as on"));
  const periods = header[0].filter((x) => x.toLowerCase().includes("net investment"));
  if (!groups.length || !periods.length) throw new UserError("Current report date or period was not found");

  const dateMatch = /([A-Za-z]+\s+\d{1,2},?\s*\d{4})/.exec(groups[groups.length - 1]);
  if (!dateMatch) throw new UserError("Current report date or period was not found");
  const reportDate = parseDate(dateMatch[1]);

  const periodMatch = /([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})/.exec(periods[periods.length - 1]);
  if (!periodMatch) throw new UserError("Current Net Investment period was not recognised");
  const periodStart = isoDate(periodMatch[4], MONTHS[periodMatch[1].toLowerCase()], periodMatch[2]);
  const periodEnd = isoDate(periodMatch[4], MONTHS[periodMatch[1].toLowerCase()], periodMatch[3]);
  if (periodEnd !== reportDate) throw new UserError("Net Investment period and AUC report date do not reconcile");

  const flows = [];
  const names = new Set();
  let total = null;
  const lastNetCol = netCols[netCols.length - 1];
  const lastAucCol = aucCols[aucCols.length - 1];
  for (const row of table.slice(headerEnd + 1)) {
    if (!row.some(Boolean)) continue;
    if (row.length <= Math.max(sectorCol, lastNetCol, lastAucCol)) {
      throw new UserError("Incomplete sector row; import stopped");
    }
    const sector = row[sectorCol].trim();
    const net = number(row[lastNetCol]);
    const auc = number(row[lastAucCol]);
    if (sector.toLowerCase() === "grand total") {
      total = [net, auc];
      continue;
    }
    const key = sector.toLowerCase();
    if (!sector || names.has(key)) throw new UserError("Blank or duplicate sector name");
    names.add(key);
    flows.push([sector, net, auc]);
  }
  if (flows.length < 10 || flows.length > 100) throw new UserError(`Unexpected sector count: ${flows.length}`);
  if (!total) throw new UserError("Grand Total not found");

  // Each source row is rounded to a whole crore: allow at most half a crore per row plus total rounding.
  const tolerance = (flows.length + 1) * 0.5;
  if (Math.abs(flows.reduce((s, f) => s + f[1], 0) - total[0]) > tolerance) {
    throw new UserError("Grand Total validation failed; import stopped");
  }
  if (Math.abs(flows.reduce((s, f) => s + f[2], 0) - total[1]) > tolerance) {
    throw new UserError("Grand Total validation failed; import stopped");
  }

  return { reportDate, periodStart, periodEnd, flows, totalNet: total[0], totalAuc: total[1] };
}
