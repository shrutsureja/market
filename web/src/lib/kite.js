export function parseKiteInstruments(csv) {
  const tokens=new Map();
  for(const line of csv.split(/\r?\n/)) {
    if(!line.endsWith(',EQ,NSE,NSE'))continue;
    const match=/^(\d+),\d+,([A-Z0-9][A-Z0-9&.\-]{0,39}),/.exec(line);
    if(match)tokens.set(match[2],match[1]);
  }
  return tokens;
}

export function kiteChartUrl(symbol,token) {
  return `https://kite.zerodha.com/markets/chart/web/ciq/NSE/${encodeURIComponent(symbol)}/${token}`;
}

export function kiteChartUrlForCompany(company,tokens) {
  if(company.placeholder)return null;
  const seriesSymbol=`${company.symbol}-${company.series}`;
  const symbol=company.series!=='EQ'&&tokens.has(seriesSymbol)?seriesSymbol:company.symbol;
  const token=tokens.get(symbol);
  return token?kiteChartUrl(symbol,token):null;
}
