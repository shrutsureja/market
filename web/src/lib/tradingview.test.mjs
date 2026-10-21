import test from 'node:test';
import assert from 'node:assert/strict';
import {tradingViewChartUrl,tradingViewLink} from './tradingview.js';

test('company names open the selected NSE chart on TradingView',()=>{
  const company={symbol:'HDFCBANK',series:'EQ'};
  const web='https://in.tradingview.com/chart/1AHJbyIe/?symbol=NSE%3AHDFCBANK';
  assert.equal(tradingViewChartUrl(company),web);
  assert.equal(tradingViewLink(company,false),web);
  assert.equal(tradingViewLink({symbol:'TCS'},false),'https://in.tradingview.com/chart/1AHJbyIe/?symbol=NSE%3ATCS');
  assert.equal(tradingViewLink({symbol:'DUMMY',placeholder:true},true),null);
});

test('Android link requests the TradingView app and falls back to the same chart',()=>{
  const link=tradingViewLink({symbol:'HDFCBANK'},true);
  assert.match(link,/^intent:\/\/in\.tradingview\.com\/chart\/1AHJbyIe\/\?symbol=NSE%3AHDFCBANK#Intent;scheme=https;package=com\.tradingview\.tradingviewapp;/);
  const encoded=link.match(/S\.browser_fallback_url=([^;]+);end$/)?.[1];
  assert.equal(decodeURIComponent(encoded),'https://in.tradingview.com/chart/1AHJbyIe/?symbol=NSE%3AHDFCBANK');
});
