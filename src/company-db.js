import {parseCompanies,companyDiff} from './companies.js';
import {UserError} from './errors.js';

function decoded(row) {
  if(!row)return {version:null,companies:[],metadata:null};
  const stored=JSON.parse(row.companies_json);
  const companies=stored.map(r=>Array.isArray(r)?{name:r[0],symbol:r[1],series:r[2],isin:r[3],industry:r[4],sector:r[5],placeholder:!!r[6]}:r);
  return {version:row.id,companies,metadata:{filename:row.filename,source:row.source,
    downloadedOn:row.downloaded_on,validatedAt:row.created_at,confirmedAt:row.confirmed_at,sha256:row.sha256}};
}
export async function getCompanies(db) {
  return decoded(await db.prepare('SELECT d.id,d.filename,d.source,d.downloaded_on,d.created_at,d.confirmed_at,d.sha256,d.companies_json FROM company_datasets d JOIN company_directory c ON c.dataset_id=d.id WHERE c.singleton=1').first());
}
export async function previewCompanies(db,input) {
  const {text,filename,source,downloadedOn}=input;
  if(typeof filename!=='string'||filename.length>150||!filename.toLowerCase().endsWith('.csv'))throw new UserError('Choose a .csv file');
  if(!['Nifty Total Market','Nifty 500'].includes(source))throw new UserError('Select the source list');
  if(typeof downloadedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(downloadedOn)||!Number.isFinite(Date.parse(downloadedOn))||new Date(downloadedOn).toISOString().slice(0,10)!==downloadedOn||downloadedOn>new Date().toISOString().slice(0,10))
    throw new UserError('Enter a valid download date, no later than today');
  const companies=parseCompanies(text);
  const current=await getCompanies(db);
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const id=crypto.randomUUID(),now=new Date().toISOString(),expires=new Date(Date.now()+30*60*1000).toISOString();
  // Compact tuples reduce D1 transport/serialization CPU; API responses retain named fields.
  const compact=companies.map(r=>[r.name,r.symbol,r.series,r.isin,r.industry,r.sector,r.placeholder?1:0]);
  await db.batch([
    db.prepare('DELETE FROM company_datasets WHERE confirmed_at IS NULL AND expires_at < ? AND id NOT IN (SELECT dataset_id FROM company_directory WHERE dataset_id IS NOT NULL)').bind(now),
    db.prepare('INSERT INTO company_datasets(id,base_id,filename,source,downloaded_on,created_at,expires_at,sha256,companies_json) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(id,current.version,filename,source,downloadedOn,now,expires,sha,JSON.stringify(compact))]);
  return {token:id,expiresAt:expires,source,downloadedOn,filename,...companyDiff(current.companies,companies)};
}
export async function confirmCompanies(db,input) {
  if(input.confirmed!==true||typeof input.token!=='string')throw new UserError('Review the counts and confirm replacement first');
  const now=new Date().toISOString();
  // One conditional UPDATE is the commit point. A stale tab cannot overwrite a newer list.
  const results=await db.batch([db.prepare(`UPDATE company_directory SET dataset_id=? WHERE singleton=1
    AND EXISTS(SELECT 1 FROM company_datasets d WHERE d.id=? AND d.confirmed_at IS NULL
      AND d.expires_at>? AND d.base_id IS company_directory.dataset_id)`)
    .bind(input.token,input.token,now),
    db.prepare('UPDATE company_datasets SET confirmed_at=? WHERE id=? AND confirmed_at IS NULL AND id=(SELECT dataset_id FROM company_directory WHERE singleton=1)').bind(now,input.token)]);
  if(!results[0].meta.changes)throw new UserError('Preview expired or the list changed since your review. Validate the CSV again.');
  return getCompanies(db);
}
