// Builds the normalized FPI flows workbook downloaded from /export/:id.
import XLSX from "xlsx-js-style";

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: "146C49" } },
};
const NUMBER_FORMAT = "#,##0;[Red](#,##0);0";

export function exportWorkbook(report, flows) {
  const header = ["Report Date", "Period Start", "Period End", "Institution", "Sector", "Equity Net Investment (Cr)", "Equity AUC (Cr)"];
  const rows = flows.map(([sector, net, auc]) => [
    report.report_date,
    report.period_start,
    report.period_end,
    "FPI",
    sector,
    net,
    auc,
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 44 }, { wch: 30 }, { wch: 25 }];
  sheet["!autofilter"] = { ref: sheet["!ref"] };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  for (let col = 0; col < header.length; col++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: col })];
    if (cell) cell.s = HEADER_STYLE;
  }
  for (let r = 0; r < rows.length; r++) {
    // Sector names are always text, even if a source value starts with '='.
    const sectorCell = sheet[XLSX.utils.encode_cell({ r: r + 1, c: 4 })];
    if (sectorCell) sectorCell.t = "s";
    for (const col of [5, 6]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: r + 1, c: col })];
      if (cell) {
        cell.z = NUMBER_FORMAT;
        cell.s = { font: { name: "Arial", sz: 11 } };
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Normalized FPI Flows");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
