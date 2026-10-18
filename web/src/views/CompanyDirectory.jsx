import {csvRows} from '../../../src/companies.js';
import {useRef,useState} from 'react';
import {request} from '../api.js';
import {CompanyTable} from '../components/CompanyTable.jsx';

const SOURCE_URL='https://www.niftyindices.com/IndexConstituent/ind_niftytotalmarket_list.csv';
const uploaded=value=>new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST';

export function CompanyDirectory({directory,loading,error:loadError,load}) {
  const fileInput=useRef(null);
  const [preview,setPreview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[message,setMessage]=useState('');
  const reset=()=>{setPreview(null);setConfirmed(false);setError('');setMessage('');};
  async function validate(file) {
    setBusy(true);reset();
    try{if(!file)throw Error('Choose a CSV first');if(file.size>1024*1024)throw Error('Choose a CSV smaller than 1 MB');
      const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      const [headers,...rows]=csvRows(text);
      if(!headers||!rows.length||rows.length>5000)throw Error('CSV must contain between 1 and 5,000 companies');
      const tokens=[];
      const encode=row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',');
      for(let offset=0;offset<rows.length;offset+=100){
        const part=[headers,...rows.slice(offset,offset+100)].map(encode).join('\n');
        const chunk=await request('/api/companies/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:part,filename:file.name})});
        tokens.push(chunk.token);
      }
      const draft=await request('/api/companies/combine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tokens})});
      setPreview(await request(`/api/companies/review/${encodeURIComponent(draft.token)}`));
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function replace() {
    setBusy(true);setError('');
    try{const result=await request('/api/companies/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:preview.token,confirmed:true})});
      setPreview(null);setConfirmed(false);setMessage(`Company list saved: ${result.companies.length} entries. Sector tables now use this list.`);await load();
    }catch(e){setError(e.message);setPreview(null);setConfirmed(false);}finally{setBusy(false);}
  }
  return <>
    <section className="panel"><h2>Your company directory</h2><p>Replace the entire company list when the exchange publishes an update. Historical FPI flow reports are unchanged.</p>
      {loading?<p>Loading saved list…</p>:loadError?<div className="alert" role="alert">{loadError} <button onClick={load}>Retry</button></div>:<div className="company-current"><strong>{directory.companies.length} saved entries</strong><span>{directory.metadata?`${directory.metadata.source} · Uploaded ${uploaded(directory.metadata.uploadedAt)}`:'No company list uploaded yet'}</span></div>}
      <p>Use one company list from <a href={SOURCE_URL} target="_blank" rel="noreferrer">Nifty Total Market ↗</a>. Each confirmed upload replaces the entire saved list. The upload date and time are recorded automatically.</p>
      <p className="company-note">Required CSV columns: Company Name, Industry, Symbol, Series, ISIN Code. Files are checked for structure, known sectors, duplicate identifiers and valid ISINs.</p>
      <input ref={fileInput} hidden aria-label="Company CSV" type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{const file=e.target.files[0];e.target.value='';if(file)validate(file);}}/>
      <button className="company-primary" disabled={busy} onClick={()=>fileInput.current.click()}>{busy?'Checking CSV…':'Upload company list'}</button>
      <p>Validation alone does not replace your saved list. The next step asks you to confirm the counts.</p>
      {error&&<div className="alert" role="alert">{error}</div>}{message&&<div className="notice" role="status">{message}</div>}
    </section>
    {preview&&<section className="panel company-review" aria-label="Review replacement"><h2>Review before replacing</h2><p><b>{preview.oldCount} saved entries → {preview.newCount} entries in this CSV</b></p>
      <div className="company-diff"><span>{preview.added} added</span><span>{preview.removed} removed</span><span>{preview.changed} details changed</span><span>{preview.unchanged} unchanged</span></div>
      <p>{preview.placeholders} temporary index entries are included and clearly marked. These have source placeholder identifiers rather than standard ISINs.</p>
      <p>{preview.source} · {preview.filename} · Uploaded {uploaded(preview.uploadedAt)}. Preview expires in 30 minutes. A new list also replaces membership shown beside older flow reports.</p>
      <details><summary>Review sector counts</summary><div className="table-wrap"><table><thead><tr><th>Sector</th><th>Saved</th><th>New</th></tr></thead><tbody>{Object.keys(preview.newSectors).map(s=><tr key={s}><td>{s}</td><td>{preview.oldSectors[s]}</td><td>{preview.newSectors[s]}</td></tr>)}</tbody></table></div></details>
      <details><summary>Review all added, removed and changed companies</summary>{['added','removed','changed'].map(kind=><div key={kind}><h3>{kind}</h3><ul className="company-changes">{preview.changes[kind].map(r=>kind==='changed'?<li key={r.after.isin}>{r.before.name} ({r.before.symbol}, {r.before.sector}, {r.before.series}) → {r.after.name} ({r.after.symbol}, {r.after.sector}, {r.after.series})</li>:<li key={r.isin}>{r.name} · {r.symbol} · {r.sector}</li>)}</ul></div>)}</details>
      <label className="company-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the counts and want to replace all {preview.oldCount} saved entries with these {preview.newCount} entries.</label>
      <div className="company-actions"><button className="company-primary" disabled={!confirmed||busy} onClick={replace}>Confirm replacement</button><button disabled={busy} onClick={reset}>Cancel — keep saved list</button></div>
    </section>}
    {!loading&&!loadError&&directory.metadata&&<section className="panel"><h2>Current saved companies</h2><p>{directory.metadata.source} · Uploaded {uploaded(directory.metadata.uploadedAt)} · {directory.companies.filter(r=>r.placeholder).length} temporary entries</p><CompanyTable key={directory.version} rows={directory.companies}/></section>}
  </>;
}
