"""Credential-safe Cloudflare API helper. Never logs tokens."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def credentials():
    if not os.environ.get('CLOUDFLARE_API_TOKEN'):
        c = json.loads((Path.home()/'.openclaw/credentials/cloudflare.json').read_text())
        os.environ['CLOUDFLARE_API_TOKEN'] = c['api_token']
        os.environ['CLOUDFLARE_ACCOUNT_ID'] = c['account_id']
    return os.environ['CLOUDFLARE_ACCOUNT_ID']


def api(path, method='GET', data=None):
    credentials()
    req = Request('https://api.cloudflare.com/client/v4'+path, method=method,
                  headers={'Authorization': 'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'], 'Content-Type': 'application/json'},
                  data=json.dumps(data).encode() if data is not None else None)
    try:
        result = json.load(urlopen(req))
    except HTTPError as e:
        raise RuntimeError(f'Cloudflare {method} {path}: {e.code}: {e.read().decode()}') from None
    if not result.get('success'):
        raise RuntimeError(str(result.get('errors')))
    return result['result']

if __name__ == '__main__':
    import sys
    credentials()
    os.execvp(sys.argv[1], sys.argv[1:])
