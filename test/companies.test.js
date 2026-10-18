import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {parseCompanies,companyDiff} from '../src/companies.js';
import {getCompanies,previewCompanies,confirmCompanies} from '../src/company-db.js';
import worker from '../src/worker.js';

const total=readFileSync(new URL('../fixtures/companies/total-market-2026-10-18.csv',import.meta.url),'utf8');
const small=readFileSync(new URL('../fixtures/companies/nifty500-2026-10-18.csv',import.meta.url),'utf8');
const input=(text=total)=>({text,filename:'list.csv',source:'Nifty Total Market',downloadedOn:'2026-10-18'});

function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/0004_company_directory.sql',import.meta.url),'utf8'));
  return {sqlite,prepare(sql){return {bind(...args){return {run:async()=>({meta:{changes:sqlite.prepare(sql).run(...args).changes}}),first:async()=>sqlite.prepare(sql).get(...args)||null};},first:async()=>sqlite.prepare(sql).get()||null};},
    async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}

test('official snapshots: dynamic counts, all sectors, aliases and explicit temporary entries',()=>{
  const rows=parseCompanies(total);assert.equal(rows.length,755);assert.equal(parseCompanies(small).length,501);
  assert.equal(new Set(rows.map(r=>r.sector)).size,22);assert.equal(rows.filter(r=>r.placeholder).length,4);
  assert(rows.some(r=>r.sector==='Oil, Gas & Consumable Fuels'));assert(rows.some(r=>r.sector==='Media, Entertainment & Publication'));
});
test('accepts BOM, CRLF, reordered columns, escaped quotes and quoted commas',()=>{
  const rows=parseCompanies('\uFEFFSymbol,Industry,ISIN Code,Series,Company Name\r\nABB,Capital Goods,INE117A01022,EQ,"Example, ""Quoted"" Ltd."\r\n');
  assert.equal(rows[0].name,'Example, "Quoted" Ltd.');
});
test('rejects malformed, truncated, blank, duplicate, unmapped and invalid financial identifiers',()=>{
  const first=total.split('\n').slice(0,2).join('\n');
  const bad=[total.replace('Industry','Sector'),total.replace('Financial Services','Unknown'),total.replace('INE466L01038','INE466L01039'),
    first+'\n'+first.split('\n')[1],first.replace('360 ONE WAM Ltd.',''),first.replace(',EQ,',',XX,'),first+',extra',first+'\n"unfinished',
    'SYMBOL,NAME OF COMPANY,SERIES\nABC,ABC,EQ',total.replace('DUM545A01024','INE000000000')];
  for(const text of bad)assert.throws(()=>parseCompanies(text));
});
test('diff counts renames and sector changes by ISIN, independent of row order',()=>{
  const rows=parseCompanies(total),next=rows.slice(1);next[0]={...next[0],name:'Renamed company',sector:'Textiles'};
  const diff=companyDiff(rows,next);assert.equal(diff.removed,1);assert.equal(diff.changed,1);assert.equal(diff.added,0);
  assert.equal(diff.unchanged+diff.added+diff.changed,diff.newCount);
});
test('preview does not mutate active data; validation failure and cancel preserve it; confirmed replacement is complete',async()=>{
  const db=database();try{
    const p=await previewCompanies(db,input());assert.equal((await getCompanies(db)).companies.length,0);assert.equal(p.newCount,755);
    await assert.rejects(()=>confirmCompanies(db,{token:p.token}),/confirm/);
    await confirmCompanies(db,{token:p.token,confirmed:true});assert.equal((await getCompanies(db)).companies.length,755);
    await assert.rejects(()=>previewCompanies(db,input('bad')));assert.equal((await getCompanies(db)).companies.length,755);
    const canceled=await previewCompanies(db,input(small));assert.equal((await getCompanies(db)).version,p.token);
    assert.equal(canceled.oldCount,755);assert.equal(canceled.newCount,501);
    await confirmCompanies(db,{token:canceled.token,confirmed:true});assert.equal((await getCompanies(db)).companies.length,501);
    await assert.rejects(()=>confirmCompanies(db,{token:canceled.token,confirmed:true}),/changed/);
  }finally{db.sqlite.close();}
});
test('stale confirmations and expired tokens cannot replace newer data',async()=>{
  const db=database();try{
    const a=await previewCompanies(db,input()),b=await previewCompanies(db,input(small));
    await confirmCompanies(db,{token:a.token,confirmed:true});
    await assert.rejects(()=>confirmCompanies(db,{token:b.token,confirmed:true}),/changed/);
    const c=await previewCompanies(db,input(small));db.sqlite.prepare('UPDATE company_datasets SET expires_at=? WHERE id=?').run('2000-01-01',c.token);
    await assert.rejects(()=>confirmCompanies(db,{token:c.token,confirmed:true}),/expired/);
    assert.equal((await getCompanies(db)).version,a.token);
  }finally{db.sqlite.close();}
});
test('transaction failure rolls back replacement',async()=>{
  const db=database();try{
    const a=await previewCompanies(db,input());await confirmCompanies(db,{token:a.token,confirmed:true});
    const b=await previewCompanies(db,input(small));
    db.sqlite.exec("CREATE TRIGGER reject_confirmation BEFORE UPDATE OF confirmed_at ON company_datasets BEGIN SELECT RAISE(ABORT,'test failure'); END");
    await assert.rejects(()=>confirmCompanies(db,{token:b.token,confirmed:true}));
    assert.equal((await getCompanies(db)).version,a.token);
  }finally{db.sqlite.close();}
});
test('API rejects cross-origin writes, oversized payloads and bad JSON',async()=>{
  for(const req of [new Request('https://example.com/api/companies/preview',{method:'POST',headers:{Origin:'https://other.com'},body:'{}'}),
    new Request('https://example.com/api/companies/preview',{method:'POST',body:'x'.repeat(1150001)}),
    new Request('https://example.com/api/companies/confirm',{method:'POST',body:'invalid'})]){
    const response=await worker.fetch(req,{});assert([400,403].includes(response.status));assert((await response.json()).error);
  }
});
