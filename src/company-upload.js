import {UserError} from './errors.js';

// Assembly and cross-chunk uniqueness checks run in SQLite, avoiding a full-file JS pass.
export async function combineCompanies(db,{tokens}) {
  if(!Array.isArray(tokens)||!tokens.length||tokens.length>50||tokens.some(t=>typeof t!=='string'||t.length!==36)||new Set(tokens).size!==tokens.length)
    throw new UserError('Invalid upload batches; choose the CSV again');
  const slots=tokens.map(()=>'?').join(','),now=new Date().toISOString();
  const [parts,current]=await Promise.all([
    db.prepare(`SELECT count(*) AS count,count(DISTINCT filename) AS names,
      count(DISTINCT coalesce(base_id,'')) AS bases,min(base_id) AS base_id,min(filename) AS filename,
      min(created_at) AS created_at,min(expires_at) AS expires_at,json_group_array(sha256) AS hashes
      FROM company_datasets WHERE id IN (${slots}) AND is_chunk=1 AND confirmed_at IS NULL AND expires_at>?`).bind(...tokens,now).first(),
    db.prepare('SELECT dataset_id FROM company_directory WHERE singleton=1').first()]);
  if(parts.count!==tokens.length||parts.names!==1||parts.bases!==1||parts.base_id!==current.dataset_id)
    throw new UserError('Upload expired or the saved list changed. Choose the CSV again.');
  const counts=await db.prepare(`SELECT count(*) AS total,count(DISTINCT json_extract(j.value,'$[1]')) AS symbols,
    count(DISTINCT json_extract(j.value,'$[3]')) AS isins FROM company_datasets d,json_each(d.companies_json) j
    WHERE d.id IN (${slots})`).bind(...tokens).first();
  if(!counts.total||counts.total>5000||counts.total!==counts.symbols||counts.total!==counts.isins)
    throw new UserError('CSV contains duplicate symbols or ISINs, or an invalid company count. The saved list has not changed.');
  const id=crypto.randomUUID();
  // Digest identifies the validated batch set, independent of request ordering.
  const hashes=JSON.parse(parts.hashes).sort().join('');
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(hashes)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  await db.prepare(`INSERT INTO company_datasets(id,base_id,filename,source,downloaded_on,created_at,expires_at,sha256,companies_json)
    SELECT ?,?,?,'Nifty Total Market',?,?,?,?,json_group_array(json(j.value))
    FROM (SELECT j.value FROM company_datasets d,json_each(d.companies_json) j WHERE d.id IN (${slots})
      ORDER BY json_extract(j.value,'$[0]') COLLATE NOCASE) j`)
    .bind(id,parts.base_id,parts.filename,parts.created_at.slice(0,10),parts.created_at,parts.expires_at,sha,...tokens).run();
  return {token:id};
}
