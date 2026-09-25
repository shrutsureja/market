"""Real HTTP tests against pywrangler/workerd or an authenticated deployment."""
import io
import json
import os
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from openpyxl import load_workbook

BASE=os.environ.get('FPI_TEST_URL','http://127.0.0.1:8787')
HEADERS=json.loads(os.environ.get('FPI_TEST_HEADERS','{}'))
def call(path,raw=None,filename='report.html',headers=None):
    hdr=HEADERS| (headers or {})
    if raw is not None:
        boundary='fpi-market-smoke-boundary'
        raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: text/html\r\n\r\n'.encode()+raw+f'\r\n--{boundary}--\r\n'.encode())
        hdr['Content-Type']='multipart/form-data; boundary='+boundary
    req=urllib.request.Request(BASE+path,data=raw,headers=hdr)
    try:r=urllib.request.urlopen(req,timeout=60)
    except urllib.error.HTTPError as e:r=e
    return r.status,r.headers,r.read()

class RuntimeTests(unittest.TestCase):
    def test_01_imports_and_exports(self):
        for day,total in [('2026-08-15',16621),('2026-08-31',13010),('2026-09-15',-14116)]:
            status,_,body=call('/api/reports/import',Path('internal/sources/nsdl/testdata/'+day+'.html').read_bytes())
            self.assertIn(status,[201,400],body)
            if status==400:self.assertIn('already',json.loads(body)['error'])
        status,_,body=call('/api/reports');self.assertEqual(status,200,body)
        reports=json.loads(body);self.assertEqual(len(reports),3)
        for r in reports:
            self.assertEqual(r['totalNet'],{'2026-08-15':16621,'2026-08-31':13010,'2026-09-15':-14116}[r['report_date']])
            status,headers,body=call('/export/'+r['id']);self.assertEqual(status,200,body[:200])
            self.assertIn('spreadsheetml',headers['Content-Type'])
            rows=list(load_workbook(io.BytesIO(body)).active.values);self.assertEqual(len(rows),25)
            from cloud.fpi.core import parse_document
            doc=parse_document(Path('internal/sources/nsdl/testdata/'+r['report_date']+'.html').read_bytes())
            self.assertEqual(sorted(row[4:] for row in rows[1:]),sorted(doc['flows']))
        self.assertEqual(len(json.loads(call('/api/flows')[2])),72)
        self.assertEqual(len(json.loads(call('/api/flows/latest')[2])),24)
    def test_02_validation_and_routing(self):
        raw=Path('internal/sources/nsdl/testdata/2026-09-15.html').read_bytes()
        for invalid in [b'bad report',raw.replace(b'Net Investment',b'Unknown Column'),raw.replace(b'>-14,116<',b'>-99,999<')]:
            self.assertEqual(call('/api/reports/import',invalid)[0],400)
        self.assertEqual(call('/api/reports/import',b'x'*(10*1024*1024+1))[0],400)
        self.assertEqual(call('/api/missing')[0],404)
        self.assertEqual(call('/export/missing')[0],404)
        self.assertEqual(len(json.loads(call('/api/flows')[2])),72)
        status,_,body=call('/');self.assertEqual(status,200);self.assertIn(b'root',body)
        self.assertNotIn(b'localhost',body)
        self.assertEqual(call('/api/reports/import',raw,headers={'Origin':'https://evil.example'})[0],403)

if __name__=='__main__':unittest.main(verbosity=2)
