import unittest
from unittest.mock import patch
from scripts.provision import provision
class ProvisionTests(unittest.TestCase):
    def test_failed_preflight_makes_no_resources(self):
        with patch('scripts.provision.preflight',side_effect=RuntimeError('D1 denied')),patch('scripts.provision.api') as api:
            with self.assertRaises(RuntimeError):provision('production','owner@example.com')
            api.assert_not_called()
    def test_invalid_target_makes_no_requests(self):
        with patch('scripts.provision.preflight') as preflight:
            with self.assertRaises(ValueError):provision('unknown','owner@example.com')
            preflight.assert_not_called()
