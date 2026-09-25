"""Create named, private resources after account prerequisites are satisfied."""
import argparse
import json
from pathlib import Path
from scripts.cloudflare import api,credentials
from scripts.deployment import preflight,validate_config


def provision(environment, owner):
    if environment not in ('staging','production') or '@' not in owner:
        raise ValueError('Choose staging/production and supply the confirmed account owner email')
    existing=preflight()  # No mutations until storage and identity are available.
    account=credentials();prefix=f'/accounts/{account}'
    name='fpi-market-staging' if environment=='staging' else 'fpi-market'
    hostname=name+'.shrutsureja.com' if environment=='staging' else 'fpi.shrutsureja.com'
    bucket=name+'-raw'
    database=next((d for d in existing['d1'] if d['name']==name),None)
    if not database:database=api(prefix+'/d1/database','POST',{'name':name})
    buckets=existing['r2'].get('buckets',[])
    if not any(b['name']==bucket for b in buckets):api(prefix+'/r2/buckets','POST',{'name':bucket})
    # New R2 buckets are private; verify, never attach a public domain.
    if api(prefix+f'/r2/buckets/{bucket}/domains/managed').get('enabled'):
        raise RuntimeError('Existing bucket has public access; refusing to reuse it')
    if api(prefix+f'/r2/buckets/{bucket}/domains/custom').get('domains'):
        raise RuntimeError('Existing bucket has public domains; refusing to reuse it')
    app=next((a for a in existing['apps'] if a.get('domain')==hostname),None)
    if not app:
        app=api(prefix+'/access/apps','POST',{'name':name,'domain':hostname,'type':'self_hosted',
            'session_duration':'1h','allowed_idps':[p['id'] for p in existing['providers']],
            'policies':[{'name':name+'-owner','decision':'allow','include':[{'email':{'email':owner}}]}]})
    config=json.loads(Path('wrangler.jsonc').read_text())
    config.pop('env',None)
    config['name']=name
    config['routes']=[{'pattern':hostname,'custom_domain':True}]
    config['vars']={'ACCESS_TEAM_DOMAIN':existing['organization']['auth_domain'],'ACCESS_AUD':app['aud'],'OWNER_EMAIL':owner}
    config['d1_databases'][0].update(database_name=name,database_id=database['uuid'])
    config['r2_buckets'][0]['bucket_name']=bucket
    validate_config(config)
    preflight(config)
    path=Path(f'wrangler.{environment}.json')
    path.write_text(json.dumps(config,indent=2)+'\n')
    print(json.dumps({'config':str(path),'database_id':database['uuid'],'bucket':bucket,'access_application_id':app['id'],'hostname':hostname},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('environment',choices=['staging','production'])
    parser.add_argument('--owner-email',required=True)
    args=parser.parse_args()
    provision(args.environment,args.owner_email)
