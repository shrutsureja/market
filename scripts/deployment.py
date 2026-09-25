"""Fail-closed preflight and deployment. Run as python -m scripts.deployment."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import uuid
from scripts.cloudflare import api, credentials


def validate_config(config):
    if config.get('workers_dev') is not False or config.get('preview_urls') is not False:
        raise ValueError('Alternate Worker URLs must be disabled')
    if config.get('assets',{}).get('run_worker_first') is not True:
        raise ValueError('All assets must pass authentication')
    variables=config.get('vars',{})
    if variables.get('LOCAL_TEST') or not all(variables.get(k) for k in ('ACCESS_TEAM_DOMAIN','ACCESS_AUD','OWNER_EMAIL')):
        raise ValueError('Verified Access configuration is required; LOCAL_TEST is forbidden')
    if not variables['ACCESS_TEAM_DOMAIN'].endswith('.cloudflareaccess.com'):
        raise ValueError('Invalid Access team domain')
    database=config['d1_databases'][0]['database_id']
    if uuid.UUID(database).int < 2:
        raise ValueError('Real D1 resource ID is required')
    if not config.get('r2_buckets') or not config.get('routes'):
        raise ValueError('Private R2 and custom hostname are required')


def preflight(config=None):
    account=credentials()
    paths={'d1':f'/accounts/{account}/d1/database','r2':f'/accounts/{account}/r2/buckets',
           'organization':f'/accounts/{account}/access/organizations',
           'providers':f'/accounts/{account}/access/identity_providers','apps':f'/accounts/{account}/access/apps'}
    results={};errors=[]
    for key,path in paths.items():
        try:results[key]=api(path)
        except RuntimeError as e:errors.append(str(e))
    if not results.get('providers'):errors.append('No existing Access identity provider; complete Zero Trust identity setup first')
    if errors:raise RuntimeError('\n'.join(errors))
    if config:
        validate_config(config)
        hostname=config['routes'][0]['pattern']
        app=next((a for a in results['apps'] if a.get('domain')==hostname),None)
        if not app or app.get('aud')!=config['vars']['ACCESS_AUD']:
            raise RuntimeError('Access application audience/hostname mismatch')
        policies=api(f'/accounts/{account}/access/apps/{app["id"]}/policies')
        allows=[p for p in policies if p['decision']=='allow']
        if any(p['decision'] in ('bypass','non_identity') for p in policies) or len(allows)!=1:
            raise RuntimeError('Access policy must permit only the owner, without bypass/service-token rules')
        policy=allows[0]
        if policy.get('include')!=[{'email':{'email':config['vars']['OWNER_EMAIL']}}]:
            raise RuntimeError('Access allow policy is not owner-only')
        bucket=config['r2_buckets'][0]['bucket_name']
        managed=api(f'/accounts/{account}/r2/buckets/{bucket}/domains/managed')
        custom=api(f'/accounts/{account}/r2/buckets/{bucket}/domains/custom')
        if managed.get('enabled') or custom.get('domains'):
            raise RuntimeError('R2 bucket is publicly accessible')
    return results


def run(*args):subprocess.run(args,check=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['preflight','deploy'])
    parser.add_argument('--config',default='wrangler.jsonc')
    args=parser.parse_args()
    config=json.loads(Path(args.config).read_text())
    if args.action=='preflight':
        preflight();print('Cloudflare storage and Access prerequisites passed');return
    validate_config(config)
    preflight(config)
    run('uv','run','python','-m','unittest','-v','test_app')
    run('uv','run','python','-m','unittest','discover','-s','tests','-v')
    run('npm','--prefix','web','ci')
    run('npm','--prefix','web','test')
    run('npm','--prefix','web','run','build')
    run('uv','run','python','-m','scripts.test_worker')
    # Remote migrations and deployment occur only after all gates pass.
    run('npx','wrangler','d1','migrations','apply','DB','--remote','--config',args.config)
    run('uv','run','pywrangler','deploy','--config',args.config)
    print('Deployment uploaded. Run authenticated production smoke checks before declaring release verified.')

if __name__=='__main__':main()
