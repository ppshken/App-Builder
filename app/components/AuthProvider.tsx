"use client";
import {createContext,useContext,useEffect} from "react";
import type {AuthUser} from "@/lib/auth";
import {clearRuntimeCache} from "@/lib/runtime-cache";
import {NO_ACCESS,type AppAccess} from "@/lib/access";
import type {ExpressionUser} from "@/lib/expression";
const Context=createContext<{user:AuthUser|null;needsSetup:boolean;access:AppAccess;expressionUser:ExpressionUser}>({user:null,needsSetup:false,access:NO_ACCESS,expressionUser:{}});
let signingOut=false;
export const useAuth=()=>useContext(Context);
export async function logout(all=false){signingOut=true;try{const response=await fetch("/api/auth/logout"+(all?"?all=1":""),{method:"POST"});if(!response.ok)throw Error("ออกจากระบบไม่ได้ กรุณาลองใหม่");clearRuntimeCache();try{localStorage.setItem("nocode:auth",String(Date.now()));}catch{}location.assign("/login");}catch(error){signingOut=false;throw error;}}
export default function AuthProvider({user,needsSetup,access,expressionUser,children}:{user:AuthUser|null;needsSetup:boolean;access:AppAccess;expressionUser:ExpressionUser;children:React.ReactNode}){
 useEffect(()=>{const original=window.fetch;const wrapped:typeof fetch=async(input,init)=>{const response=await original(input,init);const target=input instanceof Request?input.url:String(input);const url=new URL(target,location.href);if(!signingOut&&response.status===401&&url.origin===location.origin&&url.pathname.startsWith("/api/")&&!url.pathname.startsWith("/api/auth/")&&location.pathname!=="/login"){clearRuntimeCache();location.replace("/login?next="+encodeURIComponent(location.pathname+location.search));}return response;};window.fetch=wrapped;
 const changed=(e:StorageEvent)=>{if(e.key==="nocode:auth"||e.key==="nocode:user-settings"){clearRuntimeCache();location.reload();}};window.addEventListener("storage",changed);return()=>{if(window.fetch===wrapped)window.fetch=original;window.removeEventListener("storage",changed);};},[]);
 return <Context.Provider value={{user,needsSetup,access,expressionUser}}>{children}</Context.Provider>;
}
