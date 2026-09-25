const {test,expect}=require('@playwright/test');
for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 test(`dashboard navigation and downloads at ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  const failures=[];
  page.on('pageerror',e=>failures.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).origin!==new URL(process.env.FPI_TEST_URL||'http://127.0.0.1:8787').origin)failures.push(r.url())});
  await page.goto(process.env.FPI_TEST_URL||'http://127.0.0.1:8787');
  await expect(page.getByRole('heading',{name:'Where is the money moving?'})).toBeVisible();
  await expect(page.locator('.big-number')).toContainText('14,116');
  for(const view of ['Sector heatmap','Sector detail','Compare periods','Reports','Overview']){
    await page.getByRole('button',{name:view,exact:false}).first().click();
    await expect(page.locator('h1')).toBeVisible();
  }
  const download=page.waitForEvent('download');
  await page.getByRole('link',{name:'Download Excel'}).click();
  expect((await download).suggestedFilename()).toBe('fpi-flows-2026-09-15.xlsx');
  await page.locator('input[type=file]').setInputFiles({name:'invalid.html',mimeType:'text/html',buffer:Buffer.from('bad report')});
  await expect(page.getByRole('status')).toContainText('Expected NSDL sector table');
  expect(failures).toEqual([]);
 });
}
