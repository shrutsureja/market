export const exportUrl=id=>`/export/${encodeURIComponent(id)}`;
export async function request(path,options){
 const response=await fetch(path,options);
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Unable to load reports');
 return data;
}
