"""Run isolated workerd/D1/R2, restart persistence, browser and denial checks."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
import urllib.request
import urllib.error
from contextlib import contextmanager


def run(*args, **kwargs):return subprocess.run(args,check=True,**kwargs)

@contextmanager
def server(state,local,port,log):
    command=['uv','run','pywrangler','dev','--ip','127.0.0.1','--port',str(port),'--persist-to',state]
    if local:command+=['--env','local']
    with open(log,'w') as output:
        process=subprocess.Popen(command,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
        try:
            deadline=time.monotonic()+120
            while time.monotonic()<deadline:
                if process.poll() is not None:raise RuntimeError(Path(log).read_text()[-6000:])
                try:
                    urllib.request.urlopen(f'http://127.0.0.1:{port}/api/reports',timeout=1).close();break
                except urllib.error.HTTPError:break
                except (urllib.error.URLError,TimeoutError):time.sleep(.5)
            else:raise RuntimeError('Worker startup timed out: '+Path(log).read_text()[-6000:])
            yield
        finally:
            if process.poll() is None:
                os.killpg(process.pid,signal.SIGTERM)
                try:process.wait(timeout=10)
                except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait()

def get(url):
    with urllib.request.urlopen(url,timeout=60) as response:return json.load(response)

def main():
    with tempfile.TemporaryDirectory(prefix='fpi-market-test-') as folder:
        state=folder+'/state';log=folder+'/worker.log';base='http://127.0.0.1:18787'
        environment=os.environ|{'FPI_TEST_URL':base}
        run('npx','wrangler','d1','migrations','apply','DB','--local','--env','local','--persist-to',state)
        with server(state,True,18787,log):
            run('uv','run','python','-m','unittest','runtime_tests.smoke','-v',env=environment)
            run('npx','playwright','test',env=environment)
            before=get(base+'/api/reports')
        with server(state,True,18787,log):
            assert get(base+'/api/reports')==before,'Report data changed across restart'
            assert len(get(base+'/api/flows'))==72
            run('uv','run','python','-m','unittest','runtime_tests.smoke','-v',env=environment)
        raw=Path('internal/sources/nsdl/testdata/2026-09-15.html').read_bytes()
        for body in [raw,b'bad report']:
            key='raw/'+hashlib.sha256(body).hexdigest()+'.html'
            output=folder+'/object.html'
            run('npx','wrangler','r2','object','get','fpi-market-local-raw/'+key,'--local','--env','local','--persist-to',state,'--file',output)
            assert Path(output).read_bytes()==body,'R2 bytes differ'
        result=run('npx','wrangler','d1','execute','DB','--local','--env','local','--persist-to',state,'--json','--command',
          'SELECT status,COUNT(*) AS count FROM import_attempts GROUP BY status',capture_output=True,text=True)
        counts={r['status']:r['count'] for r in json.loads(result.stdout)[0]['results']}
        assert counts['accepted']==3 and counts['duplicate']>=3 and counts['failed']>=6,counts
        with server(state,False,18788,log):
            for path in ['/','/api/reports','/api/flows','/api/reports/import','/export/id','/assets/example.js']:
                for headers in [{},{'Cf-Access-Jwt-Assertion':'forged.token.value','Cf-Access-Authenticated-User-Email':'owner@example.com'}]:
                    request=urllib.request.Request('http://127.0.0.1:18788'+path,headers=headers,data=b'bad' if path.endswith('/import') else None)
                    try:urllib.request.urlopen(request,timeout=30)
                    except urllib.error.HTTPError as error:assert error.code==403
                    else:raise AssertionError('Anonymous or forged request allowed: '+path)
        print('PASS: workerd API, XLSX, browser, D1/R2, restart persistence and full-origin auth denial')

if __name__=='__main__':main()
