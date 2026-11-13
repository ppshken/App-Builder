import type {ReleasePlan} from '@/lib/release-plan';
import './release-plan.css';

const categories={schema:'โครงสร้าง',configuration:'การตั้งค่า',shared:'ตารางร่วมเฉพาะแอป'};
const kinds:Record<string,string>={create_table:'เพิ่มตาราง',delete_table:'ลบตาราง',alter_table:'เปลี่ยนแหล่งข้อมูลหรือเจ้าของตาราง',create_column:'เพิ่มคอลัมน์',delete_column:'ลบคอลัมน์',alter_column:'เปลี่ยนโครงสร้างคอลัมน์',create_configuration:'เพิ่มการตั้งค่า',delete_configuration:'ลบการตั้งค่า',update_configuration:'แก้ไขการตั้งค่า'};
const risks={low:'ต่ำ',medium:'ปานกลาง',high:'สูง'};

export default function ReleasePlanPanel({plan,publicationAvailable=false}:{plan:ReleasePlan;publicationAvailable?:boolean}){
  const blockers=publicationAvailable?plan.blockers.filter(b=>!['SCHEMA_NOT_SUPPORTED','DEVELOPMENT_PREVIEW_ONLY'].includes(b.code)):plan.blockers;
  return <section className="release-plan" aria-label="ผลเปรียบเทียบและผลกระทบ">
    <div className="release-plan-heading"><div><h3>ผลเปรียบเทียบและผลกระทบ</h3><p>ฉบับร่าง → แอปจริง · ตรวจแบบอ่านอย่างเดียว</p></div><span className="release-plan-tag">ไม่มีการเปลี่ยนข้อมูลจากการตรวจนี้</span></div>
    <div className="release-plan-counts">
      <span>โครงสร้าง <b>{plan.summary.schema}</b></span><span>การตั้งค่า <b>{plan.summary.configuration}</b></span><span>ตารางร่วม <b>{plan.summary.shared}</b></span><span>ข้อขัดแย้ง <b>{plan.summary.conflicts}</b></span>
    </div>
    <p className="hint">นำข้อมูลทดลองไปทับข้อมูลจริงไม่ได้ · สมาชิก รหัสผ่าน และสิทธิ์จริงยังคงเดิม</p>
    {!!blockers.length&&<div className="release-plan-blockers" role="alert"><strong>ยังเผยแพร่ไม่ได้</strong><ul>{[...new Set(blockers.map(b=>b.message))].map(message=><li key={message}>{message}</li>)}</ul></div>}
    {!plan.operations.length&&<p className="hint">ไม่พบความเปลี่ยนแปลงที่ต้องนำจากฉบับร่างไปใช้{plan.summary.liveChanged?' แต่แอปจริงเปลี่ยนหลังสร้างฉบับร่าง':''}</p>}
    {!!plan.conflicts.length&&<details className="release-plan-conflicts"><summary>รายการที่แก้ไขชนกัน ({plan.conflicts.length})</summary>{plan.conflicts.map(c=><p key={c.collection+':'+c.name}><strong>{c.name}</strong> · {c.fields.join(', ')}</p>)}</details>}
    <div className="release-plan-operations" aria-label="ลำดับการเปลี่ยนแปลง">{plan.operations.map((operation,index)=><details key={operation.id} className="release-plan-operation">
      <summary><span className="release-plan-number">{index+1}</span><span className="release-plan-operation-title"><strong>{kinds[operation.kind]||operation.kind} · {operation.label}</strong><small>{operation.table||operation.name} · {categories[operation.category]}</small></span><span className={'release-plan-risk risk-'+operation.risk}>ความเสี่ยง{risks[operation.risk]}</span><span className="release-plan-support">{operation.supported?'ตรวจตามเงื่อนไขเดิม':publicationAvailable?'ตรวจเผยแพร่แยกด้านล่าง':'ยังไม่รองรับเผยแพร่'}</span></summary>
      <div className="release-plan-operation-body"><p>คุณสมบัติที่เปลี่ยน: {operation.fields.join(', ')}</p><ul>{operation.impacts.map(impact=><li key={impact}>{impact}</li>)}</ul>{!!operation.dependencies.length&&<p>ต้องตรวจรายการก่อนหน้า: {operation.dependencies.map(id=>{const at=plan.operations.findIndex(o=>o.id===id);return at<0?id:String(at+1);}).join(', ')}</p>}</div>
    </details>)}</div>
    <details className="release-plan-notices"><summary>ขอบเขตการตรวจ</summary><ul>{plan.notices.map(notice=><li key={notice}>{notice}</li>)}</ul><p>แผนรุ่น {plan.version} · แอป <code>{plan.appId}</code> · ฉบับร่าง <code>{plan.workspaceId}</code></p><p>ส่วนนี้เปรียบเทียบการตั้งค่าเท่านั้น ผลซ้อมแสดงแยกด้านล่าง การเผยแพร่ยังใช้ได้เฉพาะสิ่งที่ระบบเดิมรองรับ</p></details>
  </section>;
}
