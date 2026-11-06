import type Database from 'better-sqlite3';
export function reorderViews(db:Database.Database,input:any){
 if(!['primary','menu'].includes(input.position)||!Array.isArray(input.names)||!input.names.length||input.names.length>1000||input.names.some((n:unknown)=>typeof n!=='string'||n.length>100)||new Set(input.names).size!==input.names.length||!Array.isArray(input.base))throw Error('รายการจัดลำดับเมนูไม่ถูกต้อง');
 return db.transaction(()=>{
  const rows=db.prepare('SELECT name,pos,menu_group FROM _views WHERE position=? ORDER BY pos,name').all(input.position) as {name:string;pos:number;menu_group:string|null}[];
  const snapshot=(items:typeof rows)=>items.map(v=>[v.name,v.pos,v.menu_group||'']);
  if(JSON.stringify(snapshot(rows))!==JSON.stringify(snapshot(input.base))||rows.length!==input.names.length||input.names.some((n:string)=>!rows.some(r=>r.name===n))){const e=Object.assign(Error('เมนูมีการเปลี่ยนแปลง กรุณาปิดแล้วเปิดหน้าจัดลำดับใหม่'),{status:409});throw e;}
  const update=db.prepare('UPDATE _views SET pos=? WHERE name=? AND position=?');
  input.names.forEach((name:string,index:number)=>update.run(index+1,name,input.position));
  return {updated:input.names.length};
 })();
}
