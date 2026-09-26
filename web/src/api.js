export async function request(path,options){
 const response=await fetch(path,options);
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Unable to load reports');
 return data;
}

// Fetches the stored report and builds the workbook here; the spreadsheet library only loads on first use.
export async function downloadExcel(id){
 const [{report,flows,source},{exportWorkbook}]=await Promise.all([request(`/api/reports/${encodeURIComponent(id)}/export`),import('./lib/xlsx.js')]);
 const url=URL.createObjectURL(new Blob([exportWorkbook(report,flows,source)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=Object.assign(document.createElement('a'),{href:url,download:`nsdl-fpi-${report.report_date}.xlsx`});
 link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
