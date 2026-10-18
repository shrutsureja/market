import {combineCompanies} from './company-upload.js';
// Single Worker: serves the built React app and the small JSON API behind it. Excel files are
// built in the browser (web/src/lib/xlsx.js) — too CPU-heavy for the free plan's per-request limit.
import { listReports, listFlows, importReport, getReportWithFlows } from "./db.js";
import { UserError } from "./errors.js";
import {getCompanies,previewCompanies,reviewCompanies,confirmCompanies} from './company-db.js';

const MAX_UPLOAD = 10 * 1024 * 1024;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function companyInput(request) {
  // Bound actual streamed bytes, not just the optional Content-Length header.
  if(!request.body)throw new UserError('Upload data is missing');
  const reader=request.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
    if(size>1150000){await reader.cancel();throw new UserError('CSV request is too large (maximum 1 MB file)');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}
  catch{throw new UserError('Invalid upload data; choose a UTF-8 CSV');}
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if(path.startsWith('/api/companies')) {
        if(request.method==='POST') {
          const origin=request.headers.get('Origin');
          if((origin&&origin!==url.origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Cross-origin updates are not allowed'},403);
        }
        if(path==='/api/companies'&&request.method==='GET')return json(await getCompanies(env.DB));
        if(path==='/api/companies/preview'&&request.method==='POST')return json(await previewCompanies(env.DB,await companyInput(request)));
        if(path.startsWith('/api/companies/review/')&&request.method==='GET')return json(await reviewCompanies(env.DB,decodeURIComponent(path.slice('/api/companies/review/'.length))));
        if(path==='/api/companies/combine'&&request.method==='POST')return json(await combineCompanies(env.DB,await companyInput(request)));
        if(path==='/api/companies/confirm'&&request.method==='POST')return json(await confirmCompanies(env.DB,await companyInput(request)));
      }
      if (path === "/api/reports" && request.method === "GET") {
        return json(await listReports(env.DB));
      }
      if ((path === "/api/flows" || path === "/api/flows/latest") && request.method === "GET") {
        return json(await listFlows(env.DB, path.endsWith("/latest")));
      }
      if (path === "/api/reports/import" && request.method === "POST") {
        const length = request.headers.get("Content-Length");
        if (length && Number(length) > MAX_UPLOAD + 65536) {
          throw new UserError("Please choose a report smaller than 10 MB");
        }
        const form = await request.formData();
        const file = form.get("file");
        if (!file || typeof file.arrayBuffer !== "function") throw new UserError("Please choose an HTML report");
        if (file.size > MAX_UPLOAD) throw new UserError("Please choose a report smaller than 10 MB");
        const raw = new Uint8Array(await file.arrayBuffer());
        const filename = (file.name || "report.html").replace(/\\/g, "/").split("/").pop();
        return json(await importReport(env.DB, raw, filename), 201);
      }
      const exportMatch = /^\/api\/reports\/([^/]+)\/export$/.exec(path);
      if (exportMatch && request.method === "GET") {
        const found = await getReportWithFlows(env.DB, decodeURIComponent(exportMatch[1]));
        if (!found) return json({ error: "Report not found" }, 404);
        const { report_date, period_start, period_end } = found.report;
        return json({ report: { report_date, period_start, period_end }, flows: found.flows, source: found.source });
      }
      if (path === "/api" || path.startsWith("/api/")) {
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
