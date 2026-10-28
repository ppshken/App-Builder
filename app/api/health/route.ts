import {NextResponse} from 'next/server';
import {platformDatabase} from '@/lib/db';
export const dynamic='force-dynamic';
/** Minimal readiness signal: no account, schema, paths or diagnostics are public. */
export async function GET(){try{platformDatabase().prepare('SELECT 1').get();return NextResponse.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
