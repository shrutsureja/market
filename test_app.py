import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import app

FIXTURES=Path(__file__).parent/'internal/sources/nsdl/testdata'

class ReportTests(unittest.TestCase):
    def test_source_values(self):
        for filename,start,flow,auc in [('2026-08-15.html','2026-08-01',4405,557414),('2026-08-31.html','2026-08-16',-1299,548262),('2026-09-15.html','2026-09-01',-2670,507517)]:
            with self.subTest(filename=filename):
                d,s,e,rows=app.parse_report((FIXTURES/filename).read_bytes())
                self.assertEqual(str(s),start); self.assertEqual(str(d),filename[:10]); self.assertEqual(d,e)
                self.assertEqual(len(rows),24); self.assertEqual(rows[0],('Automobile and Auto Components',flow,auc))
    def test_changed_classes_and_wrappers(self):
        raw=(FIXTURES/'2026-09-15.html').read_bytes().replace(b'xl',b'changed-class')
        self.assertEqual(app.parse_report(b'<section>'+raw+b'</section>')[3][0][1],-2670)
    def test_rejects_corrupt_number_and_total(self):
        raw=(FIXTURES/'2026-09-15.html').read_bytes()
        for old,new in [(b'>-2,670<',b'>invalid<'),(b'>-14,116<',b'>-99,999<')]:
            with self.subTest(new=new), self.assertRaises(ValueError): app.parse_report(raw.replace(old,new))
    def test_retains_failed_source_and_duplicate_is_atomic(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(app,'DATA',Path(folder)),patch.object(app,'RAW',Path(folder)/'raw'),patch.object(app,'DB',Path(folder)/'test.db'):
            with app.conn() as db:
                with self.assertRaises(ValueError): app.import_report(db,b'bad report','bad.html')
                self.assertEqual(len(list(app.RAW.glob('*.html'))),1)
                raw=(FIXTURES/'2026-09-15.html').read_bytes()
                app.import_report(db,raw,'good.html')
                with self.assertRaises(ValueError): app.import_report(db,raw,'duplicate.html')
                self.assertEqual(db.execute('select count(*) from flows').fetchone()[0],24)

if __name__=='__main__': unittest.main()
