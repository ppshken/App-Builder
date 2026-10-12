"use client";
import {withDraftExpressionRows,contextualFormDefaults,resetDependentRefChoices,type DraftExpressionScope} from "@/lib/draft-expression";
import {applyEditResets,editResetTriggered} from "@/lib/columns";
import SignatureField from "./SignatureField";
import AttachmentValue from "./AttachmentValue";
import PartOfForms from "./PartOfForms";
import type {ChildGroup} from "@/lib/part-of-records";

import {runtimeViewName} from "@/lib/view-names";
import DecoratedValue from "./DecoratedValue";
import RecordLabel from "./RecordLabel";
import LocationField from "./LocationField";
import LocationMap from "./LocationMap";
import {parseCoordinates} from "@/lib/location";
import {prepareImage} from "@/lib/image-upload";

import {actionNavigationUrl} from "@/lib/action-navigation";
import ExcelTransfer from "./ExcelTransfer";
import ActionButton from "./ActionButton";
import {actionPermission} from "@/lib/action-config";

import {tableAccess} from "@/lib/access";
import {useAuth} from "./AuthProvider";
import TableTabs from "./TableTabs";
import {runtimeJSON, clearRuntimeCache} from "@/lib/runtime-cache";
import ChoiceInput from "./ChoiceInput";
import SearchSelect from "@/app/components/SearchSelect";
import DataFilters from "./DataFilters";
import type {DataFilter} from "@/lib/data-filters";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";

import { useAppSettings } from "./AppSettingsProvider";
import PreviewImage from "./PreviewImage";
import InlineRelated from "./InlineRelated";
import PagedList from "./PagedList";
import type { RelatedList } from "@/lib/lists";
import Link from "next/link";
import AppLoading from "@/app/components/AppLoading";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import RuntimeScreen from "@/app/components/RuntimeScreen";
import EditorDialog from "@/app/components/EditorDialog";
import Icon from "@/app/components/Icon";
import { Column, formState, enumListLabel, enumListImage, labelTextColumn, refTablesOf } from "@/lib/columns";
import { dateTimeInput, dateTimeLabel } from "@/lib/datetime";
import { displaySettings } from "@/lib/view-display";
import { AppView, visibleColumns, relatedInlineView, relatedTitle } from "@/lib/views";
import type { RowAction, Slice } from "@/lib/automation";
import { asBoolean, evaluateExpression, ExpressionTable } from "@/lib/expression";
type Table = { name: string; label: string; columns: Column[]; related?: RelatedList[] };

