import {parseExpression,references} from './expression';
import type {Column} from './columns';
export type FormulaEvalMetrics={steps:number;selectRows:number;relatedRows:number;indexLookups:number;memoHits:number;sortRows:number};
export type FormulaReadMetrics={dataLoads:number;cacheHits:number;rowsLoaded:number};
export const evaluationMetrics=():FormulaEvalMetrics=>({steps:0,selectRows:0,relatedRows:0,indexLookups:0,memoHits:0,sortRows:0});
export const readMetrics=():FormulaReadMetrics=>({dataLoads:0,cacheHits:0,rowsLoaded:0});
// Calculate only the owner fields used by this formula, including their own dependencies.
export function formulaInputColumns(source:string,columns:Column[],extra:string[]=[],provided?:ReadonlySet<string>){
 const needed=new Set([...references(source),...extra]);
 for(const name of needed){const c=columns.find(c=>c.name===name),expr=c?.is_virtual?c.virtual_expr:provided?.has(name)?undefined:c?.default_expr;if(expr?.trim())for(const ref of references(expr))needed.add(ref);}
 return columns.filter(c=>needed.has(c.name));
}
export function formulaPerformance(source:string,columns:Column[]=[]){
 const root=parseExpression(source),tables=new Set<string>(),reasons:string[]=[],tips:string[]=[];
 let selects=0,nestedSelects=0,related=0,derefs=0,sorts=0,unbounded=0,volatile=false;
 function walk(n:ReturnType<typeof parseExpression>,depth=0){
  if(n.kind==='table')tables.add(n.table);
  if(n.kind==='related'){tables.add(n.table);related++;}
  if(n.kind==='deref')derefs++;
  if(n.kind==='binary'){walk(n.left,depth);walk(n.right,depth);}
  if(n.kind==='unary')walk(n.value,depth);
  if(n.kind==='call'){
   if(n.name==='UNIQUEID')volatile=true;
   if(n.name==='ORDERBY')sorts++;
   if(n.name==='SELECT'){selects++;if(depth)nestedSelects++;if(n.args[0].kind==='table'){let predicate=n.args[1];while(predicate.kind==='call'&&predicate.name==='AND')predicate=predicate.args[0];const bounded=predicate.kind==='binary'&&['=','=='].includes(predicate.op)&&((predicate.left.kind==='column'&&predicate.right.kind==='outer')||(predicate.right.kind==='column'&&predicate.left.kind==='outer'));if(!bounded)unbounded++;}}
   n.args.forEach(child=>walk(child,depth+(n.name==='SELECT'?1:0)));
  }
 }
 walk(root);
 const dependencies=formulaInputColumns(source,columns).filter(c=>c.is_virtual);
 for(const dependency of dependencies)if(dependency.virtual_expr)try{walk(parseExpression(dependency.virtual_expr));}catch{reasons.push('สูตรของคอลัมน์ '+dependency.name+' ยังประเมินโครงสร้างไม่ได้');}
 if(unbounded){reasons.push('มี SELECT ที่อาจตรวจข้อมูลทั้งตาราง');tips.push('หากต้องการรายการของแถวแม่ ให้ใช้ Related หรือเริ่มเงื่อนไขด้วยการเทียบ Ref กับ [_THISROW] เมื่อความหมายของสูตรเหมือนเดิม');}
 if(nestedSelects){reasons.push('มี SELECT ซ้อนอยู่ใน SELECT');tips.push('ลดการค้นหาซ้อนต่อรายการ และแยกค่าที่ใช้ซ้ำเป็นคอลัมน์เมื่อเหมาะสม');}
 if(sorts){reasons.push('ORDERBY ต้องเรียงรายการที่ผ่านเงื่อนไขทั้งหมด');tips.push('กรองรายการให้แคบลงก่อนเรียงลำดับ');}
 if(dependencies.length){reasons.push('อ้างคอลัมน์คำนวณ '+dependencies.length+' คอลัมน์');tips.push('ตรวจสูตรของคอลัมน์ที่อ้างต่อ เพราะต้นทุนจริงรวมการคำนวณเหล่านั้นด้วย');}
 if(related)reasons.push('Related อ่านเฉพาะขอบเขตแถวแม่เมื่อระบุแถวทดสอบ');
 if(derefs)reasons.push('มีการอ่านค่าผ่าน Ref');
 if(volatile)reasons.push('UNIQUEID สร้างค่าใหม่ทุกครั้ง จึงไม่ใช้ผลลัพธ์เดิมซ้ำ');
 if(!reasons.length)reasons.push('ใช้ค่าของแถวปัจจุบันและฟังก์ชันทั่วไป');
 return {level:nestedSelects||unbounded||sorts?'review':selects||related||derefs||sorts||dependencies.length?'moderate':'light',selects,nestedSelects,related,derefs,sorts,tables:[...tables],virtualColumns:dependencies.map(c=>c.name),reasons,tips:[...new Set(tips)]};
}
