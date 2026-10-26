import {customTargets} from '@/lib/custom-page';
import {pruneApplicationActionGrants} from '@/lib/application-role-grants';
import {workflowDependency} from "@/lib/workflow-dependencies";
import {actionConfigExpressions} from "@/lib/action-config";
import {errorStatus} from "@/lib/api";
import {withAuth} from "@/lib/auth-api";
import {backupBeforeSchema} from "@/lib/database-backup";
import { changeRelatedReference } from "@/lib/inline-views";
import { changeDisplayColumn } from "@/lib/view-display";
﻿import { NextResponse } from "next/server";
import { db, columnsOf, tableExists, rebuild } from "@/lib/db";
import { assertIdentifier, FORMULA_FIELDS, refTablesOf, normalizeValue } from "@/lib/columns";
import { references, renameReference, renameDereference } from "@/lib/expression";
import { assertKeyData, insertColumn, normalizeColumns, saveColumn } from "@/lib/metadata";
import { columnDefinition, foreignKeyTransaction, syncKeyIndex, createInlineViews } from "@/lib/schema";
import { bad, errorMessage, readBody } from "@/lib/api";
import { actions, slices } from "@/lib/automation";
import { externalFormulaUse, renameExternalFormulas, referenceSchemas } from "@/lib/formula-dependencies";
import { checkLists } from "@/lib/lists";
export const dynamic = "force-dynamic";

