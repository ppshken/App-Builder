import type {formulaPerformance,FormulaReadMetrics,FormulaEvalMetrics} from '@/lib/formula-performance';
export type FormulaMeasurement={loadMs:number;evalMs:number;totalMs:number;reads:FormulaReadMetrics;evaluation:FormulaEvalMetrics};
export default function FormulaPerformancePanel({analysis,measurement,onTest,testing,disabled}:{analysis:ReturnType<typeof formulaPerformance>|null;measurement?:FormulaMeasurement;onTest:()=>void;testing:boolean;disabled:boolean}){
 const ms=(v:number)=>v.toLocaleString('th-TH',{maximumFractionDigits:2})+' ms',num=(v:number)=>v.toLocaleString('th-TH');
 return <section className="formula-performance" aria-label="ประสิทธิภาพสูตร">
  <h3>ประเมินประสิทธิภาพสูตร</h3>
  {analysis?<p><span className={'formula-cost formula-cost-'+analysis.level}>{analysis.level==='light'?'ภาระเบา':analysis.level==='moderate'?'มีการอ่านหรือคำนวณเพิ่มเติม':'ควรตรวจการคำนวณซ้อน'}</span><small className="hint"> ประเมินจากโครงสร้าง ยังไม่ใช่เวลาที่วัดจริง</small></p>:<p className="hint">กรอกสูตรที่มีไวยากรณ์ถูกต้องเพื่อประเมินโครงสร้าง</p>}
  <button type="button" disabled={testing||disabled} onClick={onTest}>{testing?'กำลังทดสอบ…':'ทดสอบและวัดประสิทธิภาพ'}</button>
  {measurement&&<div className="formula-measurement" role="status">
   <h4>ผลวัดจริงของรอบทดสอบนี้</h4>
   <dl className="formula-metric-grid">{[['รวมรอบทดสอบ',ms(measurement.totalMs)],['โหลดข้อมูลบนเซิร์ฟเวอร์',ms(measurement.loadMs)],['คำนวณบนเครื่องนี้',ms(measurement.evalMs)],['แถวที่โหลดรวม (นับการอ่านซ้ำ)',num(measurement.reads.rowsLoaded)],['แถวที่ตรวจใน SELECT',num(measurement.evaluation.selectRows)],['ใช้ผล SELECT เดิมซ้ำ',num(measurement.evaluation.memoHits)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <details><summary>รายละเอียดการทำงาน</summary><p>อ่านชุดข้อมูล {num(measurement.reads.dataLoads)} ครั้ง · ใช้ข้อมูลที่โหลดไว้ {num(measurement.reads.cacheHits)} ครั้ง · ค้นผ่านดัชนีในหน่วยความจำ {num(measurement.evaluation.indexLookups)} ครั้ง · ตรวจ Related {num(measurement.evaluation.relatedRows)} แถว · เรียง {num(measurement.evaluation.sortRows)} แถว · ขั้นตอนตัวประเมิน {num(measurement.evaluation.steps)}</p></details>
   <p className="hint">ใช้ข้อมูลตามสิทธิ์และค่าตัวอย่างของรอบนี้ เวลาโหลดบนเซิร์ฟเวอร์รวมการตรวจสิทธิ์และเตรียมข้อมูล การคำนวณวัดบนอุปกรณ์นี้ ไม่ใช่ผลทดสอบหลายแถวหรือผู้ใช้พร้อมกัน</p>
  </div>}
  {analysis&&<div className="formula-cost-details"><h4>ลักษณะการทำงาน</h4><ul>{analysis.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>{analysis.tips.length>0&&<><h4>แนวทางปรับสูตร</h4><ul>{analysis.tips.map(tip=><li key={tip}>{tip}</li>)}</ul></>}</div>}
 </section>;
}
