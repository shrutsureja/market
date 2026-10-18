import {parseCompanies,companyDiff,SECTORS} from './companies.js';
import {UserError} from './errors.js';

function decoded(row) {
  if(!row)return {version:null,companies:[],metadata:null};
  const stored=JSON.parse(row.companies_json);
  const companies=stored.map(r=>Array.isArray(r)?{name:r[0],symbol:r[1],series:r[2],isin:r[3],industry:typeof r[4]==='number'?(r[5]||SECTORS[r[4]]):r[4],sector:typeof r[4]==='number'?SECTORS[r[4]]:r[5],placeholder:!!r[6]}:r);
  return {version:row.id,companies,metadata:{filename:row.filename,source:row.source,
    uploadedAt:row.created_at,validatedAt:row.created_at,confirmedAt:row.confirmed_at,sha256:row.sha256}};
}
export async function getCompanies(db) {
  return decoded(await db.prepare('SELECT d.id,d.filename,d.source,d.downloaded_on,d.created_at,d.confirmed_at,d.sha256,d.companies_json FROM company_datasets d JOIN company_directory c ON c.dataset_id=d.id WHERE c.singleton=1').first());
}
export async function previewCompanies(db,input) {
  const {text,filename}=input;
  const source='Nifty Total Market';
  const now=new Date().toISOString();
  // Keep the legacy required date column populated; upload time is server-owned.
  const downloadedOn=now.slice(0,10);
  if(typeof filename!=='string'||filename.length>150||!filename.toLowerCase().endsWith('.csv'))throw new UserError('Choose a .csv file');
  const companies=parseCompanies(text,100);
  const current=await db.prepare('SELECT dataset_id FROM company_directory WHERE singleton=1').first();
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const id=crypto.randomUUID(),expires=new Date(Date.now()+30*60*1000).toISOString();
  // Compact tuples reduce D1 transport/serialization CPU; API responses retain named fields.
  const compact=companies.map(r=>[r.name,r.symbol,r.series,r.isin,SECTORS.indexOf(r.sector),r.industry===r.sector?null:r.industry,r.placeholder?1:0]);
  await db.batch([
    db.prepare('DELETE FROM company_datasets WHERE confirmed_at IS NULL AND expires_at < ? AND id NOT IN (SELECT dataset_id FROM company_directory WHERE dataset_id IS NOT NULL)').bind(now),
    db.prepare('INSERT INTO company_datasets(id,base_id,filename,source,downloaded_on,created_at,expires_at,sha256,companies_json,is_chunk) VALUES(?,?,?,?,?,?,?,?,?,1)')
      .bind(id,current.dataset_id,filename,source,downloadedOn,now,expires,sha,JSON.stringify(compact))]);
  return {token:id};
}
// Comparison is a second request so validation/storage and diffing have separate CPU budgets.
export async function reviewCompanies(db,token) {
  const [draft,current]=await Promise.all([
    db.prepare('SELECT id,base_id,filename,source,created_at,expires_at,confirmed_at,sha256,companies_json FROM company_datasets WHERE id=? AND is_chunk=0').bind(token).first(),
    getCompanies(db)]);
  if(!draft||draft.confirmed_at||draft.expires_at<=new Date().toISOString()||draft.base_id!==current.version)
    throw new UserError('Preview expired or the list changed since your review. Upload the CSV again.');
  return {token,expiresAt:draft.expires_at,source:draft.source,uploadedAt:draft.created_at,filename:draft.filename,
    ...companyDiff(current.companies,decoded(draft).companies)};
}
export async function confirmCompanies(db,input) {
  if(input.confirmed!==true||typeof input.token!=='string')throw new UserError('Review the counts and confirm replacement first');
  const now=new Date().toISOString();
  // One conditional UPDATE is the commit point. A stale tab cannot overwrite a newer list.
  const results=await db.batch([db.prepare(`UPDATE company_directory SET dataset_id=? WHERE singleton=1
    AND EXISTS(SELECT 1 FROM company_datasets d WHERE d.id=? AND d.confirmed_at IS NULL AND d.is_chunk=0
      AND d.expires_at>? AND d.base_id IS company_directory.dataset_id)`)
    .bind(input.token,input.token,now),
    db.prepare('UPDATE company_datasets SET confirmed_at=? WHERE id=? AND confirmed_at IS NULL AND id=(SELECT dataset_id FROM company_directory WHERE singleton=1)').bind(now,input.token)]);
  if(!results[0].meta.changes)throw new UserError('Preview expired or the list changed since your review. Validate the CSV again.');
  return getCompanies(db);
}