async function handlePATCH(req: Request, { params }: { params: { name: string } }) {
  const t = params.name;
  try {
    if (!tableExists(t)) return bad("ไม่พบตาราง", 404);
    const b = await readBody(req), cols = columnsOf(t);
    const found = cols.find(c => c.name === b.name);
    switch (b.op) {
      case "realtime": {
        if(typeof b.enabled!=="boolean")return bad("กรุณาระบุเปิดหรือปิด Realtime");
        db.prepare("UPDATE _tables SET realtime_enabled=? WHERE name=?").run(b.enabled?1:0,t);
        break;
      }
      case "label": {
        if (typeof b.label !== "string" || !b.label.trim()) return bad("กรุณาใส่ชื่อตาราง");
        backupBeforeSchema();
        db.prepare("UPDATE _tables SET label=? WHERE name=?").run(b.label.trim(), t);
        break;
      }
      case "add_column": {
        const all = normalizeColumns([...cols.map(c => ({ ...c, ...(b.column?.is_key ? { is_key: 0 } : {}), ...(b.column?.is_label && (c.type==="image")===(b.column.type==="image") ? { is_label: 0 } : {}) })), b.column],{[t]:[]}), c = all[all.length - 1];
        c.pos = Math.max(-1, ...cols.map(c => c.pos ?? 0)) + 1;
        backupBeforeSchema();
        db.transaction(() => {
          if (!c.is_virtual) db.prepare(`ALTER TABLE "t_${t}" ADD COLUMN ${columnDefinition(c)}`).run();
          insertColumn(t, c);
          all.slice(0, -1).forEach(c => saveColumn(t, c));
          assertKeyData(t, all); syncKeyIndex(db, t); createInlineViews(db,t);
        })();
        break;
      }
      case "edit_column": {
        if (!found) return bad("ไม่พบคอลัมน์", 404);
        if ((b.type !== undefined && b.type !== found.type) || (b.is_virtual !== undefined && !!b.is_virtual !== !!found.is_virtual))
          return bad("เปลี่ยนชนิดผ่านปุ่มแปลงชนิดข้อมูลเพื่อตรวจก่อนยืนยัน ส่วนการสลับช่องข้อมูลกับช่องคำนวณต้องสร้างคอลัมน์ใหม่");
        if (found.type === "ref" && b.ref_table !== undefined && b.ref_table !== found.ref_table) return bad("เปลี่ยนตารางอ้างอิงผ่านปุ่มแปลงชนิดข้อมูล เพื่อตรวจการจับคู่ Ref ก่อนยืนยัน");
        const all = normalizeColumns(cols.map(c => c.name === found.name ? { ...c, ...b, name: c.name, type: c.type, is_virtual: c.is_virtual } : { ...c, ...(b.is_key ? { is_key: 0 } : {}), ...(b.is_label && (c.type==="image")===(found.type==="image") ? { is_label: 0 } : {}) }),{[t]:[]});
        const editedText = all.find(c=>c.name===found.name)!;
        if (!editedText.is_virtual && ["text","longtext"].includes(editedText.type) && editedText.max_length) {
          const oversized = db.prepare(`SELECT id,"${found.name}" AS value FROM "t_${t}" WHERE length(CAST("${found.name}" AS BLOB)) > ?`).iterate(editedText.max_length);
          for (const row of oversized as Iterable<{id:number;value:string|null}>) { if (row.value != null && row.value.length > editedText.max_length) throw Error(`ตั้งจำนวนตัวอักษรไม่ได้: แถว ${row.id} มีข้อความยาวเกิน ${editedText.max_length} ตัวอักษร กรุณาแก้ข้อมูลเดิมหรือเพิ่มจำนวนที่อนุญาต`); }
        }
        backupBeforeSchema();
        db.transaction(() => { if(found.type === "list" && b.ref_table !== undefined && b.ref_table !== found.ref_table) { const edited = all.find(c=>c.name===found.name)!; if(!edited.is_virtual) for(const row of db.prepare(`SELECT "${found.name}" AS value FROM "t_${t}"`).all() as {value:unknown}[]) checkLists([edited],{[edited.name]:normalizeValue(edited,row.value)}); } assertKeyData(t, all); all.forEach(c => saveColumn(t, c)); syncKeyIndex(db, t); })();
        break;
      }
      case "rename_column": {
        const dependentWorkflow=workflowDependency(t,b.name);if(dependentWorkflow)throw Error("เปลี่ยนชื่อไม่ได้: "+dependentWorkflow+" ใช้คอลัมน์นี้อยู่ กรุณาปรับการตั้งค่าก่อน");
        if (!found) return bad("ไม่พบคอลัมน์", 404);
        assertIdentifier(b.new_name);
        if (cols.some(c => c.name === b.new_name)) return bad("มีคอลัมน์ชื่อนี้แล้ว");
        const renamed = cols.map(c => {
          const out = { ...c, reset_columns:(c.reset_columns||[]).map(n=>n===found.name?b.new_name:n), name: c.name === found.name ? b.new_name : c.name };
          for (const field of FORMULA_FIELDS) out[field] = renameReference(renameReference(renameDereference(c[field] || "", t, found.name, b.new_name, refTablesOf(cols), referenceSchemas()), found.name, b.new_name), found.name, b.new_name, t);
          return out;
        });
        normalizeColumns(renamed, { [t]: renamed });
        backupBeforeSchema();
        db.transaction(() => {
          if (!found.is_virtual) db.prepare(`ALTER TABLE "t_${t}" RENAME COLUMN "${found.name}" TO "${b.new_name}"`).run();
          db.prepare("UPDATE _columns SET name=? WHERE table_name=? AND name=?").run(b.new_name, t, found.name);
          renamed.forEach(c => saveColumn(t, c));
          syncKeyIndex(db,t);
          updateViewColumns(t, found.name, b.new_name); changeRelatedReference(t,found.name,b.new_name);
          for (const s of slices().filter(s => s.table_name === t)) db.prepare("UPDATE _slices SET filter_expr=?,columns_json=? WHERE name=?").run(renameReference(s.filter_expr, found.name, b.new_name), JSON.stringify(s.columns.map(n => n === found.name ? b.new_name : n)), s.name);
          for (const a of actions(t)) db.prepare("UPDATE _actions SET condition_expr=?,values_json=? WHERE name=?").run(renameReference(a.condition_expr, found.name, b.new_name), JSON.stringify(Object.fromEntries(Object.entries(a.values).map(([n, expr]) => [n === found.name ? b.new_name : n, renameReference(expr, found.name, b.new_name)]))), a.name);
          renameExternalFormulas(t, found.name, b.new_name);
        })();
        break;
      }
      case "drop_column": {
        const dependentWorkflow=workflowDependency(t,b.name);if(dependentWorkflow)throw Error("ลบไม่ได้: "+dependentWorkflow+" ใช้คอลัมน์นี้อยู่ กรุณาปรับการตั้งค่าก่อน");
        if (!found) return bad("ไม่พบคอลัมน์", 404);
        if (cols.length === 1) return bad("ต้องเหลืออย่างน้อย 1 คอลัมน์");
        if (found.is_key) return bad("กรุณายกเลิก Key หรือเลือก Key อื่นก่อนลบคอลัมน์นี้");
        const external = externalFormulaUse(t, found.name);
        if (external) return bad(`ลบไม่ได้: สูตรของ "${external}" ใช้ ${t}[${found.name}] อยู่ กรุณาแก้สูตรก่อน`);
        const dependent = slices().find(s => s.table_name === t && references(s.filter_expr).includes(found.name))?.label || actions(t).find(a => Object.hasOwn(a.values, found.name) || [a.condition_expr,...actionConfigExpressions(a.config||{}), ...Object.values(a.values)].some(expr => expr.trim() && references(expr).includes(found.name)))?.label;
        if (dependent) return bad(`ลบไม่ได้: Slice หรือ Action "${dependent}" ใช้ [${found.name}] อยู่ กรุณาแก้การตั้งค่าก่อน`);
        const resetUse=cols.find(c=>c.name!==found.name&&c.reset_on_edit&&c.reset_columns?.includes(found.name));if(resetUse)return bad(`ลบไม่ได้: Reset On Edit ของ "${resetUse.label}" เฝ้าดู [${found.name}] อยู่ กรุณาเปลี่ยนคอลัมน์ที่เฝ้าดูก่อน`);
        const used = cols.find(c => c.name !== found.name && FORMULA_FIELDS.some(f => c[f]?.trim() && references(c[f]!).includes(found.name)));
        if (used) return bad(`ลบไม่ได้: สูตรของ "${used.label}" ใช้ [${found.name}] อยู่ กรุณาแก้สูตรก่อน`);
        backupBeforeSchema();
        foreignKeyTransaction(db, () => {
          db.prepare("DELETE FROM _columns WHERE table_name=? AND name=?").run(t, found.name);
          for(const c of cols.filter(c=>c.name!==found.name&&!c.reset_on_edit&&c.reset_columns?.includes(found.name)))saveColumn(t,{...c,reset_columns:c.reset_columns!.filter(n=>n!==found.name)});
          if (!found.is_virtual) rebuild(t);
          updateViewColumns(t, found.name); changeRelatedReference(t,found.name);
          for (const s of slices().filter(s => s.table_name === t)) db.prepare("UPDATE _slices SET columns_json=? WHERE name=?").run(JSON.stringify(s.columns.filter(n => n !== found.name)), s.name);
        });
        break;
      }
      default: return bad("คำสั่งไม่ถูกต้อง");
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}
async function handleDELETE(_: Request, { params }: { params: { name: string } }) {
  const t = params.name;
  try {
    if (!tableExists(t)) return bad("ไม่พบตาราง", 404);
    const used = db.prepare("SELECT table_name FROM _columns WHERE ref_table=? AND table_name<>?").get(t, t) as { table_name: string } | undefined;
    if (used) return bad(`ลบไม่ได้: ตาราง "${used.table_name}" อ้างอิงตารางนี้อยู่ ให้ลบคอลัมน์อ้างอิงนั้นก่อน`);
    const targetActions=db.prepare("SELECT label FROM _actions WHERE table_name<>? AND kind IN ('open_view','edit_form','new_form','open_detail') AND json_extract(config_json,'$.view_name') IN (SELECT name FROM _views WHERE table_name=?)").get(t,t) as {label:string}|undefined;if(targetActions)return bad(`ลบไม่ได้: Action "${targetActions.label}" เปิด View ของตารางนี้อยู่ กรุณาแก้ Action ก่อน`);
    const external = externalFormulaUse(t);
    if (external) return bad(`ลบไม่ได้: สูตรของ "${external}" อ้างอิงตารางนี้อยู่ กรุณาแก้สูตรก่อน`);
    // Validate metadata before interpolating the table identifier into SQL.
    columnsOf(t);
      const targetViews=new Set((db.prepare("SELECT name FROM _views WHERE table_name=?").all(t) as {name:string}[]).map(v=>v.name));
      const customParent=(db.prepare("SELECT label,display_json FROM _views WHERE kind='custom'").all() as {label:string;display_json:string}[]).find(v=>customTargets(JSON.parse(v.display_json).custom_page).some(name=>targetViews.has(name)));
      if(customParent)throw Error('ลบไม่ได้: หน้ากำหนดเอง "'+customParent.label+'" มีปุ่มเปิด View ของตารางนี้อยู่ กรุณานำออกก่อน');
      const dashboard=db.prepare("SELECT parent.label FROM _views parent JOIN json_each(json_extract(parent.display_json,'$.dashboard_views')) member JOIN _views child ON child.name=member.value WHERE child.table_name=? AND (parent.table_name IS NULL OR parent.table_name<>?) LIMIT 1").get(t,t) as {label:string}|undefined;if(dashboard)throw Error('ลบไม่ได้: แดชบอร์ด "'+dashboard.label+'" ใช้ View ของตารางนี้อยู่ กรุณานำออกก่อน');
    backupBeforeSchema();
    foreignKeyTransaction(db, () => {
      db.prepare(`DROP TRIGGER IF EXISTS "_rt_config_${t}"`).run();
      db.prepare(`DROP TABLE "t_${t}"`).run();
      // Cascades do not run while FK enforcement is disabled.
      for(const c of columnsOf(t)) changeRelatedReference(t,c.name);
      db.prepare("DELETE FROM _columns WHERE table_name=?").run(t);
      db.prepare("DELETE FROM _views WHERE table_name=?").run(t);
      db.prepare("DELETE FROM _slices WHERE table_name=?").run(t);
      db.prepare("DELETE FROM _actions WHERE table_name=?").run(t);

      db.prepare("DELETE FROM _realtime_versions WHERE table_name=?").run(t);
      db.prepare("DELETE FROM _tables WHERE name=?").run(t);
      pruneApplicationActionGrants(db,true);
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}
function updateViewColumns(table: string, old: string, next?: string) {
  const views = db.prepare("SELECT name,columns_json,sort_column,group_column,display_json FROM _views WHERE table_name=?").all(table) as { name: string; columns_json: string; sort_column: string; group_column: string; display_json: string }[];
  for (const v of views) {
    const cols = (JSON.parse(v.columns_json) as string[]).flatMap(n => n === old ? next ? [next] : [] : [n]);
    db.prepare("UPDATE _views SET columns_json=?,sort_column=?,group_column=?,display_json=? WHERE name=?").run(JSON.stringify(cols), v.sort_column === old ? next ?? "id" : v.sort_column, v.group_column === old ? next ?? "" : v.group_column, JSON.stringify(changeDisplayColumn(JSON.parse(v.display_json), old, next)), v.name);
  }
}

export const PATCH = withAuth(handlePATCH);
export const DELETE = withAuth(handleDELETE);
