"""Shared-origin Python Worker: Access gate, API, private storage and React assets."""
from urllib.parse import urlsplit
from workers import WorkerEntrypoint, Response
from js import Uint8Array
from pyodide.ffi import to_js
from fpi.auth import authorized
from fpi.core import export_workbook
from fpi.store import Store

MAX_UPLOAD=10*1024*1024

def binary(data):
    return Uint8Array.new(to_js(data))

def json_response(data,status=200):
    return Response.json(data,status=status,headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        url=urlsplit(request.url)
        # Only the explicitly selected, loopback-only local test configuration bypasses Access.
        local=(getattr(self.env,'LOCAL_TEST','')=='true' and url.hostname in ('127.0.0.1','localhost'))
        if not local and not await authorized(request,self.env):
            return json_response({'error':'Access denied'},403)
        path=url.path
        if request.method not in ('GET','HEAD'):
            origin=request.headers.get('Origin')
            if (origin and origin!=f'{url.scheme}://{url.netloc}') or request.headers.get('Sec-Fetch-Site')=='cross-site':
                return json_response({'error':'Cross-origin writes are not allowed'},403)
        store=Store(self.env.DB,self.env.RAW_UPLOADS,binary)
        try:
            if path=='/api/reports' and request.method=='GET':return json_response(await store.reports())
            if path in ('/api/flows','/api/flows/latest') and request.method=='GET':
                return json_response(await store.flows(path.endswith('/latest')))
            if path=='/api/reports/import' and request.method=='POST':
                length=request.headers.get('Content-Length')
                if length and int(length)>MAX_UPLOAD+65536:raise ValueError('Please choose a report smaller than 10 MB')
                # Bound the actual stream too, including chunked requests without Content-Length.
                reader=request.body.getReader() if request.body else None
                if reader is None:raise ValueError('Please choose an HTML report')
                chunks=[];size=0
                while True:
                    part=await reader.read()
                    if part.done:break
                    chunk=part.value.to_py().tobytes();size+=len(chunk)
                    if size>MAX_UPLOAD+65536:
                        await reader.cancel()
                        raise ValueError('Please choose a report smaller than 10 MB')
                    chunks.append(chunk)
                from js import Response as JSResponse, Object
                from pyodide.ffi import to_js as convert
                body=JSResponse.new(binary(b''.join(chunks)),convert({'headers':{'Content-Type':request.headers.get('Content-Type') or ''}},dict_converter=Object.fromEntries))
                form=await body.formData()
                file=form.get('file')
                if file is None or not hasattr(file,'arrayBuffer'):raise ValueError('Please choose an HTML report')
                if file.size>MAX_UPLOAD:raise ValueError('Please choose a report smaller than 10 MB')
                raw=Uint8Array.new(await file.arrayBuffer()).to_py().tobytes()
                filename=(file.name or 'report.html').replace('\\','/').rsplit('/',1)[-1]
                return json_response(await store.import_report(raw,filename),201)
            if path.startswith('/export/') and request.method=='GET':
                rows=await store.query('SELECT * FROM reports WHERE id=?',path.rsplit('/',1)[-1])
                if not rows:return json_response({'error':'Report not found'},404)
                report=rows[0]
                flows=await store.query('SELECT sector,net,auc FROM flows WHERE report_id=? ORDER BY sector',report['id'])
                body=export_workbook(report,[(f['sector'],f['net'],f['auc']) for f in flows])
                return Response(body,headers={'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':f'attachment; filename=fpi-flows-{report["report_date"]}.xlsx','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
            if path=='/api' or path.startswith('/api/') or path=='/export' or path.startswith('/export/'):
                return json_response({'error':'Not found'},404)
            if request.method not in ('GET','HEAD'):return json_response({'error':'Method not allowed'},405)
            return await self.env.ASSETS.fetch(request)
        except ValueError as e:
            return json_response({'error':str(e)},400)
        except Exception:
            if local:
                import traceback
                traceback.print_exc()
            # No raw source, credentials, or internal binding diagnostics in public errors.
            return json_response({'error':'Storage or processing failed; please retry'},503)
