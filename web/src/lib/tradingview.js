const CHART_PATH='/chart/1AHJbyIe/';

export function tradingViewChartUrl(company) {
  if(company.placeholder||!company.symbol)return null;
  return `https://in.tradingview.com${CHART_PATH}?symbol=${encodeURIComponent(`NSE:${company.symbol}`)}`;
}

export function tradingViewLink(company,isAndroid) {
  const webUrl=tradingViewChartUrl(company);
  if(!webUrl)return null;
  if(!isAndroid)return webUrl;
  const {host,pathname,search}=new URL(webUrl);
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.tradingview.tradingviewapp;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
}
