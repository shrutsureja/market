import { UserError } from './errors.js';

// These are sector-level values in the constituent files, despite the column name Industry.
// Only documented punctuation aliases are mapped; unknown labels must be reviewed, never guessed.
export const SECTORS = ['Automobile and Auto Components','Capital Goods','Chemicals','Construction',
  'Construction Materials','Consumer Durables','Consumer Services','Diversified',
  'Fast Moving Consumer Goods','Financial Services','Forest Materials','Healthcare',
  'Information Technology','Media, Entertainment & Publication','Metals & Mining',
  'Oil, Gas & Consumable Fuels','Power','Realty','Services','Telecommunication','Textiles','Utilities'];
const aliases = new Map(SECTORS.map(s => [s.toLowerCase(),s]));
aliases.set('media entertainment & publication','Media, Entertainment & Publication');
aliases.set('oil gas & consumable fuels','Oil, Gas & Consumable Fuels');
const HEADERS=['Company Name','Industry','Symbol','Series','ISIN Code'];
export const MAX_CSV_BYTES=1024*1024;

export function csvRows(text) {
  // Official constituent files usually have no quoted cells; avoid a character-by-character
  // walk for that common case. Quoted CSV still uses the strict parser below.
  if(!text.includes('"'))return text.replace(/^\uFEFF/,'').split(/\r\n|\r|\n/).map(line=>line.split(',').map(v=>v.trim())).filter(row=>row.some(Boolean));
  const rows=[]; let row=[],field='',quoted=false,closed=false;
  const cell=()=>{ row.push(field.trim()); field=''; closed=false; };
  const line=()=>{cell();if(row.some(Boolean)) rows.push(row);row=[];};
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) { if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c; continue; }
    if(c===','){cell();continue;}
    if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue;}
    if(c==='"'){if(field||closed)throw new UserError('Malformed CSV quoting');quoted=true;continue;}
    if(closed){if(c===' '||c==='\t')continue;throw new UserError('Unexpected text after a quoted CSV field');}
    field+=c;
  }
  if(quoted)throw new UserError('CSV has an unfinished quoted field');
  if(field||row.length||closed)line();
  return rows;
}

export function validIsin(value) {
  if(!/^IN[A-Z0-9]{9}[0-9]$/.test(value))return false;
  let digits='';for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);digits+=c>=65?String(c-55):value[i];}
  let sum=0;
  for(let i=digits.length-1,n=0;i>=0;i--,n++){let d=Number(digits[i]);if(n%2){d*=2;if(d>9)d-=9;}sum+=d;}
  return sum%10===0;
}

export function parseCompanies(text,maxRows=5000) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_CSV_BYTES)throw new UserError('Choose a UTF-8 CSV smaller than 1 MB');
  const [headers,...rows]=csvRows(text);
  if(!headers||headers.length!==5||new Set(headers).size!==5||!HEADERS.every(h=>headers.includes(h)))
    throw new UserError('Expected columns: Company Name, Industry, Symbol, Series, ISIN Code.');
  if(!rows.length||rows.length>maxRows)throw new UserError(`CSV batch must contain between 1 and ${maxRows} companies`);
  const symbols=new Set(),isins=new Set();
  const indexes=HEADERS.map(h=>headers.indexOf(h));
  return rows.map((row,i)=>{
    const fail=message=>{throw new UserError(`Row ${i+2}: ${message}. The saved list has not changed.`);};
    if(row.length!==headers.length)fail('incorrect number of columns');
    const r={'Company Name':row[indexes[0]],Industry:row[indexes[1]],Symbol:row[indexes[2]],Series:row[indexes[3]],'ISIN Code':row[indexes[4]]};
    if(row.some(v=>!v||v.length>200||/[\x00-\x1f\x7f<>]/.test(v)||/^[=+@]/.test(v)))fail('blank, overlong or invalid field');
    const sector=aliases.get(r.Industry.toLowerCase());
    if(!sector)fail(`unrecognised industry "${r.Industry}"; classification mapping needs review`);
    if(!/^[A-Z0-9][A-Z0-9&.\-]{0,39}$/.test(r.Symbol))fail('invalid symbol');
    if(!['EQ','BE','RR'].includes(r.Series))fail('unsupported series (expected EQ, BE or RR)');
    const placeholder=/^Dummy /i.test(r['Company Name'])&&/^DUMMY[A-Z0-9]+$/.test(r.Symbol)&&/^DU[A-Z0-9]{10}$/.test(r['ISIN Code']);
    if(!placeholder&&!validIsin(r['ISIN Code']))fail('invalid ISIN or checksum');
    if(symbols.has(r.Symbol)||isins.has(r['ISIN Code']))fail('duplicate symbol or ISIN');
    symbols.add(r.Symbol); isins.add(r['ISIN Code']);
    return {name:r['Company Name'],symbol:r.Symbol,series:r.Series,isin:r['ISIN Code'],industry:r.Industry,sector,placeholder};
  }).sort((a,b)=>{const x=a.name.toLowerCase(),y=b.name.toLowerCase();return x<y?-1:x>y?1:0;});
}

export function companyDiff(oldRows,newRows) {
  const old=new Map(oldRows.map(r=>[r.isin,r])),fresh=new Map(newRows.map(r=>[r.isin,r]));
  const added=newRows.filter(r=>!old.has(r.isin)),removed=oldRows.filter(r=>!fresh.has(r.isin));
  const changed=newRows.filter(r=>old.has(r.isin)&&['name','symbol','series','sector','industry'].some(k=>r[k]!==old.get(r.isin)[k]));
  const counts=rows=>{const result=Object.fromEntries(SECTORS.map(s=>[s,0]));for(const r of rows)result[r.sector]++;return result;};
  return {oldCount:oldRows.length,newCount:newRows.length,added:added.length,removed:removed.length,changed:changed.length,
    unchanged:newRows.length-added.length-changed.length,placeholders:newRows.filter(r=>r.placeholder).length,oldSectors:counts(oldRows),newSectors:counts(newRows),
    changes:{added,removed,changed:changed.map(r=>({before:old.get(r.isin),after:r}))}};
}
