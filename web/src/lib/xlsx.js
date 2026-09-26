// Builds a fortnight's Excel download in the browser: the NSDL page as published, plus the
// equity-only summary the dashboard is built on. Loaded on demand — see downloadExcel in api.js.
import XLSX from "xlsx-js-style";

const { encode_cell, encode_range } = XLSX.utils;
const INTEGER_FORMAT = "#,##0;[Red]-#,##0";
const NUMERIC = /^-?[\d,]*\d(\.\d+)?$/;
const TITLE = { font: { bold: true, sz: 14 } };
const HEADING = { font: { bold: true } };
const headerStyle = (horizontal) => ({
  font: { bold: true },
  fill: { patternType: "solid", fgColor: { rgb: "EAF2FC" } },
  alignment: { horizontal, vertical: "center", wrapText: true },
});
// Group labels span up to 24 columns; centred, they'd sit far off-screen from where the group starts.
const GROUP_HEADER = headerStyle("left");
const COLUMN_HEADER = headerStyle("center");
const SUMMARY_HEADER = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "387ED1" } } };

function cellFor(text, style) {
  if (NUMERIC.test(text)) {
    const v = Number(text.replace(/,/g, ""));
    return { t: "n", v, z: Number.isInteger(v) ? INTEGER_FORMAT : undefined, s: style };
  }
  return { t: "s", v: text, s: style };
}

// Lays blocks out top to bottom: text blocks as headings, tables with their colspans merged,
// numbers stored as numbers so they can be summed and filtered. Column widths fit the content;
// single-cell rows (notes) are left out of that so they just overflow to the right.
function blocksSheet(blocks) {
  const sheet = {};
  const merges = [];
  const rowHeights = [];
  const widths = [];
  const fit = (c, chars) => (widths[c] = Math.max(widths[c] ?? 8, Math.min(chars + 2, 50)));
  let r = 0;
  for (const block of blocks) {
    if (block.type === "text") {
      sheet[encode_cell({ r, c: 0 })] = cellFor(block.text, r === 0 ? TITLE : HEADING);
      r += 2;
      continue;
    }
    for (const row of block.rows) {
      const isHeader = row.length > 1 && !row.some((cell) => NUMERIC.test(cell.text));
      const isTotal = row.some((cell) => /^(grand )?total$/i.test(cell.text));
      let c = 0;
      for (const cell of row) {
        const style = isHeader ? (cell.span > 1 ? GROUP_HEADER : COLUMN_HEADER) : isTotal ? HEADING : undefined;
        if (cell.text) sheet[encode_cell({ r, c })] = cellFor(cell.text, style);
        if (cell.span > 1) merges.push({ s: { r, c }, e: { r, c: c + cell.span - 1 } });
        // Headers wrap onto two lines, so they only need about half their length.
        else if (row.length > 1) fit(c, isHeader ? Math.ceil(cell.text.length / 2) : cell.text.length);
        c += cell.span;
      }
      if (isHeader) rowHeights[r] = { hpt: 30 };
      r++;
    }
    r++;
  }
  const width = Math.max(widths.length, 1);
  sheet["!ref"] = encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(r - 1, 0), c: width - 1 } });
  sheet["!merges"] = merges;
  sheet["!rows"] = rowHeights;
  sheet["!cols"] = Array.from({ length: width }, (_, c) => ({ wch: widths[c] ?? 8 }));
  return sheet;
}

// The sector table is 98 columns wide; the notes and smaller tables below it would otherwise
// share its column widths and get cut off, so they go on a sheet of their own.
function addSourceSheets(workbook, blocks) {
  const main = blocks.findIndex((b) => b.type === "table" && b.rows.some((row) => row.some((cell) => cell.text.toLowerCase() === "sectors")));
  XLSX.utils.book_append_sheet(workbook, blocksSheet(blocks.slice(0, main + 1)), "Sector data");
  if (main + 1 < blocks.length) XLSX.utils.book_append_sheet(workbook, blocksSheet(blocks.slice(main + 1)), "Notes & other tables");
}

function summarySheet(report, flows) {
  const header = ["Report Date", "Period Start", "Period End", "Institution", "Sector", "Equity Net Investment (Cr)", "Equity AUC (Cr)"];
  const rows = flows.map(([sector, net, auc]) => [report.report_date, report.period_start, report.period_end, "FPI", sector, net, auc]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 40 }, { wch: 26 }, { wch: 18 }];
  sheet["!autofilter"] = { ref: sheet["!ref"] };
  header.forEach((_, c) => (sheet[encode_cell({ r: 0, c })].s = SUMMARY_HEADER));
  rows.forEach((_, i) => {
    // Sector names are always text, even if a source value starts with '='.
    sheet[encode_cell({ r: i + 1, c: 4 })].t = "s";
    for (const c of [5, 6]) sheet[encode_cell({ r: i + 1, c })].z = INTEGER_FORMAT;
  });
  return sheet;
}

export function exportWorkbook(report, flows, source) {
  const workbook = XLSX.utils.book_new();
  if (source) addSourceSheets(workbook, source);
  else {
    const note = "This fortnight was added before the full NSDL page was being saved. Upload its HTML file again on the site to include it here.";
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[note]]), "Sector data");
  }
  XLSX.utils.book_append_sheet(workbook, summarySheet(report, flows), "Equity summary");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
