import json
import unittest
from pathlib import Path
from scripts.deployment import validate_config
class DeploymentTests(unittest.TestCase):
    def test_template_cannot_deploy(self):
        config=json.loads(Path('wrangler.jsonc').read_text())
        with self.assertRaises(ValueError):validate_config(config)
    def test_open_routing_rejected(self):
        config={'name':'fpi-market','workers_dev':False,'preview_urls':False,
          'assets':{'run_worker_first':True},'vars':{'ACCESS_TEAM_DOMAIN':'example.cloudflareaccess.com','ACCESS_AUD':'aud','OWNER_EMAIL':'owner@example.com'},
          'd1_databases':[{'database_id':'12345678-1234-1234-1234-123456789abc'}],
          'r2_buckets':[{'bucket_name':'fpi-market-raw'}],
          'routes':[{'pattern':'fpi.shrutsureja.com','custom_domain':True}]}
        validate_config(config)
        for update in [{'workers_dev':True},{'preview_urls':True},{'assets':{'run_worker_first':False}},{'vars':config['vars']|{'LOCAL_TEST':'true'}}]:
            with self.assertRaises(ValueError):validate_config(config|update)
