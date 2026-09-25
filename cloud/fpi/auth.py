"""Access JWT verification. Missing configuration or unverifiable identity denies access."""
import base64
import json
import time


def claims_allowed(claims, team, audience, owner):
    try:
        return bool(team and audience and owner
                    and claims['iss'] == 'https://'+team
                    and audience in claims['aud']
                    and isinstance(claims['aud'], list)
                    and claims['email'].lower() == owner.lower()
                    and claims['exp'] > time.time()
                    and claims['iat'] <= time.time()+5
                    and claims.get('nbf', 0) <= time.time())
    except (KeyError, TypeError, AttributeError):
        return False


def decode(part):
    return base64.urlsafe_b64decode(part+'='*((-len(part))%4))


async def authorized(request, env):
    from js import crypto, Uint8Array, JSON, fetch
    from pyodide.ffi import to_js
    team = getattr(env, 'ACCESS_TEAM_DOMAIN', '')
    audience = getattr(env, 'ACCESS_AUD', '')
    owner = getattr(env, 'OWNER_EMAIL', '')
    token = request.headers.get('Cf-Access-Jwt-Assertion')
    if not team or not audience or not owner or not token:
        return False
    if not team.endswith('.cloudflareaccess.com') or '/' in team:
        return False
    try:
        header, payload, signature = token.split('.')
        meta, claims = json.loads(decode(header)), json.loads(decode(payload))
        if meta.get('alg') != 'RS256' or not claims_allowed(claims,team,audience,owner): return False
        response = await fetch('https://'+team+'/cdn-cgi/access/certs')
        if not response.ok: return False
        keys = json.loads(await response.text())['keys']
        jwk = next(k for k in keys if k['kid']==meta['kid'] and k['kty']=='RSA')
        algorithm = JSON.parse('{"name":"RSASSA-PKCS1-v1_5","hash":"SHA-256"}')
        key = await crypto.subtle.importKey('jwk',JSON.parse(json.dumps(jwk)),algorithm,False,to_js(['verify']))
        return bool(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,
                    Uint8Array.new(to_js(decode(signature))),Uint8Array.new(to_js((header+'.'+payload).encode()))))
    except Exception:
        return False
