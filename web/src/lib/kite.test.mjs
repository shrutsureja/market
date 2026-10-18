import test from 'node:test';
import assert from 'node:assert/strict';
import {parseKiteInstruments,kiteChartUrl,kiteChartUrlForCompany} from './kite.js';

test('Zerodha NSE instrument rows resolve supplied symbols and tokens',()=>{
  const rows=`instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange
5478657,21401,TATAGOLD,"TATA GOLD ETF",0,,0,0.01,1,EQ,NSE,NSE
877057,3426,TATAPOWER,"TATA POWER CO",0,,0,0.05,1,EQ,NSE,NSE
884737,3456,TMPV,"TATA MOTORS PASS VEH",0,,0,0.05,1,EQ,NSE,NSE
4268801,16675,BAJAJFINSV,"BAJAJ FINSERV",0,,0,0.1,1,EQ,NSE,NSE
1076225,4204,MOTHERSON,"SAMVRDHNA MTHRSN INTL",0,,0,0.01,1,EQ,NSE,NSE
2402049,9383,EMBASSY-RR,"EMBASSY OFFICE PARKS REIT",0,,0,0.01,1,EQ,NSE,NSE
194085633,758147,LOTUSDEV-BE,"SRI LOTUS DEVLPRS N RTY L",0,,0,0.01,1,EQ,NSE,NSE
693505,2709,MTARTECH,"MTAR TECHNOLOGIES",0,,0,0.5,1,EQ,NSE,NSE
999,1,TATAPOWER,"Other exchange",0,,0,0.05,1,EQ,BSE,BSE`;
  const tokens=parseKiteInstruments(rows);
  assert.equal(tokens.size,8);
  assert.equal(kiteChartUrl('TATAGOLD',tokens.get('TATAGOLD')),'https://kite.zerodha.com/markets/chart/web/ciq/NSE/TATAGOLD/5478657');
  assert.equal(kiteChartUrl('TATAPOWER',tokens.get('TATAPOWER')),'https://kite.zerodha.com/markets/chart/web/ciq/NSE/TATAPOWER/877057');
  assert.equal(kiteChartUrl('TMPV',tokens.get('TMPV')),'https://kite.zerodha.com/markets/chart/web/ciq/NSE/TMPV/884737');
  assert.equal(kiteChartUrl('BAJAJFINSV',tokens.get('BAJAJFINSV')),'https://kite.zerodha.com/markets/chart/web/ciq/NSE/BAJAJFINSV/4268801');
  assert.equal(kiteChartUrl('MOTHERSON',tokens.get('MOTHERSON')),'https://kite.zerodha.com/markets/chart/web/ciq/NSE/MOTHERSON/1076225');
  assert.equal(kiteChartUrlForCompany({symbol:'EMBASSY',series:'RR'},tokens),'https://kite.zerodha.com/markets/chart/web/ciq/NSE/EMBASSY-RR/2402049');
  assert.equal(kiteChartUrlForCompany({symbol:'LOTUSDEV',series:'BE'},tokens),'https://kite.zerodha.com/markets/chart/web/ciq/NSE/LOTUSDEV-BE/194085633');
  assert.equal(kiteChartUrlForCompany({symbol:'MTARTECH',series:'BE'},tokens),'https://kite.zerodha.com/markets/chart/web/ciq/NSE/MTARTECH/693505');
  assert.equal(kiteChartUrlForCompany({symbol:'EMBASSY',series:'RR',placeholder:true},tokens),null);
  assert.equal(kiteChartUrlForCompany({symbol:'MISSING',series:'EQ'},tokens),null);
});
