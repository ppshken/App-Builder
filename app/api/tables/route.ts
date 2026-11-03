import {sourceApplicationLabel,tableOverlay,physicalColumns,physicalHash} from '@/lib/shared-table-columns';
import {createBuilderTable} from '@/lib/table-builder';
import {currentApplication} from '@/lib/application-context';
import {errorStatus} from "@/lib/api";
import {canRead} from "@/lib/permissions";
import {withAuth} from "@/lib/auth-api";
import {backupBeforeSchema} from "@/lib/database-backup";
﻿import { NextResponse } from "next/server";
import { db, platformDatabase, columnsOf, tableExists } from "@/lib/db";
import { assertIdentifier } from "@/lib/columns";
import { insertColumn, normalizeColumns } from "@/lib/metadata";
import { columnDefinition, createDefaultViews, syncKeyIndex } from "@/lib/schema";
import { bad, errorMessage, readBody } from "@/lib/api";
import { relatedLists } from "@/lib/lists";
export const dynamic = "force-dynamic";

async function handleGET() {
  try {
    const tables = db.prepare("SELECT * FROM _tables ORDER BY label").all() as { name: string; label: string }[];
    return NextResponse.json(tables.filter(t=>canRead(t.name)).map(t => ({ ...t, columns: columnsOf(t.name), related: relatedLists(t.name), ...(()=>{const app=currentApplication();const value=tableOverlay(db,t.name);const source=db.prepare('SELECT owner_app_id FROM _tables WHERE name=?').get(t.name) as {owner_app_id:string};return {...(value?.label?{label:value.label}:{}),shared:!!app&&source.owner_app_id!==app.id,source_app:sourceApplicationLabel(platformDatabase(),source.owner_app_id),overlay_configured:!!value,schema_stale:!!value&&physicalHash(value.snapshot)!==physicalHash(physicalColumns(db,t.name))};})() })));
  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}
async function handlePOST(req: Request) {
  try {
    const { name, label, columns } = await readBody(req);
    assertIdentifier(name);
    if (tableExists(name)) return bad("มีตารางชื่อนี้แล้ว กรุณาใช้ชื่อในระบบอื่น");
    createBuilderTable({name,label,columns});
    return NextResponse.json({ok:true});

  } catch (e) { return bad(errorMessage(e),errorStatus(e)); }
}

export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
