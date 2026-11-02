import {createUuid} from './uuid';
import {MAX_FORM_IMAGE_BYTES,MAX_FORM_IMAGE_COUNT,type FormImageDescriptor} from './form-image-protocol';

type PendingImage = FormImageDescriptor & {file?:File;preview:string;local:boolean};
// Each open form tree owns one store. Files never enter JSON state or a server
// upload queue; child drafts can transfer tokens to their parent without uploads.
export function createPendingImages(urls:Pick<typeof URL,'createObjectURL'|'revokeObjectURL'>=URL) {
  const entries=new Map<string,PendingImage>(),frames=new Map<string,unknown>();
  let disposed=false,scheduled=false;
  function release(entry:PendingImage){if(entry.local)urls.revokeObjectURL(entry.preview);entries.delete(entry.token);}
  function tokens(value:unknown):Set<string>{
    const result=new Set<string>(),seen=new Set<object>(),queue=[value];
    while(queue.length){const item=queue.pop();if(typeof item==='string'){if(entries.has(item))result.add(item);}else if(item&&typeof item==='object'&&!seen.has(item)){seen.add(item);if(!Array.isArray(item)&&(item as any).deleted===true&&typeof (item as any).key==='string'&&(item as any).values)continue;queue.push(...Object.values(item));}}
    return result;
  }
  function prune(){const live=tokens([...frames.values()]);for(const [token,entry] of entries)if(!live.has(token))release(entry);}
  function schedule(){if(scheduled||disposed)return;scheduled=true;queueMicrotask(()=>{scheduled=false;if(!disposed)prune();});}
  function prepare(values:Record<string,any>){
    if(!entries.size)return {values,images:[] as PendingImage[]};
    const selected=new Map<string,PendingImage>();
    function copy(value:any,deleted=false,depth=0):any{
      if(depth>40)throw Error('ข้อมูลฟอร์มซ้อนกันมากเกินไป');
      if(typeof value==='string'){const entry=entries.get(value);if(!entry)return value;if(!entry.local)return entry.preview;if(!deleted)selected.set(value,entry);return value;}
      if(!value||typeof value!=='object')return value;
      if(Array.isArray(value))return value.map(item=>copy(item,deleted,depth+1));
      const removed=deleted||value.deleted===true&&typeof value.key==='string'&&!!value.values;
      return Object.fromEntries(Object.entries(value).filter(([name])=>name!=='__display').map(([name,item])=>[name,copy(item,removed,depth+1)]));
    }
    const body=copy(values),images=[...selected.values()];
    if(images.length>MAX_FORM_IMAGE_COUNT)throw Error('แนบรูปได้ไม่เกิน '+MAX_FORM_IMAGE_COUNT+' รูปต่อการบันทึก');
    if(images.reduce((sum,image)=>sum+(image.file?.size||0),0)>MAX_FORM_IMAGE_BYTES)throw Error('รูปทั้งหมดในฟอร์มรวมกันต้องไม่เกิน 50 MB');
    return {values:body,images};
  }
  return {
    add(table:string,column:string,file:File){if(disposed)throw Error('ฟอร์มถูกปิดแล้ว กรุณาเปิดใหม่');const token='/api/images/'+createUuid();entries.set(token,{token,table,column,file,preview:urls.createObjectURL(file),local:true});return token;},
    preview(value:string){return entries.get(value)?.preview||value;},
    isLocal(value:unknown){return typeof value==='string'&&!!entries.get(value)?.local;},
    setFrame(id:string,value:unknown){if(!disposed){frames.set(id,value);schedule();}},
    removeFrame(id:string){frames.delete(id);schedule();},
    prepare,
    commit(mapping:Record<string,string>){for(const [token,url] of Object.entries(mapping)){const entry=entries.get(token);if(entry?.local){urls.revokeObjectURL(entry.preview);entry.local=false;entry.file=undefined;entry.preview=url;}}},
    dispose(){disposed=true;for(const entry of entries.values())release(entry);frames.clear();},
    prune,
  };
}
export type PendingImages=ReturnType<typeof createPendingImages>;

export async function submitFormWithImages(url:string,method:string,values:Record<string,any>,headers:HeadersInit,store:PendingImages):Promise<Response>{
  const prepared=store.prepare(values),requestHeaders=new Headers(headers);
  let body:BodyInit;
  if(prepared.images.length){const form=new FormData();form.append('values',JSON.stringify(prepared.values));form.append('images',JSON.stringify(prepared.images.map(({token,table,column})=>({token,table,column}))));prepared.images.forEach((image,index)=>form.append('file_'+index,image.file!));requestHeaders.delete('Content-Type');body=form;}
  else{requestHeaders.set('Content-Type','application/json');body=JSON.stringify(prepared.values);}
  const response=await fetch(url,{method,headers:requestHeaders,body});
  if(response.ok&&prepared.images.length){const result=await response.clone().json();if(result.image_urls)store.commit(result.image_urls);}
  return response;
}
