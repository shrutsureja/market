import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request, exportUrl} from './api.js';
test('shared origin requests and Excel URLs preserve contracts',async()=>{
 const previous=globalThis.fetch;
 const body=new FormData();body.append('file',new Blob(['report']),'report.html');
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/reports/import');assert.equal(options.body,body);return {ok:true,json:async()=>({sectorCount:24})}};
 try {assert.deepEqual(await request('/api/reports/import',{method:'POST',body}),{sectorCount:24});assert.equal(exportUrl('abc'),'/export/abc')} finally {globalThis.fetch=previous}
});
test('server errors are visible',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>({ok:false,json:async()=>({error:'duplicate'})});
 try{await assert.rejects(request('/api/reports'),/duplicate/)}finally{globalThis.fetch=previous}
});
