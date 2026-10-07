import {withAuth} from "@/lib/auth-api";
import { db } from "@/lib/db";
import { bad } from "@/lib/api";
export const dynamic = "force-dynamic";
async function handleGET(_req: Request, { params }: { params: { id: string } }) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(params.id)) return bad("ไม่พบรูปภาพ", 404);
  const image = db.prepare("SELECT mime,data FROM _images WHERE id=?").get(params.id) as { mime: string; data: Buffer } | undefined;
  if (!image) return bad("ไม่พบรูปภาพ", 404);
  return new Response(new Uint8Array(image.data), { headers: { "Content-Type": image.mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=31536000, immutable" } });
}

export const GET = withAuth(handleGET);
