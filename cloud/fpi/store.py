"""D1/R2 persistence. Raw objects survive parsing and transactional database failures."""
import hashlib
import uuid
from datetime import datetime, timezone
from .core import PARSER_VERSION, parse_document


def native(value):
    return value.to_py() if hasattr(value, 'to_py') else value


class Store:
    def __init__(self, db, bucket, binary=lambda b:b, array=lambda a:a):
        self.db, self.bucket, self.binary, self.array = db, bucket, binary, array

    def statement(self, sql, *args):
        return self.db.prepare(sql).bind(*args)

    async def query(self, sql, *args):
        result = native(await self.statement(sql, *args).all())
        return result['results']

    async def reports(self):
        return await self.query('SELECT * FROM reports ORDER BY report_date DESC')

    async def flows(self, latest=False):
        where = 'WHERE r.report_date=(SELECT MAX(report_date) FROM reports)' if latest else ''
        rows = await self.query(f'''SELECT f.*, r.report_date, r.period_start, r.period_end
            FROM flows f JOIN reports r ON r.id=f.report_id {where}
            ORDER BY r.report_date DESC, f.net DESC''')
        return [dict(id=r['report_id']+'-'+r['sector'],sectorName=r['sector'],
                     equityNetInvestmentCr=r['net'],equityAucCr=r['auc'],
                     reportDate=r['report_date'],periodStart=r['period_start'],periodEnd=r['period_end']) for r in rows]

    async def import_report(self, raw, filename):
        if len(raw)>10*1024*1024: raise ValueError('Please choose a report smaller than 10 MB')
        digest = hashlib.sha256(raw).hexdigest()
        key = f'raw/{digest}.html'
        await self.bucket.put(key, self.binary(raw))
        attempt, report_id = uuid.uuid4().hex, uuid.uuid4().hex
        now = datetime.now(timezone.utc).isoformat()
        await self.statement('''INSERT INTO import_attempts
            (id,hash,raw_key,filename,status,parser_version,created_at,updated_at)
            VALUES (?,?,?,?,'pending',?,?,?)''',attempt,digest,key,filename,PARSER_VERSION,now,now).run()
        async def reject(status,error):
            await self.statement('UPDATE import_attempts SET status=?,error=?,updated_at=? WHERE id=?',
                                 status,str(error),datetime.now(timezone.utc).isoformat(),attempt).run()
        try:
            doc = parse_document(raw)
        except (ValueError, AttributeError, IndexError, KeyError) as e:
            await reject('failed',e)
            raise ValueError(str(e)) from e
        async def duplicate():
            return await self.query('SELECT id FROM reports WHERE report_date=? OR hash=?',doc['report_date'],digest)
        if await duplicate():
            message='This fortnight is already in your dashboard'
            await reject('duplicate',message)
            raise ValueError(message)
        statements=[self.statement('''INSERT INTO reports
            (id,report_date,period_start,period_end,filename,raw_path,hash,error,imported_at,parser_version,totalNet,totalAuc)
            VALUES (?,?,?,?,?,?,?,NULL,?,?,?,?)''', report_id,doc['report_date'],doc['period_start'],doc['period_end'],
            filename,key,digest,now,PARSER_VERSION,doc['totalNet'],doc['totalAuc'])]
        statements += [self.statement('INSERT INTO flows VALUES (?,?,?,?)',report_id,*row) for row in doc['flows']]
        statements.append(self.statement("UPDATE import_attempts SET status='accepted',report_id=?,updated_at=? WHERE id=?",report_id,now,attempt))
        try:
            await self.db.batch(self.array(statements))
        except Exception:
            # A competing transaction may have won the uniqueness race. Other failures
            # leave 'pending' plus the raw object so the same file can be retried.
            if await duplicate():
                message='This fortnight is already in your dashboard'
                await reject('duplicate',message)
                raise ValueError(message) from None
            raise
        return dict(id=report_id,reportDate=doc['report_date'],sectorCount=len(doc['flows']))
