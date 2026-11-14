import {visibleRawRows} from "./row-access";
import {expressionLookup} from './expression-lookup';
import {isSystemFormulaTable,systemFormulaColumns} from './formula-system-schema';
import {formulaSystemData} from './formula-system-data';
import {expressionUser} from "./user-settings";
import {assertTablePermission,canRead,currentUser} from "./permissions";
import { db } from "./db";
import type Database from "better-sqlite3";
import {effectiveColumns} from "./shared-table-columns";
import {IDENT} from "./columns";
import { labelTextColumn,labelImageColumn, calculateRow, Column, refTablesOf } from "./columns";
import { ExpressionContext, ExpressionTable, RelatedReadScope, directTableReferences, parentSelectReferences, unboundedTableReferences, tableReferences, referencePaths, relatedReferences, references } from "./expression";

// One bounded snapshot per request; never turn expression text into SQL.
export function expressionContext(now = new Date(), userEmail = "", database:Database.Database=db) {
  // Request-local metadata only: never share permissions or snapshots between users.
  const metadata=new Map<string,Column[]>();
  const columnsOf=(name:string)=>{let cols=metadata.get(name);if(!cols){cols=systemFormulaColumns(name)||effectiveColumns(database,name);metadata.set(name,cols);}return cols;};
  const tableExists=(name:string)=>isSystemFormulaTable(name)||IDENT.test(name)&&name!=="id"&&!!database.prepare("SELECT 1 FROM _tables WHERE name=?").get(name);
  const tables: Record<string, ExpressionTable> = Object.create(null), loading = new Set<string>();
  const fullTables = new Map<string, ExpressionTable>(), projections = new Map<string, ExpressionTable>(), relatedProjections = new Map<string, ExpressionTable>();
  let relatedCachedRows=0;
  let systemData:Record<string,ExpressionTable>|undefined;
  const systemTable=(name:string,requested?:string[])=>{systemData??=formulaSystemData(database);const data=systemData[name];for(const column of requested||[])if(!data.columns.includes(column))throw Error(`ไม่พบคอลัมน์ [${column}] ในตาราง ${name}`);return tables[name]=data;};
  const project=(name:string,requested:string[],related=false,scope?:RelatedReadScope):ExpressionTable=>{
    if(isSystemFormulaTable(name)){if(related||scope)throw Error('ตารางระบบไม่รองรับ Related');return systemTable(name,requested);}
    assertTablePermission(name,"read");
    if (!scope&&fullTables.has(name)) return fullTables.get(name)!;
    const cacheKey = `${name}:${[...new Set(requested)].sort().join(",")}:${related?"related":"table"}:${scope?JSON.stringify(scope):"all"}`;
    const cache=scope?relatedProjections:projections;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    if (loading.has(cacheKey) || loading.size >= 16) throw new Error(`สูตร${related?" Related":"ข้ามตาราง"}อ้างอิงวนกันที่ ${name}[${requested.join(",")}]`);
    if (!tableExists(name)) throw new Error(`ไม่พบตาราง ${name} กรุณาตรวจชื่อในระบบ`);
    const cols = columnsOf(name), key = cols.find(c=>c.is_key)?.name || "id";
    for(const column of requested)if(column!=="id"&&!cols.some(c=>c.name===column))throw new Error(`ไม่พบคอลัมน์ [${column}] ในตาราง ${name}`);
    const label=labelTextColumn(cols),image=labelImageColumn(cols);
    const needed = new Set([...requested,key,...cols.filter(c=>c.type==="ref"&&!c.is_virtual).map(c=>c.name),...(!related?cols.filter(c=>!c.is_virtual&&(c.name===label||c.name===image)).map(c=>c.name):[])]);
    for (const name of needed) { const c=cols.find(c=>c.name===name); if(c?.is_virtual&&c.virtual_expr)for(const ref of references(c.virtual_expr))needed.add(ref); }
    const selected = cols.filter(c=>needed.has(c.name));
    let raw:Record<string,any>[];
    if(scope){
      const links=cols.filter(c=>c.type==='ref'&&!c.is_virtual&&(!scope.ownerTable||c.ref_table===scope.ownerTable)&&(!scope.refColumn||c.name===scope.refColumn));
      if(links.length!==1)throw Error(links.length?'ตาราง '+name+' มี Ref ไปตารางแม่หลายช่อง กรุณาระบุ [Related_'+name+':ชื่อคอลัมน์Ref]['+requested[0]+']':'ไม่พบ Ref จากตาราง '+name+' ไปตารางแม่ปัจจุบัน');
      const ref=links[0].name;if(!IDENT.test(ref))throw Error('ชื่อคอลัมน์ Ref ไม่ถูกต้อง');
      if(scope.parentIds.length>500)throw Error('Related อ่านได้ครั้งละไม่เกิน 500 แถวแม่');
      const ids=[...new Set(scope.parentIds.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))];
      raw=scope.includeBlank?database.prepare('SELECT * FROM "t_'+name+'" WHERE "'+ref+'" IS NULL OR "'+ref+'"='+"''"+' ORDER BY id').all() as Record<string,any>[]:ids.length?database.prepare('SELECT * FROM "t_'+name+'" WHERE "'+ref+'" IN (SELECT value FROM json_each(?)) ORDER BY id').all(JSON.stringify(ids)) as Record<string,any>[]:[];
    }else raw = database.prepare(`SELECT * FROM "t_${name}" ORDER BY id`).all() as Record<string,any>[];
    loading.add(cacheKey);
    try {
      // Project only requested values, so unrelated child formulas do not load
      // the parent back into its own Related calculation.
      const rows = visibleRawRows(name,raw,database).map(r=>calculateRow(selected,r,false,now,false,userEmail,context).row);
      const data: ExpressionTable = {columns:["id",...selected.map(c=>c.name)],key,rows,labels:Object.fromEntries(rows.filter(r=>r[key]!=null).map(r=>[String(r[key]),String(r[label]??r[key])])),labelImages: image?Object.fromEntries(rows.filter(r=>r[key]!=null&&typeof r[image]==="string").map(r=>[String(r[key]),String(r[image])])):{},refs:refTablesOf(cols),relatedRefs:refTablesOf(cols.filter(c=>!c.is_virtual))};
      if(scope){
        while(cache.size&&(cache.size>=256||relatedCachedRows+data.rows.length>20000)){const oldest=cache.keys().next().value!;relatedCachedRows-=cache.get(oldest)!.rows.length;cache.delete(oldest);}
        relatedCachedRows+=data.rows.length;
      }
      cache.set(cacheKey,data);
      if(scope)return data;
      const prior=tables[name];
      if(prior){const before=new Map(prior.rows.map(r=>[r.id,r])),merged=data.rows.map(r=>({...before.get(r.id),...r}));tables[name]={...prior,...data,columns:[...new Set([...prior.columns,...data.columns])],rows:merged,labels:Object.fromEntries(merged.filter(r=>r[key]!=null).map(r=>[String(r[key]),String(r[label]??r[key])])),labelImages:{...prior.labelImages,...data.labelImages}};}
      else tables[name]=data;
      return data;
    } finally {loading.delete(cacheKey);}
  };
  const context: ExpressionContext = { ...expressionUser(currentUser()||null,database), getEqualityRows:expressionLookup(), getRelatedTable(name,column,scope){return project(name,[column,...(scope?.columns||[])],true,scope);},
    getSelectTable(name,requested,scope){
      if(isSystemFormulaTable(name))return;
      assertTablePermission(name,'read');
      if(!scope.ownerTable||!scope.refColumn||!columnsOf(name).some(c=>c.name===scope.refColumn&&c.type==='ref'&&!c.is_virtual&&c.ref_table===scope.ownerTable))return;
      return project(name,requested,true,scope);
    }, getTable(name,columns) {
    if(isSystemFormulaTable(name))return systemTable(name,columns);
    if(columns?.length)return project(name,columns);
    assertTablePermission(name,"read");
    if (fullTables.has(name)) return fullTables.get(name)!;
    if (loading.has(name) || loading.size >= 16) throw new Error(`สูตรข้ามตารางอ้างอิงวนกันที่ ${name} กรุณาแก้สูตร`);
    if (!tableExists(name)) throw new Error(`ไม่พบตาราง ${name} กรุณาตรวจชื่อในระบบ`);
    const cols = columnsOf(name), key = cols.find(c => c.is_key)?.name || "id", label = labelTextColumn(cols);
    const raw = database.prepare(`SELECT * FROM "t_${name}" ORDER BY id`).all() as Record<string, any>[];
    loading.add(name);
    try {
      const rows = visibleRawRows(name,raw,database).map(r => calculateRow(cols, r, false, now, false, userEmail, context).row);
      const labels: Record<string, string> = Object.create(null),labelImages:Record<string,string>=Object.create(null),image=labelImageColumn(cols);
      for (const r of rows) if (r[key] != null) {labels[String(r[key])] = String(r[label] ?? r[key]);if(image&&typeof r[image]==="string"&&r[image])labelImages[String(r[key])]=r[image] as string;}
      const data = { columns: ["id", ...cols.map(c => c.name)], key, rows, labels, labelImages, refs: refTablesOf(cols), relatedRefs:refTablesOf(cols.filter(c=>!c.is_virtual)) };
      fullTables.set(name,data);
      return tables[name] = data;
    } finally { loading.delete(name); }
  } };
  return { ...context, snapshot(sources: string[], columns: Column[] = [], skipDenied=false,relatedScope?:{ownerTable:string;parentIds:number[];deferBlank?:boolean}) {
    const scopedSnapshots:Record<string,ExpressionTable>=Object.create(null);
    const mergeScoped=(name:string,data:ExpressionTable,refColumns:string[],includeBlank=false,scope=relatedScope!)=>{
      const prior=scopedSnapshots[name],rows=new Map((prior?.rows||[]).map(r=>[r.id,r]));for(const r of data.rows)rows.set(r.id,{...rows.get(r.id),...r});
      scopedSnapshots[name]={...prior,...data,columns:[...new Set([...(prior?.columns||[]),...data.columns])],rows:[...rows.values()],related_scope:{ownerTable:scope.ownerTable,parentIds:[...new Set([...(prior?.related_scope?.parentIds||[]),...scope.parentIds])],...(includeBlank||prior?.related_scope?.blankRefColumns?{blankRefColumns:[...new Set([...(prior?.related_scope?.blankRefColumns||[]),...(includeBlank?refColumns:[])])]}:{}),refColumns:[...new Set([...(prior?.related_scope?.refColumns||[]),...refColumns])]}};
    };
    const queue = sources.map(source => ({ source, columns, relatedScope })), loaded = new Set<string>();
    while (queue.length) {
      const { source, columns, relatedScope } = queue.shift()!; if (!source.trim()) continue;
      const targets=new Map<string,Set<string>>();
      const need=(table:string,column:string)=>{let selected=targets.get(table);if(!selected)targets.set(table,selected=new Set());selected.add(column);};
      for(const target of tableReferences(source,false))need(target.table,target.column);
      const directSources=new Set(directTableReferences(source).map(r=>r.table));
      for (const related of relatedReferences(source)) {
        if(skipDenied&&!isSystemFormulaTable(related.table)&&!canRead(related.table))continue;
        if(relatedScope&&!related.ownerTable){
          const data=context.getRelatedTable!(related.table,related.column,{...relatedScope,refColumn:related.refColumn,columns:[...(targets.get(related.table)||[])]});
          if(!directSources.has(related.table))targets.delete(related.table);
          mergeScoped(related.table,data,Object.entries(data.relatedRefs||{}).filter(([name,target])=>target===relatedScope.ownerTable&&(!related.refColumn||name===related.refColumn)).map(([name])=>name),false,relatedScope);
        }else context.getRelatedTable!(related.table,related.column);
      }
      const plans=parentSelectReferences(source),unbounded=new Set(unboundedTableReferences(source).map(r=>r.table));
      for(const plan of plans){
        if(!relatedScope||plan.ownerTable){unbounded.add(plan.table);continue;}
        if(skipDenied&&!isSystemFormulaTable(plan.table)&&!canRead(plan.table))continue;
        let optimized=false;
        for(const refColumn of plan.refColumns){const data=context.getSelectTable!(plan.table,[...(targets.get(plan.table)||[plan.column])],{...relatedScope,refColumn,includeBlank:!relatedScope.parentIds.length&&!relatedScope.deferBlank});if(data){mergeScoped(plan.table,data,[refColumn],!relatedScope.parentIds.length&&!relatedScope.deferBlank,relatedScope);optimized=true;break;}}
        if(!optimized)unbounded.add(plan.table);
      }
      for(const plan of plans)if(!unbounded.has(plan.table)&&scopedSnapshots[plan.table])targets.delete(plan.table);
      for (const path of referencePaths(source)) {
        const owner = path.table ? columnsOf(path.table) : columns, ref = owner.find(c => c.name === path.column);
        if (!ref || ref.type !== "ref" || !ref.ref_table) throw new Error(`[${path.column}] ต้องเป็นชนิด Ref ก่อนดึง [${path.property}]`);
        need(ref.ref_table,path.property);
      }
      for (const [table,needed] of targets) {
        if(skipDenied&&!isSystemFormulaTable(table)&&!canRead(table))continue;
        const key=table+":"+[...needed].sort().join(",");if(loaded.has(key))continue;loaded.add(key);
        const data=context.getTable!(table,[...needed]),columns=columnsOf(table);
        for(const c of columns)if(data.columns.includes(c.name)&&c.is_virtual&&c.virtual_expr){
          // Nested virtuals belong to the dereferenced table, not the original screen.
          if(relatedScope){const ids=data.rows.map(r=>Number(r.id)).filter(id=>Number.isSafeInteger(id)&&id>0);for(let i=0;i<Math.max(ids.length,1);i+=500)queue.push({source:c.virtual_expr,columns,relatedScope:{ownerTable:table,parentIds:ids.slice(i,i+500)}});}
          else queue.push({source:c.virtual_expr,columns,relatedScope:undefined});
        }
      }
    }
    for(const [name,data] of Object.entries(scopedSnapshots))if(tables[name])context.getTable!(name,[...new Set([...tables[name].columns,...data.columns])]);
    return {...scopedSnapshots,...tables};
  } };
}
