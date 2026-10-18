import {useState} from 'react';
import {useKiteInstruments} from '../hooks/useKiteInstruments.js';
import {kiteChartUrlForCompany} from '../lib/kite.js';

export function CompanyTable({rows}) {
  const [query,setQuery]=useState(''),[page,setPage]=useState(0);
  const {tokens,loading:kiteLoading,error:kiteError}=useKiteInstruments();
  const filtered=rows.filter(r=>[r.name,r.symbol,r.isin].some(v=>v.toLowerCase().includes(query.toLowerCase())));
  const pages=Math.max(1,Math.ceil(filtered.length/25)),current=Math.min(page,pages-1);
  return <><label className="company-search">Find a company or symbol<input className="search" type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Company, symbol or ISIN"/></label>
    {kiteLoading?<p className="company-note">Loading Kite chart links…</p>:kiteError?<p className="company-note" role="alert">{kiteError}. Please retry the page.</p>:null}
    <div className="table-wrap"><table className="company-table"><thead><tr><th>Company / security</th><th>Symbol</th><th>Series</th><th>ISIN / identifier</th><th>Sector</th></tr></thead><tbody>
      {filtered.slice(current*25,(current+1)*25).map(r=>{
        const href=kiteChartUrlForCompany(r,tokens);
        return <tr key={r.isin}><td>{href?<a className="company-chart-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.name} chart on Kite in a new tab`}>{r.name}</a>:r.name}{r.placeholder&&<small className="placeholder-badge">Temporary index entry · not a normal listed stock</small>}</td><td>{r.symbol}</td><td>{r.series}</td><td>{r.isin}</td><td>{r.sector}</td></tr>;
      })}
      {!filtered.length&&<tr><td colSpan="5">No companies match your search.</td></tr>}
    </tbody></table></div><div className="company-pagination"><span>{filtered.length} matching entries · Page {current+1} of {pages}</span><button disabled={current===0} onClick={()=>setPage(current-1)}>Previous</button><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Next</button></div></>;
}

export function SectorCompanies({sector,directory,loading,error,onManage,onRetry}) {
  const rows=directory.companies.filter(c=>c.sector===sector);
  return <section className="panel"><div className="section-header"><div><h2>Companies in {sector}</h2><p>From the current uploaded company list—not individual FPI transactions.</p></div><button className="text-button" onClick={onManage}>Manage company list →</button></div>
    {loading?<p>Loading companies…</p>:error?<div role="alert">{error} <button onClick={onRetry}>Try again</button></div>:!directory.metadata?<p>No company list uploaded yet. Add a Nifty Total Market CSV in Company list.</p>:<>
    <p>{rows.length} entries in this sector · {directory.metadata.source} · Uploaded {new Date(directory.metadata.uploadedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>
    <p className="company-note">This is current list membership, even when viewing an older fortnight. It is not every company in the sector or the exact set of FPI holdings.</p>
    {rows.length?<CompanyTable key={sector+directory.version} rows={rows}/>:<p>No companies from the uploaded list are classified here. This does not mean there are no companies in this sector.</p>}
    </>}
  </section>;
}
