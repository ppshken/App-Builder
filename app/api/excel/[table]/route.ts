import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-api";
import { db, databasePath, databaseGeneration } from "@/lib/db";
import { bad, errorMessage, errorStatus } from "@/lib/api";
import { exportExcel, loadExcel, importExcel, MAX_EXCEL_BYTES } from "@/lib/excel";
import { createBackup } from "@/lib/backups";
import { requestUser, AuthError } from "@/lib/auth";
import { runAuthorized, accessFor } from "@/lib/permissions";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function handleGET(req: Request, { params }: {
    params: {
        table: string;
    };
}) { try {
    const result = await exportExcel(params.table, new URL(req.url).searchParams.get('template') === '1');
    return new Response(new Uint8Array(result.bytes), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="' + params.table + '.xlsx"', 'X-Exported-Rows': String(result.total) } });
}
catch (e) {
    return bad(errorMessage(e), errorStatus(e));
} }
async function handlePOST(req: Request, { params }: {
    params: {
        table: string;
    };
}) { try {
    const generation = databaseGeneration(), reader = req.body?.getReader();
    if (!reader)
        throw Error("เลือกไฟล์ Excel ก่อนนำเข้า");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        size += value.length;
        if (size > MAX_EXCEL_BYTES + 256 * 1024) {
            await reader.cancel();
            throw new AuthError("ไฟล์ Excel ต้องไม่เกิน 10 MB", 413);
        }
        chunks.push(value);
    }
    const bytes = Buffer.concat(chunks), form = await new Request(req.url, { method: 'POST', headers: req.headers, body: bytes }).formData(), file = form.get('file');
    if (!file || typeof file === 'string' || !file.name.toLowerCase().endsWith('.xlsx'))
        throw Error("เลือกไฟล์ Excel .xlsx");
    const workbook = await loadExcel(Buffer.from(await file.arrayBuffer()));
    if (generation !== databaseGeneration())
        throw Error("ฐานข้อมูลถูกกู้คืน กรุณาตรวจไฟล์อีกครั้ง");
    const user = requestUser(req);
    if (!user)
        throw new AuthError("กรุณาเข้าสู่ระบบใหม่ก่อนนำเข้า", 401);
    return runAuthorized(user, accessFor(user), () => { const sheet = String(form.get('sheet') || ''), mode = String(form.get('mode') || 'append'), commit = form.get('phase') === 'commit', report = importExcel(params.table, workbook, sheet, mode, false); if (!commit || !report.valid)
        return NextResponse.json(report); const backup = createBackup(db, databasePath, 'manual'); const saved = importExcel(params.table, workbook, sheet, mode, true); return NextResponse.json({ ...saved, backup: backup.name, committed: saved.valid }); });
}
catch (e) {
    return bad(errorMessage(e), errorStatus(e));
} }
export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
