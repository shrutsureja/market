import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from './api.js';
test('requests keep the shared-origin API contract',async()=>{
 const previous=globalThis.fetch;
 const body=new FormData();body.append('file',new Blob(['report']),'report.html');
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/reports/import');assert.equal(options.body,body);return {ok:true,json:async()=>({sectorCount:24})}};
 try {assert.deepEqual(await request('/api/reports/import',{method:'POST',body}),{sectorCount:24})} finally {globalThis.fetch=previous}
});
test('server errors are visible',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>({ok:false,json:async()=>({error:'duplicate'})});
 try{await assert.rejects(request('/api/reports'),/duplicate/)}finally{globalThis.fetch=previous}
});
