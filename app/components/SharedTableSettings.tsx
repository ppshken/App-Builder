"use client";
import {useRouter} from 'next/navigation';
import SharedDisconnectDialog from './SharedDisconnectDialog';
import {useState} from 'react';
import {Column,blankColumn} from '@/lib/columns';
import TableTabs from './TableTabs';
import EditorDialog from './EditorDialog';
import ColumnEditor from './ColumnEditor';
import Icon from './Icon';
import {sharedRequest} from './shared-table-client';
import {metadataChanged} from './AppShell';
type Table={name:string;label:string;columns:Column[];source_app?:string;schema_stale?:boolean};
export default function SharedTableSettings({table,tables,reload}:{table:Table;tables:Table[];reload:()=>Promise<void>}){
 const router=useRouter();const [disconnecting,setDisconnecting]=useState(false);
 const [editor,setEditor]=useState<{original?:string;column:Column}>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[regen,setRegen]=useState<any>(),[label,setLabel]=useState(table.label);
 async function save(body:Record<string,unknown>){setBusy(true);setError('');setSuccess('');try{await sharedRequest({...body,table:table.name});await reload();metadataChanged();setSuccess('บันทึกแล้ว');return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}}
 async function preview(){setError('');setBusy(true);try{setRegen(await sharedRequest({op:'regen_preview',table:table.name}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="columns-settings-page shared-table-settings"><header className="columns-settings-header"><div className="page-heading"><div><h1>{table.label} <span className="badge">จาก {table.source_app||'ตารางกลาง'}</span></h1><code>{table.name}</code></div><div className="heading-actions"><button className="danger" disabled={busy} onClick={()=>setDisconnecting(true)}>ยกเลิกเชื่อมต่อ</button><button disabled={busy} onClick={preview}><Icon name="refresh"/>รีเจนคอลัมน์</button><button className="primary" disabled={busy} onClick={()=>setEditor({column:{...blankColumn(),name:'local_'+(table.columns.length+1),is_virtual:true}})}><Icon name="formula"/>เพิ่มช่องคำนวณ</button></div></div><TableTabs table={table.name} selected="columns"/></header>
  {error&&<div className="error-banner" role="alert">{error}</div>}{success&&<div className="success-banner" role="status">{success}</div>}{table.schema_stale&&<p className="error-banner">ต้นทางมีการเปลี่ยนคอลัมน์ กรุณารีเจนก่อนบันทึกข้อมูล</p>}
  <section className="panel"><label className="field">ชื่อตารางในแอปนี้<input aria-label="ชื่อตารางในแอปนี้" value={label} onChange={e=>setLabel(e.target.value)}/></label><button disabled={busy} onClick={()=>save({op:'label',label})}>บันทึกชื่อ</button><p className="hint">คอลัมน์จริงแก้ชื่อที่แสดงและเลือก Label ได้ ส่วนชนิดข้อมูล Key และกฎบันทึกควบคุมจากต้นทาง</p>
   <div className="column-grid-scroll"><table><thead><tr><th>คอลัมน์</th><th>ชนิด</th><th>ที่มา</th><th>Label</th><th>จัดการ</th></tr></thead><tbody>{table.columns.map(c=><tr key={c.name}><td>{c.label}<small className="hint">{c.name}</small></td><td>{c.type}</td><td>{c.is_virtual?'คำนวณเฉพาะแอป':'ต้นทาง'}</td><td>{c.is_label?'✓':'—'}</td><td><button aria-label={`ตั้งค่าคอลัมน์ร่วม ${c.name}`} disabled={busy} onClick={()=>setEditor({original:c.name,column:{...c}})}><Icon name="edit"/>ตั้งค่า</button></td></tr>)}</tbody></table></div>
  </section>
  {disconnecting&&<SharedDisconnectDialog tables={[table.name]} onClose={()=>setDisconnecting(false)} onDisconnected={()=>router.push("/data")}/>}
  {editor&&<EditorDialog className="shared-column-dialog" columnDialog={!!editor.column.is_virtual} title={editor.column.is_virtual?'คอลัมน์คำนวณเฉพาะแอป':'การแสดงผลคอลัมน์ร่วม'} busy={busy} onClose={()=>setEditor(undefined)} footer={<><button disabled={busy} onClick={()=>setEditor(undefined)}>ยกเลิก</button>{!!editor.original&&!!editor.column.is_virtual&&<button className="danger" disabled={busy} onClick={async()=>{if(await save({op:'drop_virtual',name:editor.original}))setEditor(undefined);}}>ลบช่องคำนวณ</button>}<button className="primary" disabled={busy} onClick={async()=>{if(await save(editor.column.is_virtual?{op:'virtual',original:editor.original,column:editor.column}:{op:'column',name:editor.original,label:editor.column.label,is_label:!!editor.column.is_label}))setEditor(undefined);}}>บันทึก</button></>}>
   {editor.column.is_virtual?<ColumnEditor column={editor.column} columns={table.columns} tables={tables} onChange={patch=>setEditor({...editor,column:{...editor.column,...patch,is_virtual:true}})} prefix="shared-virtual"/>:<><label className="field">ชื่อที่แสดง<input aria-label="ชื่อที่แสดงคอลัมน์ร่วม" value={editor.column.label} onChange={e=>setEditor({...editor,column:{...editor.column,label:e.target.value}})}/></label><label className="shared-column-label-toggle"><input type="checkbox" checked={!!editor.column.is_label} onChange={e=>setEditor({...editor,column:{...editor.column,is_label:e.target.checked}})}/>ใช้เป็น Label ในแอปนี้</label></>}{error&&<p role="alert" className="error-banner">{error}</p>}
  </EditorDialog>}
  {regen&&<EditorDialog title="ตรวจการรีเจนคอลัมน์" busy={busy} onClose={()=>setRegen(undefined)} footer={<><button disabled={busy} onClick={()=>setRegen(undefined)}>ยกเลิก</button><button className="primary" disabled={busy} onClick={async()=>{if(await save({op:'regen',token:regen.token}))setRegen(undefined);}}>ยืนยันรีเจน</button></>}>
   {(['added','removed','changed'] as const).map((key,i)=><div key={key}><h3>{['เพิ่มใหม่','ถูกลบ','เปลี่ยนแปลง'][i]} · {regen[key].length}</h3><p>{regen[key].map((c:Column)=>c.label+' ('+c.name+')').join(' · ')||'ไม่มี'}</p></div>)}<p className="hint">เก็บ Label และช่องคำนวณที่ตั้งไว้เอง หากมีผลกระทบจะไม่บันทึกการรีเจน</p>{error&&<p className="error-banner" role="alert">{error}</p>}
  </EditorDialog>}
 </div>;
}
