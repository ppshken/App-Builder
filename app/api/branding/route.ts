import { NextResponse } from "next/server";
import {readAppSettings} from "@/lib/settings-server";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(readAppSettings(true),{headers:{"Cache-Control":"no-store"}});}
