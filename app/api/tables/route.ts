import {createBuilderTable} from '@/lib/table-builder';
import {currentApplication} from '@/lib/application-context';
import {errorStatus} from "@/lib/api";
import {canRead} from "@/lib/permissions";
import {withAuth} from "@/lib/auth-api";
import {backupBeforeSchema} from "@/lib/database-backup";
﻿import { NextResponse } from "next/server";
import { db, columnsOf, tableExists } from "@/lib/db";
import { assertIdentifier } from "@/lib/columns";
import { insertColumn, normalizeColumns } from "@/lib/metadata";
import { columnDefinition, createDefaultViews, syncKeyIndex } from "@/lib/schema";
import { bad, errorMessage, readBody } from "@/lib/api";
import { relatedLists } from "@/lib/lists";
export const dynamic = "force-dynamic";

async function handleGET() {
  try {
    const tables = db.prepare("SELECT * FROM _tables ORDER BY label").all() as { name: string; label: string }[];
    return NextResponse.json(tables.filter(t=>canRead(t.name)).map(t => ({ ...t, columns: columnsOf(t.name), related: relatedLists(t.name) })));
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
