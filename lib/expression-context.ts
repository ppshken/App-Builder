import {formulaAggregate} from './formula-aggregate';
import type {FormulaReadMetrics} from './formula-performance';
import {visibleRawRows,hasRowRule} from "./row-access";
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
export function expressionContext(now = new Date(), userEmail = "", database:Database.Database=db,metrics?:FormulaReadMetrics) {
  // Request-local metadata only: never share permissions or snapshots between users.
  const metadata=new Map<string,Column[]>();
  const columnsOf=(name:string)=>{let cols=metadata.get(name);if(!cols){cols=systemFormulaColumns(name)||effectiveColumns(database,name);metadata.set(name,cols);}return cols;};
  const tableExists=(name:string)=>isSystemFormulaTable(name)||IDENT.test(name)&&name!=="id"&&!!database.prepare("SELECT 1 FROM _tables WHERE name=?").get(name);
  const tables: Record<string, ExpressionTable> = Object.create(null), loading = new Set<string>();
  const fullTables = new Map<string, ExpressionTable>(), projections = new Map<string, ExpressionTable>(), relatedProjections = new Map<string, ExpressionTable>();
  let relatedCachedRows=0;
  let systemData:Record<string,ExpressionTable>|undefined;
  const countRows=(name:string,count:number)=>{if(metrics){metrics.rowsLoaded+=count;metrics.rowsByTable[name]=(metrics.rowsByTable[name]||0)+count;}};
  const systemTable=(name:string,requested?:string[])=>{if(!systemData){systemData=formulaSystemData(database);if(metrics){metrics.dataLoads+=Object.keys(systemData).length;for(const [table,data] of Object.entries(systemData))countRows(table,data.rows.length);}}const data=systemData[name];for(const column of requested||[])if(!data.columns.includes(column))throw Error(`ไม่พบคอลัมน์ [${column}] ในตาราง ${name}`);return tables[name]=data;};
  const project=(name:string,requested:string[],related=false,scope?:RelatedReadScope,rowIds?:number[]):ExpressionTable=>{
    if(isSystemFormulaTable(name)){if(related||scope)throw Error('ตารางระบบไม่รองรับ Related');return systemTable(name,requested);}
    assertTablePermission(name,"read");
    if(scope&&scope.parentIds.length>500)throw Error('Related อ่านได้ครั้งละไม่เกิน 500 แถวแม่');
    if (!scope&&!rowIds&&fullTables.has(name)){if(metrics)metrics.cacheHits++;return fullTables.get(name)!;}
    // Column requests share one bounded entry for the same row scope. Keeping
    // each column combination separately evicts parents while scoring a table.
    const cacheKey = scope?`${name}:${related?"related":"table"}:${JSON.stringify({ownerTable:scope.ownerTable,parentIds:[...new Set(scope.parentIds.map(Number))].sort((a,b)=>a-b),refColumn:scope.refColumn,includeBlank:!!scope.includeBlank})}`:`${name}:${[...new Set(requested)].sort().join(",")}:${related?"related":"table"}:${rowIds?'ids:'+JSON.stringify(rowIds):'all'}`;
    const cache=scope?relatedProjections:projections;
    const cached=scope||rowIds?cache.get(cacheKey):tables[name];
    // For an identical Related row scope, previously validated columns already
    // include their dependencies. Avoid rebuilding that plan for each row use.
    if(scope&&cached&&requested.every(c=>cached.columns.includes(c))){if(metrics)metrics.cacheHits++;return cached;}
    const loadingKey=scope?cacheKey+':'+[...new Set(requested)].sort().join(','):cacheKey;
    if (!tableExists(name)) throw new Error(`ไม่พบตาราง ${name} กรุณาตรวจชื่อในระบบ`);
    const cols = columnsOf(name), key = cols.find(c=>c.is_key)?.name || "id";
    for(const column of requested)if(column!=="id"&&!cols.some(c=>c.name===column))throw new Error(`ไม่พบคอลัมน์ [${column}] ในตาราง ${name}`);
    const label=labelTextColumn(cols),image=labelImageColumn(cols);
    const needed = new Set([...requested,key,...cols.filter(c=>c.type==="ref"&&!c.is_virtual).map(c=>c.name),...(!related?cols.filter(c=>!c.is_virtual&&(c.name===label||c.name===image)).map(c=>c.name):[])]);
    for (const name of needed) { const c=cols.find(c=>c.name===name); if(c?.is_virtual&&c.virtual_expr)for(const ref of references(c.virtual_expr))needed.add(ref); }
    if (cached&&[...needed].every(c=>cached.columns.includes(c))){if(metrics)metrics.cacheHits++;return cached;}
    if (loading.has(loadingKey) || loading.size >= 16) throw new Error(`สูตร${related?" Related":"ข้ามตาราง"}อ้างอิงวนกันที่ ${name}[${requested.join(",")}]`);
    const selected = cols.filter(c=>needed.has(c.name));
    // Rules normalize every physical field, so retain full rows for those users.
    const fields=hasRowRule(name,database)?"*":[...new Set(["id",...selected.filter(c=>!c.is_virtual).map(c=>c.name)])].map(c=>{if(!IDENT.test(c))throw Error("ชื่อคอลัมน์ไม่ถูกต้อง");return '"'+c+'"';}).join(",");
    let raw:Record<string,any>[];
    if(scope){
      const links=cols.filter(c=>c.type==='ref'&&!c.is_virtual&&(!scope.ownerTable||c.ref_table===scope.ownerTable)&&(!scope.refColumn||c.name===scope.refColumn));
      if(links.length!==1)throw Error(links.length?'ตาราง '+name+' มี Ref ไปตารางแม่หลายช่อง กรุณาระบุ [Related_'+name+':ชื่อคอลัมน์Ref]['+requested[0]+']':'ไม่พบ Ref จากตาราง '+name+' ไปตารางแม่ปัจจุบัน');
      const ref=links[0].name;if(!IDENT.test(ref))throw Error('ชื่อคอลัมน์ Ref ไม่ถูกต้อง');
      if(scope.parentIds.length>500)throw Error('Related อ่านได้ครั้งละไม่เกิน 500 แถวแม่');
      const ids=[...new Set(scope.parentIds.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))];
      raw=scope.includeBlank?database.prepare('SELECT '+fields+' FROM "t_'+name+'" WHERE "'+ref+'" IS NULL OR "'+ref+'"='+"''"+' ORDER BY id').all() as Record<string,any>[]:ids.length?database.prepare('SELECT * FROM "t_'+name+'" WHERE "'+ref+'" IN (SELECT value FROM json_each(?)) ORDER BY id').all(JSON.stringify(ids)) as Record<string,any>[]:[];
    }else if(rowIds)raw=rowIds.length?database.prepare(`SELECT ${fields} FROM "t_${name}" WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id`).all(JSON.stringify(rowIds)) as Record<string,any>[]:[];
    else raw = database.prepare(`SELECT ${fields} FROM "t_${name}" ORDER BY id`).all() as Record<string,any>[];
    loading.add(loadingKey);
    try {
      // Project only requested values, so unrelated child formulas do not load
      // the parent back into its own Related calculation.
      const rows = visibleRawRows(name,raw,database).map(r=>calculateRow(selected,r,false,now,false,userEmail,context).row);
      if(metrics){countRows(name,rows.length);if(!scope||scope.includeBlank||scope.parentIds.length)metrics.dataLoads++;}
      let data: ExpressionTable = {columns:["id",...selected.map(c=>c.name)],key,rows,labels:Object.fromEntries(rows.filter(r=>r[key]!=null).map(r=>[String(r[key]),String(r[label]??r[key])])),labelImages: image?Object.fromEntries(rows.filter(r=>r[key]!=null&&typeof r[image]==="string").map(r=>[String(r[key]),String(r[image])])):{},refs:refTablesOf(cols),relatedRefs:refTablesOf(cols.filter(c=>!c.is_virtual))};
      if(scope){
        if(cached){const previous=new Map(cached.rows.map(r=>[r.id,r]));const merged=rows.map(r=>({...previous.get(r.id),...r}));data={...data,columns:[...new Set([...cached.columns,...data.columns])],rows:merged,labels:Object.fromEntries(merged.filter(r=>r[key]!=null).map(r=>[String(r[key]),String(r[label]??r[key])])),labelImages:{...cached.labelImages,...data.labelImages}};relatedCachedRows-=cached.rows.length;cache.delete(cacheKey);}
        while(cache.size&&(cache.size>=1024||relatedCachedRows+data.rows.length>20000)){const oldest=cache.keys().next().value!;relatedCachedRows-=cache.get(oldest)!.rows.length;cache.delete(oldest);}
        relatedCachedRows+=data.rows.length;
      }
      cache.set(cacheKey,data);
      if(scope||rowIds)return data;
      const prior=tables[name];
      if(prior){const before=new Map(prior.rows.map(r=>[r.id,r])),merged=data.rows.map(r=>({...before.get(r.id),...r}));tables[name]={...prior,...data,columns:[...new Set([...prior.columns,...data.columns])],rows:merged,labels:Object.fromEntries(merged.filter(r=>r[key]!=null).map(r=>[String(r[key]),String(r[label]??r[key])])),labelImages:{...prior.labelImages,...data.labelImages}};}
      else tables[name]=data;
      return data;
    } finally {loading.delete(loadingKey);}
  };
  const context: ExpressionContext = { getAggregate:formulaAggregate(database,columnsOf,tableExists,userEmail),enableSelectMemo:true, ...expressionUser(currentUser()||null,database), getEqualityRows:expressionLookup(), getRelatedTable(name,column,scope){return project(name,[column,...(scope?.columns||[])],true,scope);},
    getSelectTable(name,requested,scope){
      if(isSystemFormulaTable(name))return;
      assertTablePermission(name,'read');
      if(!scope.ownerTable||!scope.refColumn||!columnsOf(name).some(c=>c.name===scope.refColumn&&c.type==='ref'&&!c.is_virtual&&c.ref_table===scope.ownerTable))return;
      return project(name,requested,true,scope);
    }, getReferenceTable(name,column,id){
      // A dereference has an exact record identity; never materialize every
      // target's virtual columns just to read that record. Table reads stay full.
      return project(name,[column],false,undefined,Number.isSafeInteger(id)&&id>0?[id]:[]);
    }, getTable(name,columns) {
    if(isSystemFormulaTable(name))return systemTable(name,columns);
    if(columns?.length)return project(name,columns);
    assertTablePermission(name,"read");
    if (fullTables.has(name)){if(metrics)metrics.cacheHits++;return fullTables.get(name)!;}
    if (loading.has(name) || loading.size >= 16) throw new Error(`สูตรข้ามตารางอ้างอิงวนกันที่ ${name} กรุณาแก้สูตร`);
    if (!tableExists(name)) throw new Error(`ไม่พบตาราง ${name} กรุณาตรวจชื่อในระบบ`);
    const cols = columnsOf(name), key = cols.find(c => c.is_key)?.name || "id", label = labelTextColumn(cols);
    const raw = database.prepare(`SELECT * FROM "t_${name}" ORDER BY id`).all() as Record<string, any>[];
    loading.add(name);
    try {
      const rows = visibleRawRows(name,raw,database).map(r => calculateRow(cols, r, false, now, false, userEmail, context).row);
      if(metrics){countRows(name,rows.length);metrics.dataLoads++;}
      const labels: Record<string, string> = Object.create(null),labelImages:Record<string,string>=Object.create(null),image=labelImageColumn(cols);
      for (const r of rows) if (r[key] != null) {labels[String(r[key])] = String(r[label] ?? r[key]);if(image&&typeof r[image]==="string"&&r[image])labelImages[String(r[key])]=r[image] as string;}
      const data = { columns: ["id", ...cols.map(c => c.name)], key, rows, labels, labelImages, refs: refTablesOf(cols), relatedRefs:refTablesOf(cols.filter(c=>!c.is_virtual)) };
      fullTables.set(name,data);
      return tables[name] = data;
    } finally { loading.delete(name); }
  } };
  return { ...context, snapshot(sources: string[], columns: Column[] = [], skipDenied=false,relatedScope?:{ownerTable:string;parentIds:number[];deferBlank?:boolean;referenceOnly?:boolean;sampleRefs?:Record<string,number>}) {
    const scopedSnapshots:Record<string,ExpressionTable>=Object.create(null);
    const referenceSnapshots:Record<string,ExpressionTable>=Object.create(null);
    const mergeScoped=(name:string,data:ExpressionTable,refColumns:string[],includeBlank=false,scope=relatedScope!)=>{
      const prior=scopedSnapshots[name],rows=new Map((prior?.rows||[]).map(r=>[r.id,r]));for(const r of data.rows)rows.set(r.id,{...rows.get(r.id),...r});
      scopedSnapshots[name]={...prior,...data,columns:[...new Set([...(prior?.columns||[]),...data.columns])],rows:[...rows.values()],related_scope:{ownerTable:scope.ownerTable,parentIds:[...new Set([...(prior?.related_scope?.parentIds||[]),...scope.parentIds])],...(includeBlank||prior?.related_scope?.blankRefColumns?{blankRefColumns:[...new Set([...(prior?.related_scope?.blankRefColumns||[]),...(includeBlank?refColumns:[])])]}:{}),refColumns:[...new Set([...(prior?.related_scope?.refColumns||[]),...refColumns])]}};
    };
    // Plan sibling dereferences together before evaluating their shared virtuals.
    // Only include fields explicitly referenced by these owner formulas; Related
    // and whole-table reads retain their existing scope and permission handling.
    const ownerColumns=columns,ownerRefFields=new Map<string,Set<string>>();
    for(const source of sources)if(source.trim())for(const path of referencePaths(source))if(!path.table){
      const ref=columns.find(c=>c.name===path.column);if(ref?.type==='ref'&&ref.ref_table){let fields=ownerRefFields.get(ref.ref_table);if(!fields)ownerRefFields.set(ref.ref_table,fields=new Set());fields.add(path.property);}
    }
    const wholeTables=new Set(sources.filter(source=>source.trim()).flatMap(source=>directTableReferences(source).map(r=>r.table)));
    let ownerRows:Record<string,any>[]|undefined;
    const referenceIds=(target:string):number[]|undefined=>{
      // Editing forms and formula samples may contain unsaved Ref values; only
      // display requests can use the persisted owner's Ref IDs as a boundary.
      if(relatedScope?.sampleRefs&&!wholeTables.has(target)&&!isSystemFormulaTable(target)){
        const paths=sources.flatMap(source=>source.trim()?referencePaths(source):[]).filter(path=>!path.table);
        const refs=columns.filter(c=>c.type==='ref'&&c.ref_table===target&&paths.some(path=>path.column===c.name));
        if(refs.length&&refs.every(c=>Object.hasOwn(relatedScope.sampleRefs!,c.name)))return [...new Set(refs.map(c=>relatedScope.sampleRefs![c.name]))].sort((a,b)=>a-b);
      }
      if(!relatedScope?.referenceOnly||!relatedScope.parentIds.length&&!relatedScope.deferBlank||wholeTables.has(target)||isSystemFormulaTable(target)||relatedScope.parentIds.length>500)return;
      const refs=columns.filter(c=>c.type==='ref'&&c.ref_table===target&&sources.some(source=>source.trim()&&referencePaths(source).some(p=>!p.table&&p.column===c.name)));
      if(!refs.length)return;
      if(!IDENT.test(relatedScope.ownerTable))throw Error('ชื่อตารางแม่ไม่ถูกต้อง');
      assertTablePermission(relatedScope.ownerTable,'read');
      if(!ownerRows)ownerRows=visibleRawRows(relatedScope.ownerTable,database.prepare('SELECT * FROM "t_'+relatedScope.ownerTable+'" WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id').all(JSON.stringify(relatedScope.parentIds)) as Record<string,any>[],database);
      const needed=new Set(refs.map(c=>c.name));for(const name of needed){const c=columns.find(c=>c.name===name);if(c?.is_virtual&&c.virtual_expr)for(const dependency of references(c.virtual_expr))needed.add(dependency);}
      const selected=columns.filter(c=>needed.has(c.name)),ids=new Set<number>();
      for(const raw of ownerRows){const row=calculateRow(selected,raw,false,now,false,userEmail,{...context,tableName:relatedScope.ownerTable}).row;for(const ref of refs){const value=row[ref.name];if(value!==null&&value!==undefined&&value!==''){const id=Number(value);if(!Number.isSafeInteger(id)||id<1)return;ids.add(id);}}}
      return ids.size<=500?[...ids].sort((a,b)=>a-b):undefined;
    };
    const refIds=new Map<string,number[]|undefined>();
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
        if(columns===ownerColumns)for(const field of ownerRefFields.get(table)||[])needed.add(field);
        const key=table+":"+[...needed].sort().join(",");if(loaded.has(key))continue;loaded.add(key);
        if(columns===ownerColumns&&!refIds.has(table))refIds.set(table,referenceIds(table));
        const ids=columns===ownerColumns?refIds.get(table):undefined;
        const data=ids?project(table,[...needed],false,undefined,ids):context.getTable!(table,[...needed]),targetColumns=columnsOf(table);
        if(ids)referenceSnapshots[table]={...data,reference_scope:{ownerTable:relatedScope!.ownerTable,parentIds:relatedScope!.parentIds}};
        for(const c of targetColumns)if(data.columns.includes(c.name)&&c.is_virtual&&c.virtual_expr){
          // Nested virtuals belong to the dereferenced table, not the original screen.
          if(relatedScope){const ids=data.rows.map(r=>Number(r.id)).filter(id=>Number.isSafeInteger(id)&&id>0);for(let i=0;i<Math.max(ids.length,1);i+=500)queue.push({source:c.virtual_expr,columns:targetColumns,relatedScope:{ownerTable:table,parentIds:ids.slice(i,i+500),deferBlank:true}});}
          else queue.push({source:c.virtual_expr,columns:targetColumns,relatedScope:undefined});
        }
      }
    }
    for(const [name,data] of Object.entries(scopedSnapshots))if(tables[name])context.getTable!(name,[...new Set([...tables[name].columns,...data.columns])]);
    // A nested virtual may also require a full read of its own target table.
    // Complete that full projection before it replaces the scoped Ref result.
    for(const [name,data] of Object.entries(referenceSnapshots))if(tables[name])context.getTable!(name,[...new Set([...tables[name].columns,...data.columns])]);
    for(const [name,data] of Object.entries(referenceSnapshots)){const related=scopedSnapshots[name];if(related){const rows=new Map(related.rows.map(r=>[r.id,r]));for(const row of data.rows)rows.set(row.id,{...rows.get(row.id),...row});referenceSnapshots[name]={...data,...related,columns:[...new Set([...related.columns,...data.columns])],rows:[...rows.values()],labels:{...related.labels,...data.labels},labelImages:{...related.labelImages,...data.labelImages}};}}
    return {...scopedSnapshots,...referenceSnapshots,...tables};
  } };
}