export default function RuntimeTable({ draftExpressionScope, onDraftSaved,draftValues,parentLink, table, selectedRow, runtimeView, referenceViews = [], inlineViews = [], initialRow, initialValues, initialEdit = false, previewEmail: suppliedEmail = "", onOpenReference, onScreenChange, onReturn, onCloseDetails, onSavedDetail, onDataChange, onNavigate, successMessage = "", registerNavigationGuard, onReady, dataRevision = 0 }: {draftExpressionScope?:DraftExpressionScope;onDraftSaved?:(values:Record<string,any>,options?:{reopen?:boolean})=>void|Promise<void>;draftValues?:Record<string,any>;parentLink?:string; dataRevision?:number; onReady?:()=>void; table: string; selectedRow?:number; runtimeView?: AppView; referenceViews?: AppView[]; inlineViews?: AppView[]; initialRow?: number; initialValues?:Record<string,unknown>; initialEdit?: boolean; previewEmail?: string; onOpenReference?: (table: string, id: number, kind?:"detail"|"form") => void; onScreenChange?: (name: string, open: boolean, id?: number,title?:string) => void; onReturn?: (message?: string) => void; onCloseDetails?: () => void; onSavedDetail?:(table:string,id:number,message:string)=>void; onNavigate?: (view: AppView, id?: number,values?:Record<string,unknown>) => void; successMessage?: string; registerNavigationGuard?: (guard: (() => boolean) | null) => void; onDataChange?: () => void }) {
  const {settings: appSettings} = useAppSettings();
  const {user,access,expressionUser}=useAuth(), rights=tableAccess(access,table), previewEmail=user?.email || suppliedEmail;
  const [allTables,setAllTables]=useState<Table[]>([]);
  const [excelOpen,setExcelOpen]=useState(false);
  const [clearOpen,setClearOpen]=useState(false),[clearConfirmation,setClearConfirmation]=useState(""),[clearError,setClearError]=useState("");
  async function clearAll(){if(busy||clearConfirmation!=="เคลียร์ข้อมูลทั้งหมด")return;setBusy(true);setClearError("");try{const r=await fetch(`/api/data/${table}/clear`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmation:clearConfirmation})}),j=await r.json();if(!r.ok)throw Error(j.error);clearRuntimeCache("data");setClearOpen(false);setClearConfirmation("");setForm(null);setDetail(null);setSaved(`เคลียร์ข้อมูลทั้งหมดแล้ว ${j.deleted} รายการ · ID ใหม่เริ่มที่ 1`);await load();onDataChange?.();}catch(e){setClearError((e as Error).message);}finally{setBusy(false);}}
  const [relatedViews,setRelatedViews] = useState<AppView[]>([]), [hiddenInline,setHiddenInline] = useState<string[]>([]);
  const [rowActions, setRowActions] = useState<RowAction[]>([]), [sliceColumns, setSliceColumns] = useState<string[]>([]), [pendingAction, setPendingAction] = useState<{action:RowAction;row:any}|null>(null);
  const sliceQuery = runtimeView?.slice_name ? `&slice=${encodeURIComponent(runtimeView.slice_name)}` : "";
  const requestHeaders = { "x-nocode-preview-email": previewEmail };
  const [meta, setMeta] = useState<Table | null | false>(null), [rows, setRows] = useState<any[]>([]), [refs, setRefs] = useState<Record<string, any[]>>({});
  const [rowsLoading,setRowsLoading]=useState(true),[refreshVisible,setRefreshVisible]=useState(false), rowRequest=useRef(0);
  useEffect(()=>{setRefreshVisible(false);if(!rowsLoading)return;const timer=setTimeout(()=>setRefreshVisible(true),180);return()=>clearTimeout(timer);},[rowsLoading]);
  const [expressionTables, setExpressionTables] = useState<Record<string, ExpressionTable>>({});
  const expressionOptions = { ...expressionUser, tables: withDraftExpressionRows(expressionTables,draftExpressionScope), refTables: meta ? refTablesOf(meta.columns) : {} };
  async function fetchExpressionTables(displayOnly=false) { const r = await fetch(`/api/expression-data?table=${encodeURIComponent(table)}${displayOnly ? "&display=1" : ""}`, { headers: requestHeaders }), j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }
  const [filters,setFilters]=useState<DataFilter[]>([]),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[total,setTotal]=useState(0),[pages,setPages]=useState(1);
  const activeFilters=JSON.stringify(filters.filter(f=>["empty","not_empty"].includes(f.op)||f.value?.trim()));
  const [q, setQ] = useState(""), [sort, setSort] = useState(runtimeView?.sort_column || "id"), [dir, setDir] = useState(runtimeView?.sort_dir || "desc");
  const [searchTerm,setSearchTerm]=useState("");
  useEffect(()=>{const timer=setTimeout(()=>{setSearchTerm(q);setPage(1);},q?200:0);return()=>clearTimeout(timer);},[q]);
  const [signaturePending,setSignaturePending]=useState<Record<string,boolean>>({});
  const [gpsPending,setGpsPending]=useState<Record<string,boolean>>({});
  const [saveConflict,setSaveConflict]=useState(false),[reloadConflict,setReloadConflict]=useState(false);
  const [form, setForm] = useState<Record<string, any> | null>(null), [formTime, setFormTime] = useState(new Date());
  const [err, setErr] = useState(""), [loadErr, setLoadErr] = useState(""), [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false);
  const [childAdd,setChildAdd]=useState<{table:string;column:string;id:number;part:boolean;key?:string}|null>(null),[relatedRevision,setRelatedRevision]=useState(0);
  const [deletion, setDeletion] = useState<number | null>(null);
  const [view, setView] = useState<"table" | "list">("table"), [detail, setDetail] = useState<any | null>(null);
  const formView = runtimeView?.kind === "form" ? runtimeView : referenceViews.find(v => v.table_name === table && v.kind === "form") || (!runtimeView ? relatedViews.find(v=>v.table_name===table&&v.kind==="form"&&v.position==="ref") : undefined);
  const detailView = runtimeView?.kind === "detail" ? runtimeView : referenceViews.find(v => v.table_name === table && v.kind === "detail") || (!runtimeView ? relatedViews.find(v=>v.table_name===table && v.kind==="detail" && v.position==="ref") : undefined);
  const Screen = onDraftSaved || runtimeView ? RuntimeScreen : EditorDialog;
  const initialDetailOpened = useRef(false);
  const editOrigin = useRef<any>(null),leaving=useRef(false);
  const openDetail = (row: any) => { setSaved(""); if (onNavigate && detailView) onNavigate(detailView, row.id); else setDetail(row); };
  useEffect(() => { if (runtimeView) onScreenChange?.((form ? formView : detail ? detailView : runtimeView)?.name || runtimeView.name, !!(form || detail), form?.id || detail?.id,form ? (form.id?"แก้ไข · ":"เพิ่ม · ")+String(form.__label||formView?.label||runtimeView.label) : detail ? String(detail.__label??detailView?.label??runtimeView.label) : undefined); }, [runtimeView?.name, formView?.name, detailView?.name, !!form, !!detail, form?.id, detail?.id, detail?.__label,form?.__label,onScreenChange]);
  const [initialForm, setInitialForm] = useState(""), [discard, setDiscard] = useState(false), [saved, setSaved] = useState("");
  useEffect(() => { registerNavigationGuard?.(() => { if(leaving.current)return true; if (busy) return false; if (form && (JSON.stringify(form) !== initialForm || Object.values(signaturePending).some(Boolean))) { setDiscard(true); return false; } return true; }); return () => registerNavigationGuard?.(null); }, [form, initialForm, busy, signaturePending, registerNavigationGuard]);
  useEffect(() => {
    const media = window.matchMedia("(max-width:760px)");
    const change = () => setView(runtimeView ? runtimeView.kind === "table" ? "table" : "list" : media.matches ? "list" : "table");
    change(); media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [runtimeView?.name,runtimeView?.kind]);
  useEffect(() => {
    let active = true;
    setMeta(null); setForm(null); setLoadErr("");setPage(1);setFilters([]);setQ("");setSearchTerm("");
    (async () => {
      const [all, expressionData, visible, viewRegistry, actions, slices] = await Promise.all([
        runtimeJSON("/api/tables"), runtimeJSON(`/api/expression-data?table=${encodeURIComponent(table)}&display=1`,previewEmail,15000),
        runtimeJSON("/api/views?runtime=1",previewEmail,15000), runtimeJSON("/api/views"),
        runtimeView ? runtimeJSON("/api/actions") : [], runtimeView ? runtimeJSON("/api/slices") : []
      ]);
      const m = all.find((t: Table) => t.name === table);
      if (!active) return;
      if (!m) { setMeta(false); return; }
      setAllTables(all);setExpressionTables(expressionData); setRelatedViews(viewRegistry.map((v:AppView)=>runtimeViewName(v))); setHiddenInline(visible.hidden);
      setRowActions(actions.filter((a:RowAction)=>a.table_name===table));
      setSliceColumns(slices.find((s:Slice)=>s.name===runtimeView?.slice_name)?.columns || []);
      setRefs({}); setMeta({...m,columns:m.columns.map((c:Column)=>c.ref_table&&!tableAccess(access,c.ref_table).read?{...c,is_editable:false}:c)});

    })().catch(e => { if (active) { setLoadErr(e.message || "โหลดตารางไม่ได้"); setMeta(false); } });
    return () => { active = false; };
  }, [table, previewEmail, runtimeView?.slice_name]);
  const load = useCallback(async (signal?: AbortSignal) => {
    const ticket=++rowRequest.current;setRowsLoading(true);
    try {
      const r = await fetch(`/api/data/${table}?q=${encodeURIComponent(searchTerm)}&sort=${sort}&dir=${dir}&page=${page}&page_size=${pageSize}&filters=${encodeURIComponent(activeFilters)}${sliceQuery}`, { signal, headers: requestHeaders }), j = await r.json();
      if (!r.ok) throw new Error(j.error); if(ticket!==rowRequest.current)return;setRows(j.rows);setTotal(j.total);setPages(j.pages);setPage(j.page); setLoadErr("");
    } catch (e) { if (!signal?.aborted&&ticket===rowRequest.current) setLoadErr(e instanceof Error ? e.message : "โหลดข้อมูลไม่ได้ กรุณาลองใหม่"); }
    finally {if(ticket===rowRequest.current)setRowsLoading(false);}
  }, [table, searchTerm, sort, dir, previewEmail, sliceQuery,page,pageSize,activeFilters]);
  useEffect(() => { const controller = new AbortController(); if (meta) { if (initialRow || runtimeView?.kind === "form") setRowsLoading(false); else load(controller.signal); } return () => controller.abort(); }, [meta, load, initialRow, runtimeView?.kind, dataRevision]);
  const [uniqueResult,setUniqueResult]=useState<{signature:string;errors:Record<string,string>}>({signature:"",errors:{}});
  const originalRow = initialForm ? JSON.parse(initialForm) : undefined;
  const state = useMemo(() => meta && form ? formState(meta.columns, form, formTime, previewEmail, expressionOptions, form.id ? originalRow : undefined) : null, [meta, form, formTime, previewEmail, expressionTables, expressionUser, initialForm, draftExpressionScope]);
  const uniqueDraft=meta&&form&&state&&meta.columns.some(c=>!c.is_virtual&&(c.is_unique||c.is_key))?JSON.stringify({id:form.id,values:Object.fromEntries(meta.columns.filter(c=>!c.is_virtual&&(c.is_unique||c.is_key)).map(c=>[c.name,state.row[c.name]]))}):"";
  const uniqueErrors=uniqueResult.signature===uniqueDraft?uniqueResult.errors:{};
  useEffect(()=>{if(!uniqueDraft)return;const controller=new AbortController(),timer=setTimeout(()=>{fetch('/api/data/'+table+'/validate',{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json"},body:uniqueDraft}).then(async r=>{const j=await r.json();if(r.ok&&!controller.signal.aborted)setUniqueResult({signature:uniqueDraft,errors:j.errors});}).catch(()=>{});},250);return()=>{clearTimeout(timer);controller.abort();};},[uniqueDraft,table]);
  useEffect(()=>{if(!form||!meta||!state||!initialForm)return;const initial=JSON.parse(initialForm);const locked=meta.columns.filter(c=>!c.is_virtual && !state.editable[c.name] && !(()=>{try{return editResetTriggered(c,meta.columns,initial,form);}catch{return false;}})() && JSON.stringify(form[c.name])!==JSON.stringify(initial[c.name]));if(locked.length)setForm(old=>old?{...old,...Object.fromEntries(locked.map(c=>[c.name,initial[c.name]]))}:old);},[form,meta,state,initialForm]);
  async function loadFormRefs() {
    if (!meta) return;
    const out: Record<string, any[]> = {};
    await Promise.all(meta.columns.filter(c=>c.type === "ref" && c.ref_table && tableAccess(access,c.ref_table).read).map(async c=>{
      out[c.name] = await runtimeJSON(`/api/data/${c.ref_table}?sort=id&dir=asc`,previewEmail,15000);
    }));
    setRefs(out);
  }
  async function add() {
    if(!meta)return;
    if(draftValues?.id ? !rights.update : !rights.create){setErr("ไม่มีสิทธิ์บันทึกข้อมูลในตารางนี้");return;}
    if (onNavigate && formView && runtimeView?.kind !== "form") { onNavigate(formView); return; }
    editOrigin.current = null;leaving.current=false;
    setBusy(true); setErr(""); setAttempted(false);
    try {
      const [defaults,expressionData] = await Promise.all([draftValues?.id ? Promise.resolve({values:{}}) : fetch(`/api/data/${table}?defaults=1`, { headers: requestHeaders }).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);return j;}),fetchExpressionTables(),loadFormRefs()]);
      const j=defaults;setExpressionTables(expressionData);
      const supplied={...Object.fromEntries(Object.entries(initialValues||{}).filter(([name])=>meta&&meta.columns.some(c=>c.name===name&&!c.is_virtual&&c.is_editable!==false&&c.is_editable!==0))),...(draftValues||{})},now=new Date();const opened=draftValues?.id?{...j.values,...supplied}:contextualFormDefaults(meta.columns,j.values,supplied,now,previewEmail,{...expressionUser,tables:withDraftExpressionRows(expressionData,draftExpressionScope)});setFormTime(now); setForm(opened); setInitialForm(JSON.stringify(opened)); setSaved("");
    } catch (e) { setErr(e instanceof Error ? e.message : "เปิดฟอร์มไม่ได้ กรุณาตรวจสูตรค่าเริ่มต้น"); }
    finally { if(!leaving.current)setBusy(false); }
  }
  async function save() {
    if (!form || !state || !meta) return;
    setAttempted(true); setErr("");
    if(Object.values(signaturePending).some(Boolean))return setErr("กรุณากดใช้ลายเซ็นหรือล้างลายเซ็นก่อนบันทึก");
    if(Object.values(gpsPending).some(Boolean))return setErr("กำลังหาตำแหน่ง กรุณารอให้ได้พิกัดก่อนบันทึก");
    const missingGps=meta.columns.find(c=>c.gps_auto&&!c.is_virtual&&state.editable[c.name]&&!parseCoordinates(form[c.name]));
    if(missingGps)return setErr(`กรุณาดึงตำแหน่งของ "${missingGps.label}" ก่อนบันทึก หากยังไม่ได้อนุญาตให้เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์`);
    const relevant=(errors:Record<string,string>)=>Object.entries(errors).find(([name])=>!onDraftSaved||name!==parentLink)?.[1];
    const error = relevant(state.errors) || relevant(uniqueErrors) || relevant(state.validation);
    if (error) return setErr(error);
    setBusy(true);
    try {
      const body = Object.fromEntries(meta.columns.filter(c => !c.is_virtual && state.editable[c.name] && (!onDraftSaved||c.name!==parentLink)).map(c => [c.name, state.row[c.name]]));
      if(form.id&&form.__version)body.__version=form.__version;
      if(form.__children)body.__children=form.__children;
      if(onDraftSaved){const preview={...state.row};for(const c of meta.columns.filter(c=>c.type==='ref')){const target=refs[c.name]?.find(r=>String(r.id)===String(state.row[c.name]));if(target){preview[c.name+'__label']=target.__label;preview[c.name+'__image']=target.__image;}}await onDraftSaved({...body,__display:preview,...(formView&&relatedViews.some(v=>v.name===formView.name)?{__form_view:formView.name}:{})},{reopen:!!formDisplay.form_reopen});return;}
      const r = await fetch(`/api/data/${table}${form.id ? `?id=${form.id}` : ""}${formView&&relatedViews.some(v=>v.name===formView.name)?`${form.id?"&":"?"}form_view=${encodeURIComponent(formView.name)}`:""}`, { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json", ...requestHeaders }, body: JSON.stringify(body) }), j = await r.json();
      if (!r.ok) { if(r.status===409)setSaveConflict(true);if(j.errors)setUniqueResult({signature:uniqueDraft,errors:j.errors});throw new Error(j.error); }
      clearRuntimeCache("data");
      if(j.action?.url){leaving.current=true;location.assign(j.action.url);return;}
      if(j.action?.navigate){const target=relatedViews.find(v=>v.name===j.action.navigate.name);if(target&&onNavigate){leaving.current=true;onDataChange?.();onNavigate(target,j.action.navigate.id,j.action.navigate.initialValues);}else{leaving.current=true;location.assign(actionNavigationUrl(j.action.navigate.name,j.action.navigate.id,j.action.navigate.initialValues));}return;}
      if(formDisplay.form_reopen&&rights.create){editOrigin.current=null;setForm(null);setDetail(null);onDataChange?.();await add();setSaved("บันทึกข้อมูลแล้ว · พร้อมเพิ่มรายการใหม่");return;}
      if(j.action?.deleted){setForm(null);setDetail(null);onDataChange?.();if(onReturn){leaving.current=true;onReturn("บันทึกและทำ Action แล้ว");}else{setSaved("บันทึกและทำ Action แล้ว");await load();}return;}
      if(formDisplay.form_after_save==="detail") {
        const id=Number(j.id||form.id),message="บันทึกข้อมูลแล้ว";
        if(onSavedDetail&&runtimeView?.kind==="form"){leaving.current=true;onDataChange?.();onSavedDetail(table,id,message);return;}
        editOrigin.current=null;setForm(null);setSaved(message);onDataChange?.();
        try{const response=await fetch("/api/data/"+table+"?id="+id,{headers:requestHeaders}),fresh=await response.json();if(!response.ok||!fresh.length)throw Error("บันทึกแล้ว แต่เปิดรายละเอียดไม่ได้ ข้อมูลอาจไม่อยู่ในสิทธิ์ที่ดูได้");setDetail(fresh[0]);}catch(e){setDetail(null);setErr((e as Error).message);}
        await load();return;
      }
      if (editOrigin.current) { const response = await fetch(`/api/data/${table}?id=${form.id}${sliceQuery}`, { headers: requestHeaders }); const fresh = await response.json(); if (response.ok && fresh.length) setDetail(fresh[0]); else setDetail({ ...editOrigin.current, ...body }); editOrigin.current = null; }
      if(runtimeView?.kind==="form"&&onReturn){leaving.current=true;setSaved("บันทึกข้อมูลแล้ว");onDataChange?.();onReturn("บันทึกข้อมูลแล้ว");return;}
      setForm(null); setSaved("บันทึกข้อมูลแล้ว"); await load(); onDataChange?.(); if (runtimeView?.kind === "form" && onNavigate) onReturn?.("บันทึกข้อมูลแล้ว");
    } catch (e) { setErr(e instanceof Error ? e.message : "บันทึกไม่ได้ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/data/${table}?id=${deletion}`, { method: "DELETE", headers: requestHeaders }), j = await r.json();
      if (!r.ok) throw new Error(j.error); clearRuntimeCache("data"); if(runtimeView&&["detail","form"].includes(runtimeView.kind)&&onReturn){leaving.current=true;setDeletion(null);onDataChange?.();onReturn("ลบข้อมูลแล้ว");return;} setDeletion(null); setDetail(null); setForm(null); setSaved("ลบข้อมูลแล้ว"); await load(); onDataChange?.(); if (runtimeView && ["detail", "form"].includes(runtimeView.kind)) onReturn?.("ลบข้อมูลแล้ว");
    } catch (e) { setErr(e instanceof Error ? e.message : "ลบข้อมูลไม่ได้"); }
    finally { setBusy(false); }
  }
  const closeForm = () => {
    if (busy) return;
    if (JSON.stringify(form) !== initialForm || Object.values(signaturePending).some(Boolean)) { setDiscard(true); return; }
    if((onDraftSaved||runtimeView?.kind==="form"&&!editOrigin.current)&&onReturn){leaving.current=true;onReturn();return;}
    setForm(null); setErr(""); if (editOrigin.current) { setDetail(editOrigin.current); editOrigin.current = null; } else if (runtimeView?.kind === "form") onReturn?.();
  };
  const editRow = async (row: any) => {
    if (!meta) return;
    if(!rights.update||row.__permissions?.update===false){openDetail(row);return;}
    if (onNavigate && formView && runtimeView?.kind !== "form") { onNavigate(formView, row.id); return; }
    editOrigin.current = detail;leaving.current=false;
    setBusy(true); setErr("");
    try { const [expressionData]=await Promise.all([fetchExpressionTables(),loadFormRefs()]);setExpressionTables(expressionData);
    const value = Object.fromEntries(["id", "__version", ...meta.columns.filter(c => !c.is_virtual).map(c => c.name)].map(k => [k, row[k]]));
    setSaveConflict(false);setErr(""); setAttempted(false); setFormTime(new Date()); setForm(value); setInitialForm(JSON.stringify(value)); setDetail(null); setSaved("");
    } catch(e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => { if (runtimeView) { setSort(runtimeView.sort_column); setDir(runtimeView.sort_dir); } }, [runtimeView?.name, runtimeView?.sort_column, runtimeView?.sort_dir]);
  useEffect(() => {
    if (!initialRow || !meta) return;
    const controller = new AbortController();
    fetch(`/api/data/${table}?id=${initialRow}${sliceQuery}`, { signal: controller.signal, headers: requestHeaders }).then(async r => {
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      if (!j.length) throw new Error("ไม่พบแถวที่อ้างอิง อาจถูกลบไปแล้ว"); if (runtimeView?.kind === "form" || initialEdit) await editRow(j[0]); else setDetail(j[0]);
    }).catch(e => { if (!controller.signal.aborted) setLoadErr(e.message); });
    return () => controller.abort();
  }, [initialRow, initialEdit, table, previewEmail, !!meta, runtimeView?.kind==="detail"?dataRevision:0]);
  useEffect(() => { if (meta && runtimeView?.kind === "form" && !initialRow) add(); }, [!!meta, runtimeView?.name]);
  useEffect(() => { if (runtimeView?.kind === "detail" && !initialRow && rows.length && !initialDetailOpened.current) { initialDetailOpened.current = true; setDetail(rows[0]); } }, [runtimeView?.kind, initialRow, rows]);
  const ready=meta===false||!!meta&&(runtimeView?.kind==="form"?!!form||!!err||!!loadErr:initialRow||runtimeView?.kind==="detail"?!!detail||!!loadErr||(!initialRow&&!rowsLoading&&rows.length===0):!rowsLoading);
  useEffect(()=>{if(ready)onReady?.();},[ready,onReady]);
  const closeDetail = () => { if (busy) return; if(runtimeView?.kind==="detail"&&onReturn){onReturn();return;}setDetail(null); };
  // A child editor never renders the table list while metadata/defaults load.
  if (onDraftSaved && !form) return <RuntimeScreen className="runtime-child-screen" title={runtimeView?.label||"รายการลูก"} busy={busy} onClose={()=>onReturn?.()}>
    {loadErr||err||meta===false?<div className="error-banner" role="alert">{loadErr||err||"ไม่พบตารางนี้"}</div>:<AppLoading/>}
    {meta&&err&&<button type="button" disabled={busy} onClick={add}>ลองเปิดฟอร์มอีกครั้ง</button>}
  </RuntimeScreen>;
  if (meta === null) return <AppLoading/>;
  if (meta === false) return <><p>{loadErr || "ไม่พบตารางนี้"}</p><Link href="/">กลับหน้าหลัก</Link></>;
  const sourceCols = visibleColumns(meta.columns, sliceColumns);
  const internalId: Column = {name:"id",label:"id · รหัสภายใน",type:"number",is_editable:false};
  const displayCols = runtimeView ? visibleColumns(sourceCols, runtimeView.columns) : [internalId,...meta.columns];
  const listDisplay = displaySettings(runtimeView?.display, runtimeView ? appSettings.display_defaults[runtimeView.kind === "table" ? "table" : "list"] : {...appSettings.display_defaults.list,...appSettings.display_defaults.table}), detailDisplay = displaySettings(detailView?.display, appSettings.display_defaults.detail), formDisplay = displaySettings(formView?.display, appSettings.display_defaults.form);
  const detailCols = runtimeView ? visibleColumns(sourceCols, detailView?.columns || []) : [internalId,...visibleColumns(sourceCols, detailView?.columns || [])], configuredFormCols = visibleColumns(sourceCols, formView?.columns || []);
  const formCols = [...configuredFormCols, ...meta.columns.filter(c => state && state.visible[c.name] && (state.required[c.name] || state.validation[c.name] || state.errors[c.name]) && !configuredFormCols.some(f => f.name === c.name))];
  const relatedDisplay = displaySettings((runtimeView ? detailView : relatedViews.find(v=>v.table_name===table && v.kind==="detail" && v.position==="ref"))?.display).related;
  const addRelated=(r:RelatedList)=>{if(!detail)return;const column=allTables.find(t=>t.name===r.table)?.columns.find(c=>c.name===r.column);if(!column||!tableAccess(access,r.table).create||column.is_part_of&&(!rights.update||detail.__permissions?.update===false))return;try{if(column.is_part_of&&column.part_add_if?.trim()&&!asBoolean(evaluateExpression(column.part_add_if,detail,{...expressionOptions,userEmail:previewEmail})))return;}catch{return;}return ()=>setChildAdd({table:r.table,column:r.column,id:detail.id,part:!!column.is_part_of});};
  const coverColumn = detailDisplay.detail_cover_column === "__auto__" ? detailCols.find(c=>c.type==="image") : sourceCols.find(c=>c.type==="image" && c.name===detailDisplay.detail_cover_column);
  const coverSrc = detailDisplay.detail_image_mode === "cover" && coverColumn && detail?.[coverColumn.name] && !detail.__errors?.[coverColumn.name] ? detail[coverColumn.name] : "";
  const renderedDetailCols = detailCols.filter(c=>!(coverSrc && c.name===coverColumn?.name) && !(detailDisplay.detail_hide_empty && !detail?.__errors?.[c.name] && (detail?.[c.name] == null || detail[c.name] === "" || Array.isArray(detail[c.name]) && !detail[c.name].length)));
  const detailPageStyle = { "--detail-padding": `${detailDisplay.detail_padding}px`, "--detail-spacing": `${detailDisplay.detail_row_spacing}px`, "--detail-line-height": detailDisplay.detail_line_height, "--detail-cover-height": `${detailDisplay.detail_cover_height}px`, "--detail-image-radius": `${detailDisplay.detail_image_radius}px` } as React.CSSProperties;
  const show = (c: Column, row: any) => c.type === "datetime" ? dateTimeLabel(row[c.name]) : c.type === "image" ? row[c.name] ? "รูปภาพ" : "" : c.type === "list" ? `${row[`${c.name}__labels`]?.join(" · ") || (row[c.name] || []).slice(0,c.list_limit || undefined).join(" · ")}${(c.list_limit && row[c.name]?.length > c.list_limit) ? ` · อีก ${row[c.name].length-c.list_limit} รายการ` : ""}` : c.type === "enumlist" ? (row[c.name] || []).map((v: string) => enumListLabel(c, v, expressionOptions)).join(" · ") : c.type === "ref" ? row[`${c.name}__label`] ?? refs[c.name]?.find(r => r.id === row[c.name])?.__label ?? "" : c.type === "yesno" ? row[c.name] == null ? "" : row[c.name] ? "ใช่" : "ไม่ใช่" : row[c.name] ?? "";
  const baseDisplay = (c: Column, row: any) => { const value = show(c, row); if(["color","signature","file"].includes(c.type))return <AttachmentValue column={c} value={row[c.name]}/>; if (c.type === "longtext") return <span className="longtext-value">{c.name===labelTextColumn(meta.columns)?<RecordLabel text={value||"—"} image={row.__image}/>:value || "—"}</span>; if (c.type === "image" && row[c.name]) return <PreviewImage className="data-image" src={row[c.name]} alt={c.label} loading="lazy"/>; if(c.type==="ref")return <RecordLabel text={value||"—"} image={row[`${c.name}__image`]}/>;if(c.type==="enum"&&c.ref_table)return <RecordLabel text={enumListLabel(c,String(row[c.name]??""),expressionOptions)||"—"} image={enumListImage(c,String(row[c.name]??""),expressionOptions)}/>;if(c.type==="enumlist")return <span className="row-label-list">{(row[c.name]||[]).map((v:string)=><RecordLabel key={v} text={enumListLabel(c,v,expressionOptions)} image={enumListImage(c,v,expressionOptions)}/>)}</span>;if(c.name===labelTextColumn(meta.columns)&&c.type!=="image")return <RecordLabel text={value===""?"—":value} image={row.__image}/>;return value === "" ? "—" : value; };
  const groupColumn = runtimeView && ["list", "table"].includes(runtimeView.kind) ? runtimeView.group_column || "" : "";
  const groupMeta = meta.columns.find(c => c.name === groupColumn);
  const groups: { key: string; label: string; value: any; rows: any[] }[] = [];
  if (groupColumn && ["list", "table"].includes(runtimeView!.kind)) {
    const byKey = new Map<string, typeof groups[number]>();
    for (const row of rows) {
      const value = row[groupColumn], key = value == null || value === "" || Array.isArray(value) && !value.length ? "empty" : JSON.stringify(value);
      if (!byKey.has(key)) byKey.set(key, { key, value, label: key === "empty" ? "ไม่ระบุ" : String(groupMeta ? show(groupMeta, row) : value), rows: [] });
      byKey.get(key)!.rows.push(row);
    }
    groups.push(...byKey.values());
    groups.sort((a, b) => (typeof a.value === "number" && typeof b.value === "number" && groupMeta?.type !== "ref" ? a.value - b.value : a.label.localeCompare(b.label, "th", { numeric: true })) * (runtimeView?.group_dir === "desc" ? -1 : 1));
  } else groups.push({ key: "all", label: "", value: null, rows });
  const titleCol = sourceCols.find(c => c.name === listDisplay.title_column);
  const display = (c:Column,row:any,appearance=listDisplay) => <DecoratedValue column={c.name} row={row} config={appearance.data_styles[c.name]} options={{...expressionOptions,refTables:refTablesOf(meta.columns),userEmail:previewEmail}}>{baseDisplay(c,row)}</DecoratedValue>;
  const listTitle = (row: any) => titleCol ? String(show(titleCol, row) || "—") : String(row.__label ?? `รายการที่ ${row.id}`);
  const summaryCols = listDisplay.summary_columns === null ? displayCols.filter(c => !c.is_label && c.type !== "image").slice(0, 3) : visibleColumns(sourceCols, listDisplay.summary_columns).filter(c => listDisplay.summary_columns!.includes(c.name));
  const imageCol = listDisplay.image_column === "__auto__" ? displayCols.find(c=>c.type==="image"&&c.is_label)||displayCols.find(c => c.type === "image") : sourceCols.find(c => c.name === listDisplay.image_column && c.type === "image");
  const compactLabelImage = !!imageCol?.is_label || listDisplay.image_column==="__auto__"&&meta.columns.some(c=>c.is_label&&c.type==="image");
  function updateFormField(name:string,value:any){if(!form||!meta)return;setErr("");const next={...form,[name]:value},now=new Date();try{const result=applyEditResets(meta.columns,initialForm?JSON.parse(initialForm):form,next,now,previewEmail,expressionOptions);setForm(resetDependentRefChoices(meta.columns,result.row,name,now,previewEmail,expressionOptions));if(result.reset.size)setFormTime(now);}catch(e){setForm(next);setErr((e as Error).message);}}
  const input = (c: Column) => {
    const id = onDraftSaved?`data-part-${table}-${c.name}`:`data-${c.name}`, value = form![c.name], error = state!.errors[c.name] || uniqueErrors[c.name] || (attempted ? state!.validation[c.name] : "");
    const set = (v: any) => updateFormField(c.name,v);
    const common = { id, disabled: busy || !state!.editable[c.name], "aria-required": state!.required[c.name], "aria-invalid": !!error, "aria-describedby": [error ? `${id}-error` : "", runtimeView && formDisplay.form_fields[c.name]?.help ? `${id}-help` : ""].filter(Boolean).join(" ") || undefined };
    if (c.type === "list") { const selected = Array.isArray(value) ? value : []; if(c.is_virtual) return <PagedList refreshRevision={dataRevision} title={c.label} table={c.ref_table || undefined} values={state!.row[c.name] as string[] || []} limit={c.list_limit ?? 5} email={previewEmail} onOpen={onOpenReference}/>; if(c.ref_table) return <PagedList refreshRevision={dataRevision} title={c.label} table={c.ref_table} values={state!.choices[c.name]} limit={c.list_limit ?? 5} email={previewEmail} selectValues={selected} onSelect={set} disabled={common.disabled}/>; return <><textarea {...common} rows={4} value={typeof value === "string" ? value : JSON.stringify(value || [])} onChange={e=>set(e.target.value)}/><small className="hint">กรอกรายการ เช่น ["ค่าแรก","ค่าที่สอง"] หรือกำหนดสูตรค่าเริ่มต้นในคอลัมน์</small></>; }
    if (c.is_virtual) return <output className="computed" id={id} aria-live="polite">{error ? "คำนวณไม่ได้" : display(c, state!.row)}</output>;
    if(c.type === "latlong") return <LocationField id={id} label={c.label} value={value} auto={!!c.gps_auto} newRow={!form!.id} editable={!!state!.editable[c.name]} disabled={busy} required={common["aria-required"]} invalid={common["aria-invalid"]} describedBy={common["aria-describedby"]} onChange={set} onStatus={status=>setGpsPending(old=>old[c.name]===status.pending?old:{...old,[c.name]:status.pending})}/>;
    if(c.type === "color")return <div className="color-field"><input type="color" aria-label={"เลือกสี "+c.label} disabled={common.disabled} value={/^#[a-f0-9]{6}$/i.test(value||"")?value:"#2563eb"} onChange={e=>set(e.target.value)}/><input {...common} placeholder="#2563EB" maxLength={7} value={value??""} onChange={e=>set(e.target.value)}/><button type="button" disabled={common.disabled||!value} onClick={()=>set(null)}>ล้างสี</button></div>;
    if(c.type === "signature")return !state!.editable[c.name]?<AttachmentValue column={c} value={value}/>:<SignatureField id={id} label={c.label} value={value} disabled={common.disabled} table={table} column={c.name} onChange={set} onBusy={setBusy} onError={setErr} onPending={pending=>setSignaturePending(old=>old[c.name]===pending?old:{...old,[c.name]:pending})}/>;
    if(c.type === "file")return <div className="file-field">{value&&<AttachmentValue column={c} value={value}/>}<div className="row"><button type="button" disabled={common.disabled} onClick={()=>document.getElementById(id)?.click()}>{value?"เปลี่ยนไฟล์":"เลือกไฟล์"}</button>{value&&<button type="button" disabled={common.disabled} onClick={()=>set(null)}>นำไฟล์ออก</button>}</div><input {...common} type="file" className="sr-only" tabIndex={-1} onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;setBusy(true);setErr("");try{if(file.size>20*1024*1024)throw Error("ไฟล์ต้องมีขนาดไม่เกิน 20 MB");const body=new FormData();body.append("file",file);body.append("table",table);body.append("column",c.name);const r=await fetch("/api/files",{method:"POST",body}),j=await r.json();if(!r.ok)throw Error(j.error);set(j.url);}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}}/><small className="hint">ไฟล์ไม่เกิน 20 MB · เปิดในแท็บใหม่เมื่อเบราว์เซอร์รองรับ</small></div>;
    if (c.type === "image") return <div className="image-field">{value && <PreviewImage className="image-field-preview" src={value} alt={c.label}/>}<div className="row image-field-buttons"><button type="button" disabled={common.disabled} onClick={() => document.getElementById(id)?.click()}>{value ? "เปลี่ยนรูปภาพ" : "เลือกรูปภาพ"}</button>{value && <button type="button" disabled={common.disabled} onClick={() => set(null)}>นำรูปภาพออก</button>}</div><input {...common} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;

      setBusy(true); setErr(""); try { const body = new FormData(); body.append("file", await prepareImage(file,appSettings)); body.append("table",table);body.append("column",c.name); const r = await fetch("/api/images", { method: "POST", body }), j = await r.json(); if (!r.ok) throw new Error(j.error); set(j.url); } catch(e) { setErr((e as Error).message); } finally { setBusy(false); }
    }}/><small className="hint">JPG, PNG, WebP หรือ GIF · ไม่เกิน {appSettings.image_max_mb} MB หลังปรับขนาด{appSettings.image_max_edge>0?` · ด้านยาวไม่เกิน ${appSettings.image_max_edge} px`:""}</small></div>;
    if(c.type==="enum"&&!c.options?.trim()&&!c.ref_table&&!Object.hasOwn(state!.choices,c.name))return <><input {...common} type="text" value={value??""} onChange={e=>set(e.target.value)}/><small className="hint">ยังไม่ได้กำหนดรายการตัวเลือก · พิมพ์ค่าได้เอง</small></>;
    if (["enum","enumlist","ref"].includes(c.type)) {
      const allowed=state!.choices[c.name]||[];
      const selected:string[]=c.type==="enumlist"?value||[]:value==null||value===""?[]:[String(value)];
      const options=c.type==="ref"?(refs[c.name]||[]).filter(r=>!Object.hasOwn(state.choices,c.name)||allowed.includes(String(r.id))||selected.includes(String(r.id))).map(r=>({value:String(r.id),label:r.__label,image:r.__image||undefined,disabled:Object.hasOwn(state.choices,c.name)&&!allowed.includes(String(r.id))})): [...new Set([...allowed,...selected])].map(o=>({value:o,label:enumListLabel(c,o,expressionOptions),image:enumListImage(c,o,expressionOptions),disabled:!allowed.includes(o)}));
      return <ChoiceInput id={id} label={c.label} options={options} selected={selected} multiple={c.type==="enumlist"} mode={c.input_mode||"dropdown"} limit={c.button_limit??5} disabled={common.disabled} describedBy={common["aria-describedby"]} invalid={common["aria-invalid"]} required={common["aria-required"]} onChange={values=>set(c.type==="enumlist"?values:values[0]??null)}/>;
    }
    if (c.type === "yesno") return <input {...common} type="checkbox" checked={!!value} onChange={e => set(e.target.checked)} />;
    if (c.type === "longtext" || (runtimeView && c.type === "text" && formDisplay.form_fields[c.name]?.multiline)) return <textarea {...common} maxLength={c.max_length || undefined} rows={4} placeholder={formDisplay.form_fields[c.name]?.placeholder} value={value ?? ""} onChange={e => set(e.target.value)}/>;
    return <input {...common} maxLength={["text","longtext"].includes(c.type)?c.max_length || undefined:undefined} placeholder={runtimeView ? formDisplay.form_fields[c.name]?.placeholder : undefined} type={["number", "decimal"].includes(c.type) ? "number" : c.type === "date" ? "date" : c.type === "datetime" ? "datetime-local" : "text"} inputMode={c.type === "decimal" ? "decimal" : undefined} step={["number", "decimal"].includes(c.type) || c.type === "datetime" ? "any" : undefined} value={c.type === "datetime" ? dateTimeInput(value) : value ?? ""} onChange={e => set(e.target.value)} />;
  };
  async function performAction(action:RowAction,row:any) {
    setBusy(true);setErr("");
    try { const r=await fetch("/api/actions",{method:"POST",headers:{"Content-Type":"application/json",...requestHeaders},body:JSON.stringify({op:"execute",name:action.name,id:row.id,slice_name:runtimeView?.slice_name})}),j=await r.json();if(!r.ok)throw new Error(j.error);setPendingAction(null);if(j.url){location.assign(j.url);return;}if(j.navigate){const target=relatedViews.find(v=>v.name===j.navigate.name);if(target&&onNavigate){leaving.current=true;onNavigate(target,j.navigate.id,j.navigate.initialValues);}else location.assign(actionNavigationUrl(j.navigate.name,j.navigate.id,j.navigate.initialValues));return;}clearRuntimeCache("data"); const message = j.message || `ทำรายการ ${action.label} แล้ว`; setSaved(message); if (action.kind === "delete" || j.deleted) setDetail(null); else if (detail?.id === row.id) { const response = await fetch(`/api/data/${table}?id=${row.id}${sliceQuery}`, {headers:requestHeaders}); const fresh = await response.json(); if(response.ok && fresh.length) setDetail(fresh[0]); } await load();onDataChange?.();if((action.kind === "delete" || j.deleted) && runtimeView && ["form","detail"].includes(runtimeView.kind))onReturn?.(message); } catch(e){setErr((e as Error).message);}finally{setBusy(false);}
  }
  const actionAllowed=(action:RowAction,row:any)=>{if(["set","delete","edit_form"].includes(action.kind)&&row.__permissions?.[actionPermission(action.kind)]===false)return false;try{return asBoolean(evaluateExpression(action.condition_expr,row,{...expressionOptions,userEmail:previewEmail}));}catch{return false;}};
  const triggerAction=(action:RowAction,row:any)=>{if(busy)return;setErr("");if(!actionAllowed(action,row)){setErr("แถวนี้ไม่ตรงเงื่อนไขของ Action กรุณาเลือกแถวอื่นหรือโหลดข้อมูลใหม่");return;}if(action.confirmation||["delete","grouped"].includes(action.kind))setPendingAction({action,row});else performAction(action,row);};
  const rowClick=(row:any)=>{if(busy)return;setErr("");switch(runtimeView ? listDisplay.row_click : "detail"){case "detail":openDetail(row);break;case "edit":editRow(row);break;case "delete":if(rights.delete&&row.__permissions?.delete!==false)setDeletion(row.id);else openDetail(row);break;case "action":{const action=rowActions.find(a=>a.name===listDisplay.row_action);if(action)triggerAction(action,row);else setErr("ไม่พบ Action ที่ตั้งไว้ กรุณาตรวจการคลิกแถวใน View");break;}}};
  const rowClickLabel = runtimeView ? {detail:"ดูรายละเอียด",edit:"แก้ไข",delete:"ลบ",action:rowActions.find(a=>a.name===listDisplay.row_action)?.label || "เรียก Action",none:""}[listDisplay.row_click] : "ดูรายละเอียด";
  const actionButtons=(row:any)=><div className="runtime-row-actions">{rowActions.filter(a=>actionAllowed(a,row)).map(a=><ActionButton key={a.name} action={a} disabled={busy} onClick={()=>triggerAction(a,row)}/>)}</div>;
  return <div className={runtimeView ? `runtime-content runtime-kind-${runtimeView.kind} table-density-${listDisplay.table_density} ${listDisplay.table_wrap ? "table-wrap" : ""}` : "builder-data-content"}>
    <div hidden={!!runtimeView && !!(form || detail)}>
    {excelOpen&&<ExcelTransfer table={table} rights={rights} onClose={()=>setExcelOpen(false)} onImported={message=>{setExcelOpen(false);setSaved(message);clearRuntimeCache("data");load();onDataChange?.();}}/>}<div className="page-heading"><div><div className="eyebrow">{runtimeView ? "แอปของฉัน" : "ข้อมูลตาราง"}</div><h1>{runtimeView?.label || meta.label}</h1><p>ดูข้อมูล ค้นหา และเพิ่มรายการได้จากหน้านี้</p></div>{!runtimeView&&(access.builder||access.owner)&&rights.delete&&<button className="clear-data-button" disabled={busy} onClick={()=>{setClearOpen(true);setClearConfirmation("");setClearError("");}}><Icon name="trash"/>เคลียร์ข้อมูลทั้งหมด</button>}{rights.create&&<button className={runtimeView ? "primary runtime-add" : "primary"} aria-label="เพิ่มข้อมูล" disabled={busy} onClick={add}><Icon name="plus"/><span>เพิ่มข้อมูล</span></button>}</div>
    
    {!runtimeView && <TableTabs table={table} selected="data"/>}
    {busy && !rowsLoading && !form && !detail && !pendingAction && deletion===null && <AppLoading compact/>}
    {(saved || successMessage) && <div className="success-banner" role="status"><Icon name="check"/>{saved || successMessage}</div>}{loadErr && <div className="error-banner" role="alert">{loadErr}</div>}{err && !form && deletion === null && <div className="error-banner" role="alert">{err}</div>}
    <section className="panel data-panel" hidden={runtimeView?.kind === "form" && !!form}><div className="data-toolbar"><div className="search-box"><Icon name="search"/><input aria-label="ค้นหาข้อมูล" placeholder="ค้นหาข้อมูล…" value={q} onChange={e => setQ(e.target.value)}/></div><div className="view-toggle" role="group" aria-label="มุมมองข้อมูล"><button aria-label="มุมมองตาราง" aria-pressed={view === "table"} onClick={() => setView("table")}><Icon name="table"/>ตาราง</button><button aria-label="มุมมองรายการ" aria-pressed={view === "list"} onClick={() => setView("list")}><Icon name="list"/>รายการ</button></div><button className="excel-open" aria-label="นำเข้า / ส่งออก Excel" title="นำเข้า / ส่งออก Excel" disabled={busy} onClick={()=>setExcelOpen(true)}><Icon name="download"/><span>Excel</span></button><DataFilters columns={sourceCols} filters={filters} onChange={v=>{setFilters(v);setPage(1);}}/></div>
      {rowsLoading&&refreshVisible&&rows.length>0&&<div className="runtime-refresh-indicator"><AppLoading compact/></div>}<div className="data-caption"><span>{total} รายการ{q || filters.length ? "ที่พบ" : ""}</span><span>{runtimeView?.kind === "table" ? rowClickLabel ? `คลิกแถวเพื่อ${rowClickLabel}` : "ใช้ปุ่มในแถวเพื่อจัดการข้อมูล" : "กดชื่อรายการเพื่อดูรายละเอียด"}</span></div>
      <div className="data-records-scroll">{rowsLoading && rows.length===0 ? <AppLoading/> : rows.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="table" width="30" height="30"/></span><h2>{q || filters.length ? "ไม่พบข้อมูลที่ตรงเงื่อนไข" : "ตารางพร้อมใช้งานแล้ว"}</h2><p>{q || filters.length ? "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง" : "เพิ่มรายการแรก แล้วระบบจะจัดข้อมูลให้เป็นตาราง"}</p>{rights.create && !q && !filters.length && <button className="primary" onClick={add}><Icon name="plus"/>เพิ่มข้อมูลแรก</button>}</div> : <>
      <div style={{"--table-row-padding":(listDisplay.table_row_padding ?? (listDisplay.table_density==="compact"?7:13))+"px","--table-line-height":listDisplay.table_line_height} as React.CSSProperties} className={`scroll record-table configured-table-spacing ${view === "list" ? "view-hidden" : ""}`}><table><thead><tr>{displayCols.map(c => <th key={c.name} aria-sort={sort === c.name ? dir === "asc" ? "ascending" : "descending" : "none"}><button className="sort-button" onClick={() => { setDir(sort === c.name && dir === "asc" ? "desc" : "asc"); setSort(c.name);setPage(1); }}>{c.label}{c.is_key ? " · Key" : ""}{c.is_virtual ? " ƒ" : ""}{sort === c.name ? dir === "asc" ? " ↑" : " ↓" : ""}</button></th>)}{(!runtimeView||listDisplay.table_show_edit||listDisplay.table_show_delete||listDisplay.table_show_actions)&&<th>จัดการ</th>}</tr></thead><tbody>{groups.map(group => <React.Fragment key={group.key}>{groupColumn && <tr className="record-group-row"><th colSpan={displayCols.length + ((!runtimeView||listDisplay.table_show_edit||listDisplay.table_show_delete||listDisplay.table_show_actions)?1:0)}>{group.label} <span>{group.rows.length} รายการ</span></th></tr>}{group.rows.map(row => <tr key={row.id} aria-selected={selectedRow===row.id || undefined} className={(rowClickLabel ? "clickable-record-row" : "")+(selectedRow===row.id?" selected-record-row":"")} tabIndex={rowClickLabel ? 0 : undefined} aria-label={rowClickLabel ? `${rowClickLabel}แถว ${row.__label ?? row.id}` : undefined} onClick={e=>{if(e.target instanceof Element && e.target.closest("button,a,input,select,textarea"))return;rowClick(row);}} onKeyDown={e=>{if(e.target===e.currentTarget && rowClickLabel && ["Enter"," "].includes(e.key)){e.preventDefault();rowClick(row);}}}>{displayCols.map((c, i) => <td key={c.name}>{row.__errors?.[c.name] ? <span className="table-error">{row.__errors[c.name]}</span> : i === 0 && rowClickLabel ? <button className="record-link" disabled={busy} onClick={() => rowClick(row)} aria-label={`${rowClickLabel === "ดูรายละเอียด" ? rowClickLabel : "เมื่อคลิกแถว: " + rowClickLabel} ${row.__label ?? row.id}`}>{display(c,row)}</button> : display(c, row)}</td>)}{(!runtimeView||listDisplay.table_show_edit||listDisplay.table_show_delete||listDisplay.table_show_actions)&&<td><div className="record-actions">{(!runtimeView||listDisplay.table_show_edit)&&rights.update&&row.__permissions?.update!==false&&<button className="icon-button" disabled={busy} aria-label={`แก้ไข ${row.__label ?? row.id}`} onClick={() => editRow(row)}><Icon name="edit"/></button>}{(!runtimeView||listDisplay.table_show_delete)&&rights.delete&&row.__permissions?.delete!==false&&<button className="icon-button danger" disabled={busy} aria-label={`ลบ ${row.__label ?? row.id}`} onClick={() => { setErr(""); setDeletion(row.id); }}><Icon name="trash"/></button>}</div>{runtimeView && listDisplay.table_show_actions && actionButtons(row)}</td>}</tr>)}</React.Fragment>)}</tbody></table></div>
      <div style={{"--grid-columns":listDisplay.list_grid_columns,"--grid-mobile-columns":listDisplay.list_grid_mobile_columns,"--grid-gap":listDisplay.list_gap+"px"} as React.CSSProperties} className={`record-list ${runtimeView&&listDisplay.list_style==="grid"?"record-grid":""} ${view === "table" ? "mobile-record-list" : ""}`}>{groups.map(group => <React.Fragment key={group.key}>{groupColumn && <h2 className="record-group-heading">{group.label}<span>{group.rows.length} รายการ</span></h2>}{group.rows.map(row => <article style={runtimeView ? {"--list-padding":listDisplay.list_padding+"px","--list-min-height":listDisplay.list_min_height+"px","--list-gap":listDisplay.list_gap+"px","--list-radius":listDisplay.list_radius+"px"} as React.CSSProperties : undefined} className={runtimeView ? `record-card ${selectedRow===row.id?"selected-record-card":""} ${compactLabelImage?"has-row-label-image":""} ${listDisplay.image_column === "" ? "list-no-image" : ""} list-style-${listDisplay.list_style} image-shape-${listDisplay.image_shape} image-size-${listDisplay.image_size}` : `record-card ${compactLabelImage?"has-row-label-image":""}`} key={row.id}><button className="record-card-main" aria-label={`ดูรายละเอียด ${row.__label ?? row.id}`} onClick={() => openDetail(row)}>{(!runtimeView || listDisplay.image_column !== "") && !(compactLabelImage) && <span className="record-avatar">{imageCol && row[imageCol.name] ? display(imageCol, row) : listTitle(row).slice(0, 1)}</span>}<span className="record-text"><strong><DecoratedValue column={listDisplay.title_column==="__auto__"?labelTextColumn(meta.columns):listDisplay.title_column} row={row} config={listDisplay.data_styles[listDisplay.title_column==="__auto__"?labelTextColumn(meta.columns):listDisplay.title_column]} options={{...expressionOptions,userEmail:previewEmail}}><RecordLabel text={listTitle(row)} image={row.__image}/></DecoratedValue></strong><span className="record-summary">{summaryCols.map(c => <span key={c.name}>{listDisplay.show_summary_labels ? `${c.label}: ` : ""}{row.__errors?.[c.name] ? "คำนวณไม่ได้" : display(c,row)}</span>)}</span></span><Icon name="chevron" width="17" height="17"/></button>{rights.update && row.__permissions?.update!==false && (!runtimeView || ["edit", "both"].includes(listDisplay.list_buttons)) && <button className="icon-button record-edit" disabled={busy} aria-label={`แก้ไขรายการ ${row.__label ?? row.id}`} onClick={() => editRow(row)}><Icon name="edit"/></button>}{runtimeView && ["actions", "both"].includes(listDisplay.list_buttons) && actionButtons(row)}</article>)}</React.Fragment>)}</div></>}
    </div>{groupColumn&&<p className="hint">จัดกลุ่มเฉพาะรายการในหน้าที่กำลังดู</p>}<div className="data-pagination"><label><span>ต่อหน้า</span> <SearchSelect aria-label="รายการต่อหน้า" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</SearchSelect></label><span role="status" title={`หน้า ${page} / ${pages} · ทั้งหมด ${total} รายการ`}>หน้า {page} / {pages}<span className="pagination-total"> · {total} รายการ</span></span><div className="row"><button disabled={rowsLoading||page<=1} aria-label="หน้าก่อนหน้า" title="หน้าก่อนหน้า" onClick={()=>setPage(p=>p-1)}><Icon name="chevron" width="16" height="16" style={{transform:"rotate(180deg)"}}/></button><button disabled={rowsLoading||page>=pages} aria-label="หน้าถัดไป" title="หน้าถัดไป" onClick={()=>setPage(p=>p+1)}><Icon name="chevron" width="16" height="16"/></button></div></div>
    </section>
    </div>
    {form && state && <Screen className={onDraftSaved?"runtime-child-screen":""} title={runtimeView && formView?.label || (form.id ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล")} subtitle={`${meta.label} · ช่องที่มี * จำเป็นต้องกรอก`} busy={busy} onClose={closeForm} footer={<><button disabled={busy} onClick={closeForm}>ยกเลิก</button><button className="primary" disabled={busy||Object.values(gpsPending).some(Boolean)||Object.values(signaturePending).some(Boolean)} onClick={save}><Icon name="check"/>{busy ? "กำลังบันทึก…" : form.id ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}</button></>}>
      {meta.columns.filter(c=>c.gps_auto&&!c.is_virtual&&state.editable[c.name]&&(!formCols.some(f=>f.name===c.name)||!state.visible[c.name])).map(c=><LocationField key={c.name} hidden id={`gps-${c.name}`} label={c.label} value={form[c.name]} auto newRow={!form.id} editable disabled={busy} onChange={value=>updateFormField(c.name,value)} onStatus={status=>setGpsPending(old=>old[c.name]===status.pending?old:{...old,[c.name]:status.pending})}/>)}
      {saved&&<div className="success-banner" role="status"><Icon name="check"/>{saved}</div>}
      {!runtimeView && <p className="hint internal-id-note">รหัสภายใน (id): <strong>{form.id ?? "ระบบสร้างเมื่อบันทึก"}</strong> · ใช้เชื่อม Ref และ List เปลี่ยนค่าไม่ได้</p>}
      <div className={`data-form configured-form form-label-${formDisplay.form_labels}`} style={{ gridTemplateColumns: `repeat(${formDisplay.form_columns}, minmax(0, 1fr))` }}>{formCols.filter(c => state.visible[c.name] && (!onDraftSaved || c.name !== parentLink)).map((c, i, visible) => { const error = state.errors[c.name] || uniqueErrors[c.name] || (attempted ? state.validation[c.name] : ""), field = runtimeView ? formDisplay.form_fields[c.name] || {} : {}, section = field.section?.trim(); return <React.Fragment key={c.name}>{section && (i === 0 || section !== formDisplay.form_fields[visible[i - 1].name]?.section?.trim()) && <h3 className="form-section-heading">{section}</h3>}<div className={`field ${c.is_virtual ? "calculated-field" : ""}`} style={runtimeView && field.width === "full" ? { gridColumn: "1 / -1" } : undefined}><label htmlFor={onDraftSaved?`data-part-${table}-${c.name}`:`data-${c.name}`}>{c.label}{state.required[c.name] ? " *" : ""}{!!c.is_virtual && <span className="badge blue">คำนวณอัตโนมัติ</span>}</label>{input(c)}{!c.is_virtual && !state.editable[c.name] && <small className="field-help">{c.ref_table&&!tableAccess(access,c.ref_table).read?"ไม่มีสิทธิ์ดูตารางอ้างอิง กรุณาติดต่อเจ้าของแอปหากต้องการเลือกข้อมูลช่องนี้":"อ่านอย่างเดียว · ใช้ค่าเริ่มต้นหรือเงื่อนไขการแก้ไขของคอลัมน์"}</small>}{field.help && <small className="field-help" id={`data-${c.name}-help`}>{field.help}</small>}{error && <div className="err" id={`data-${c.name}-error`} role="status">{error}</div>}</div></React.Fragment>; })}</div><PartOfForms related={relatedDisplay} views={relatedViews} hiddenViews={runtimeView&&!onDraftSaved?relatedViews.filter(v=>v.position==="inline"&&!inlineViews.some(a=>a.name===v.name)).map(v=>v.name):hiddenInline} table={table} tables={allTables} parent={state.row} groups={(form.__children||[]) as ChildGroup[]} busy={busy} options={{...expressionOptions,userEmail:previewEmail}} onChange={__children=>setForm(old=>old?{...old,__children}:old)}/>{err && <div className="error-banner" role="alert">{err}</div>}{saveConflict&&form?.id&&<button type="button" disabled={busy} onClick={()=>setReloadConflict(true)}><Icon name="refresh"/>โหลดข้อมูลล่าสุดเพื่อแก้ไขใหม่</button>}
    </Screen>}
    {detail && <Screen title={detailView?.label || "รายละเอียดข้อมูล"} subtitle={<RecordLabel text={String(detail.__label ?? `รายการที่ ${detail.id}`)} image={detail.__image}/>} busy={busy} onClose={closeDetail} actions={runtimeView ? <>{rights.update&&detail.__permissions?.update!==false&&<button className="icon-button" aria-label="แก้ไขข้อมูล" title="แก้ไขข้อมูล" disabled={busy} onClick={() => editRow(detail)}><Icon name="edit"/></button>}{rights.delete&&detail.__permissions?.delete!==false&&<button className="icon-button danger" aria-label="ลบข้อมูล" title="ลบข้อมูล" disabled={busy} onClick={() => { setErr(""); setDeletion(detail.id); }}><Icon name="trash"/></button>}<button className="icon-button" aria-label="ปิดหน้ารายละเอียด" title="ปิดหน้ารายละเอียด" disabled={busy} onClick={()=>{if(busy)return;if(onCloseDetails)onCloseDetails();else closeDetail();}}><Icon name="close"/></button></> : undefined} footer={runtimeView ? undefined : <>{rights.delete&&detail.__permissions?.delete!==false&&<button className="danger" onClick={() => { setErr(""); setDeletion(detail.id); }}><Icon name="trash"/>ลบข้อมูล</button>}{rights.update&&detail.__permissions?.update!==false&&<button className="primary" onClick={() => editRow(detail)}><Icon name="edit"/>แก้ไขข้อมูล</button>}</>}><div className="detail-page" style={detailPageStyle}>{coverSrc && <figure className={`detail-cover detail-cover-fit-${detailDisplay.detail_image_fit}`}><PreviewImage src={coverSrc} alt={coverColumn!.label}/></figure>}{(saved || successMessage) && <div className="success-banner" role="status"><Icon name="check"/>{saved || successMessage}</div>}{err && <div className="error-banner" role="alert">{err}</div>}{busy && <AppLoading compact/>}{runtimeView && actionButtons(detail)}<dl className={`detail-fields configured-detail detail-layout-${detailDisplay.detail_layout} detail-image-${detailDisplay.image_size} detail-style-${detailDisplay.detail_style} detail-separator-${detailDisplay.detail_separator} ${detailDisplay.detail_show_labels ? "" : "detail-labels-hidden"}`} style={{ gridTemplateColumns: `repeat(${detailDisplay.detail_columns}, minmax(0, 1fr))` }}>{renderedDetailCols.map(c => <div key={c.name}><dt>{c.label}{!!c.is_virtual && <span className="badge blue">คำนวณ</span>}</dt><dd aria-label={detailDisplay.detail_show_labels ? undefined : c.label}>{detail.__errors?.[c.name] ? <span className="err">{detail.__errors[c.name]}</span> : c.type === "latlong"&&parseCoordinates(detail[c.name]) ? <div className="location-detail"><span>{detail[c.name]}</span><LocationMap value={detail[c.name]} label={"แผนที่ "+c.label}/></div> : c.type === "list" ? <PagedList refreshRevision={dataRevision} title={c.label} table={c.ref_table || undefined} query={c.ref_table ? `mode=list&owner=${table}&id=${detail.id}&column=${c.name}` : ""} values={c.ref_table ? undefined : detail[c.name] || []} limit={c.list_limit ?? 5} email={previewEmail} onOpen={onOpenReference}/> : display(c, detail,detailDisplay)}</dd></div>)}</dl>{meta.related?.map(r=>{const config=relatedDisplay[`${r.table}:${r.column}`]||{};if(config.visible===false)return null;const options=relatedViews.filter(v=>v.position==="inline"),inline=relatedInlineView(options,r.table,r.column,config.view),title=relatedTitle(r.label,config.title);if(config.view && !inline || inline && (runtimeView ? !inlineViews.some(v=>v.name===inline.name) : hiddenInline.includes(inline.name)))return null;return inline?<InlineRelated onAdd={addRelated(r)} dataRevision={dataRevision+relatedRevision} key={`${r.table}:${r.column}:${detail.id}`} view={inline} title={title} owner={table} id={detail.id} column={r.column} limit={config.limit??r.list_limit} email={previewEmail} onOpen={onOpenReference} onNavigate={(name,id,values)=>{const target=relatedViews.find(v=>v.name===name);if(target&&onNavigate)onNavigate(target,id,values);else location.assign(actionNavigationUrl(name,id,values));}} onChange={(message)=>{setSaved(message);load();onDataChange?.();}}/>:<PagedList onAdd={addRelated(r)} refreshRevision={dataRevision+relatedRevision} key={`${r.table}:${r.column}:${detail.id}`} title={title} table={r.table} query={`mode=related&owner=${table}&id=${detail.id}&column=${r.column}`} limit={config.limit??r.list_limit} email={previewEmail} onOpen={onOpenReference}/>;})}</div></Screen>}
    {childAdd&&<RuntimeTable key={childAdd.table+':'+childAdd.id+(childAdd.key||'')} successMessage={childAdd.key?'เพิ่มรายการลูกแล้ว':''} table={childAdd.table} runtimeView={relatedViews.find(v=>v.table_name===childAdd.table&&v.kind==='form'&&v.position==='ref')||{name:'related_add',label:'เพิ่มข้อมูล',table_name:childAdd.table,kind:'form',position:'ref',pos:0,columns:[],sort_column:'id',sort_dir:'asc',display:{}}} referenceViews={relatedViews.filter(v=>v.position==='ref')} inlineViews={relatedViews.filter(v=>v.position==='inline'&&!hiddenInline.includes(v.name))} draftValues={{[childAdd.column]:childAdd.id}} parentLink={childAdd.column} onReturn={()=>setChildAdd(null)} onDraftSaved={async (values,options)=>{const body=childAdd.part?{__children:[{table:childAdd.table,column:childAdd.column,records:[{key:crypto.randomUUID(),values}]}]}:{...values,[childAdd.column]:childAdd.id};const response=await fetch('/api/data/'+(childAdd.part?table+'?id='+childAdd.id:childAdd.table+(values.__form_view?'?form_view='+encodeURIComponent(values.__form_view):'')),{method:childAdd.part?'PUT':'POST',headers:{'Content-Type':'application/json',...requestHeaders},body:JSON.stringify(body)}),result=await response.json();if(!response.ok)throw Error(result.error);clearRuntimeCache('data');setChildAdd(options?.reopen?{...childAdd,key:crypto.randomUUID()}:null);setRelatedRevision(n=>n+1);setSaved('เพิ่มรายการลูกแล้ว');onDataChange?.();}}/>}
    {pendingAction && <ConfirmDialog titleId="execute-action" busy={busy} onCancel={()=>{setPendingAction(null);setErr("");}}><h2 id="execute-action">{pendingAction.action.label}</h2><p>{pendingAction.action.confirmation || (pendingAction.action.kind==="grouped"?"ยืนยันทำทุกขั้นตอนในชุดนี้? ชุดอาจมีการลบข้อมูลตามที่ตั้งค่าไว้":"ยืนยันลบแถวนี้? การลบย้อนกลับไม่ได้")}</p>{err&&<p className="err" role="alert">{err}</p>}<div className="row"><button className={pendingAction.action.kind==="delete"?"danger":"primary"} disabled={busy} onClick={()=>performAction(pendingAction.action,pendingAction.row)}>ยืนยันทำรายการ</button><button autoFocus disabled={busy} onClick={()=>{setPendingAction(null);setErr("");}}>ยกเลิก</button></div></ConfirmDialog>}
    {clearOpen&&<ConfirmDialog titleId="clear-table-title" busy={busy} onCancel={()=>setClearOpen(false)}><div className="clear-table-confirm"><h2 id="clear-table-title"><Icon name="trash"/>ยืนยันเคลียร์ข้อมูลทั้งหมด</h2><p>ลบข้อมูลทุกแถวในตาราง “{meta.label}” รวมรายการที่ไม่ได้แสดงจากการค้นหาและตัวกรอง พร้อมรีเซ็ต ID ให้ข้อมูลใหม่เริ่มที่ 1 การลบย้อนกลับไม่ได้</p><p>กรุณาสำรอง data.db ก่อนดำเนินการ</p><div className="field"><label htmlFor="clear-table-confirmation">พิมพ์ “เคลียร์ข้อมูลทั้งหมด” เพื่อยืนยัน</label><input id="clear-table-confirmation" autoComplete="off" disabled={busy} value={clearConfirmation} onChange={e=>setClearConfirmation(e.target.value)}/></div>{clearError&&<p className="err" role="alert">{clearError}</p>}<div className="row"><button className="clear-data-button" disabled={busy||clearConfirmation!=="เคลียร์ข้อมูลทั้งหมด"} onClick={clearAll}>{busy?"กำลังเคลียร์ข้อมูล…":"ยืนยันเคลียร์ข้อมูลทั้งหมด"}</button><button autoFocus disabled={busy} onClick={()=>setClearOpen(false)}>ยกเลิก</button></div></div></ConfirmDialog>}
    {deletion !== null && <ConfirmDialog titleId="delete-row-title" busy={busy} onCancel={() => setDeletion(null)}><h2 id="delete-row-title">ยืนยันลบข้อมูลแถวที่ {deletion}</h2><p>ข้อมูลแถวนี้จะถูกลบ ย้อนกลับไม่ได้{allTables.some(t=>t.columns.some(c=>c.is_part_of&&c.ref_table===table))?" · รายการลูกที่เป็นส่วนหนึ่งของแถวนี้จะถูกลบด้วย":""}</p>{err && <p className="err" role="alert">{err}</p>}<div className="row"><button className="danger" disabled={busy} onClick={remove}>ยืนยันการลบ</button><button autoFocus disabled={busy} onClick={() => setDeletion(null)}>ยกเลิกการลบ</button></div></ConfirmDialog>}
    {reloadConflict&&<ConfirmDialog titleId="reload-conflict-title" busy={busy} onCancel={()=>setReloadConflict(false)}><h2 id="reload-conflict-title">โหลดข้อมูลล่าสุด</h2><p>ค่าที่กรอกและรายการลูกที่ยังไม่บันทึกจะถูกแทนที่ด้วยข้อมูลล่าสุด กรุณาคัดลอกค่าที่ต้องการเก็บก่อนโหลดใหม่</p><div className="row"><button autoFocus disabled={busy} onClick={()=>setReloadConflict(false)}>กลับไปดูค่าที่กรอก</button><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/data/'+table+'?id='+form!.id,{headers:requestHeaders}),rows=await r.json();if(!r.ok||!rows.length)throw Error(rows.error||'ไม่พบรายการล่าสุด อาจถูกลบหรือไม่มีสิทธิ์ดูแล้ว');await editRow(rows[0]);setReloadConflict(false);}catch(e){setErr((e as Error).message);setReloadConflict(false);}finally{setBusy(false);}}}>ยืนยันโหลดข้อมูลล่าสุด</button></div></ConfirmDialog>}
    {discard && <ConfirmDialog titleId="discard-row-title" busy={false} onCancel={() => setDiscard(false)}><h2 id="discard-row-title">ยังไม่ได้บันทึกข้อมูล</h2><p>ต้องการกลับไปกรอกต่อ หรือปิดโดยไม่บันทึก?</p><div className="row"><button className="primary" autoFocus onClick={() => setDiscard(false)}>กลับไปกรอกต่อ</button><button onClick={() => { setDiscard(false);if((onDraftSaved||runtimeView?.kind==="form"&&!editOrigin.current)&&onReturn){leaving.current=true;onReturn();return;} setForm(null); setErr(""); if (editOrigin.current) { setDetail(editOrigin.current); editOrigin.current = null; } else if (runtimeView?.kind === "form") onReturn?.(); }}>ปิดโดยไม่บันทึก</button></div></ConfirmDialog>}
  </div>;
}

