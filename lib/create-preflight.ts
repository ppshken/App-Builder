// Read the current server decision; never cache a business-rule result in the UI.
export async function checkCreateBeforeOpen(table:string,headers?:HeadersInit,signal?:AbortSignal){
 const response=await fetch('/api/data/'+encodeURIComponent(table)+'?create_check=1',{headers,signal,cache:'no-store'}),result=await response.json();
 if(!response.ok||!result.allowed)throw Error(result.message||result.error||'ยังเพิ่มรายการใหม่ไม่ได้');
}
