import hashlib
import sqlite3
import unittest
from pathlib import Path
from cloud.fpi.store import Store

class Statement:
    def __init__(self, db, sql, args=()): self.db,self.sql,self.args=db,sql,args
    def bind(self,*args): return Statement(self.db,self.sql,args)
    async def run(self):
        with self.db.db: self.db.db.execute(self.sql,self.args)
    async def all(self): return {'results':[dict(r) for r in self.db.db.execute(self.sql,self.args)]}
class Database:
    def __init__(self):
        self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row
        self.db.executescript(Path('migrations/0001_initial.sql').read_text())
    def prepare(self,sql): return Statement(self,sql)
    async def batch(self,statements):
        with self.db:
            for s in statements:self.db.execute(s.sql,s.args)
class Bucket:
    def __init__(self):self.objects={}
    async def put(self,key,body):self.objects[key]=body

class StoreTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db=Database();self.bucket=Bucket();self.store=Store(self.db,self.bucket)
        self.raw=Path('internal/sources/nsdl/testdata/2026-09-15.html').read_bytes()
    async def test_import_query_export_persistence(self):
        result=await self.store.import_report(self.raw,'report.html')
        self.assertEqual(result['sectorCount'],24)
        reports=await Store(self.db,self.bucket).reports()
        self.assertEqual(reports[0]['totalNet'],-14116)
        self.assertEqual(reports[0]['raw_path'],'raw/'+hashlib.sha256(self.raw).hexdigest()+'.html')
        self.assertEqual(len(await self.store.flows(True)),24)
        self.assertEqual(len(await self.store.flows()),24)
        self.assertIn(reports[0]['raw_path'],self.bucket.objects)
        self.assertEqual(self.db.db.execute('select status from import_attempts').fetchone()[0],'accepted')
    async def test_duplicate_and_malformed_retained(self):
        await self.store.import_report(self.raw,'report.html')
        for raw in [self.raw,b'malformed']:
            with self.assertRaises(ValueError):await self.store.import_report(raw,'bad.html')
        self.assertEqual(self.db.db.execute('select count(*) from flows').fetchone()[0],24)
        self.assertEqual(len(self.bucket.objects),2)
        self.assertEqual([r[0] for r in self.db.db.execute('select status from import_attempts order by rowid')],['accepted','duplicate','failed'])
    async def test_batch_failure_leaves_retryable_attempt(self):
        async def fail(_):raise RuntimeError('database unavailable')
        self.db.batch=fail
        with self.assertRaises(RuntimeError):await self.store.import_report(self.raw,'report.html')
        self.assertEqual(self.db.db.execute('select count(*) from reports').fetchone()[0],0)
        self.assertEqual(len(self.bucket.objects),1)
        self.assertEqual(self.db.db.execute('select status from import_attempts').fetchone()[0],'pending')
    async def test_invalid_totals_and_columns(self):
        for raw in [self.raw.replace(b'>-14,116<',b'>-99,999<'),self.raw.replace(b'Net Investment',b'Unknown Column')]:
            with self.assertRaises(ValueError):await self.store.import_report(raw,'invalid.html')
        self.assertEqual(self.db.db.execute('select count(*) from flows').fetchone()[0],0)

    async def test_mid_batch_failure_rolls_back_every_row(self):
        self.db.db.execute("CREATE TRIGGER reject_flow BEFORE INSERT ON flows WHEN NEW.sector != 'Automobile and Auto Components' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END")
        with self.assertRaises(sqlite3.IntegrityError):
            await self.store.import_report(self.raw,'report.html')
        self.assertEqual(self.db.db.execute('SELECT COUNT(*) FROM reports').fetchone()[0],0)
        self.assertEqual(self.db.db.execute('SELECT COUNT(*) FROM flows').fetchone()[0],0)
        self.assertEqual(self.db.db.execute('SELECT status FROM import_attempts').fetchone()[0],'pending')
