// Single Worker: serves the built React app and the small JSON/XLSX API behind it.
import { listReports, listFlows, importReport, getReportWithFlows } from "./db.js";
import { exportWorkbook } from "./xlsx.js";
import { UserError } from "./errors.js";

const MAX_UPLOAD = 10 * 1024 * 1024;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/reports" && request.method === "GET") {
        return json(await listReports(env.DB));
      }
      if ((path === "/api/flows" || path === "/api/flows/latest") && request.method === "GET") {
        return json(await listFlows(env.DB, path.endsWith("/latest")));
      }
      if (path === "/api/reports/import" && request.method === "POST") {
        const length = request.headers.get("Content-Length");
        if (length && Number(length) > MAX_UPLOAD + 65536) {
          throw new Error("Please choose a report smaller than 10 MB");
        }
        const form = await request.formData();
        const file = form.get("file");
        if (!file || typeof file.arrayBuffer !== "function") throw new Error("Please choose an HTML report");
        if (file.size > MAX_UPLOAD) throw new Error("Please choose a report smaller than 10 MB");
        const raw = new Uint8Array(await file.arrayBuffer());
        const filename = (file.name || "report.html").replace(/\\/g, "/").split("/").pop();
        return json(await importReport(env.DB, raw, filename), 201);
      }
      if (path.startsWith("/export/") && request.method === "GET") {
        const id = decodeURIComponent(path.slice("/export/".length));
        const found = await getReportWithFlows(env.DB, id);
        if (!found) return json({ error: "Report not found" }, 404);
        const body = exportWorkbook(found.report, found.flows);
        return new Response(body, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename=fpi-flows-${found.report.report_date}.xlsx`,
            "Cache-Control": "no-store",
          },
        });
      }
      if (path === "/api" || path.startsWith("/api/") || path === "/export" || path.startsWith("/export/")) {
        return json({ error: "Not found" }, 404);
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "Method not allowed" }, 405);
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      if (e instanceof UserError) return json({ error: e.message }, 400);
      console.error(e);
      return json({ error: "Storage or processing failed; please retry" }, 503);
    }
  },
};
