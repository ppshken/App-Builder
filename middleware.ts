import {NextRequest,NextResponse} from "next/server";
export function middleware(req:NextRequest){const headers=new Headers(req.headers);headers.set("x-nocode-path",req.nextUrl.pathname+req.nextUrl.search);return NextResponse.next({request:{headers}});}
export const config={matcher:["/((?!api|_next/static|_next/image|favicon.ico).*)"]};
