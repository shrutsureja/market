import io
import unittest
from pathlib import Path
from openpyxl import load_workbook
from cloud.fpi.core import parse_document, export_workbook

FIXTURES = Path('internal/sources/nsdl/testdata')

class CoreTests(unittest.TestCase):
    def test_all_sources_and_excel(self):
        for day, total in [('2026-08-15',16621),('2026-08-31',13010),('2026-09-15',-14116)]:
            doc = parse_document((FIXTURES/(day+'.html')).read_bytes())
            self.assertEqual(doc['totalNet'], total)
            self.assertEqual(len(doc['flows']),24)
            wb = load_workbook(io.BytesIO(export_workbook(doc,doc['flows'])))
            rows=list(wb.active.values)
            self.assertEqual(len(rows),25)
            self.assertEqual(rows[1][:3],(day,doc['period_start'],day))
            self.assertEqual(rows[1][4:],doc['flows'][0])
            self.assertIsInstance(rows[1][5],(float,int))
    def test_invalid_document(self):
        with self.assertRaises(ValueError): parse_document(b'bad report')
