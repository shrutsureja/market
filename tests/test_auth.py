import time
import unittest
from cloud.fpi.auth import claims_allowed
class AuthTests(unittest.TestCase):
    def test_claims(self):
        now=time.time()
        claims=dict(iss='https://fpi-market.cloudflareaccess.com',aud=['audience'],email='owner@example.com',exp=now+60,iat=now-1)
        self.assertTrue(claims_allowed(claims,'fpi-market.cloudflareaccess.com','audience','owner@example.com'))
        for replacement in [dict(exp=now-1),dict(iat=now+60),dict(aud=['other']),dict(email='other@example.com'),dict(iss='https://evil.example')]:
            self.assertFalse(claims_allowed(claims|replacement,'fpi-market.cloudflareaccess.com','audience','owner@example.com'))
        self.assertFalse(claims_allowed(claims,'','',''))
