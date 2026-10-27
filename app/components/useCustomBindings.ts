"use client";
import {useEffect,useMemo,useState} from 'react';
import {customBindingScope} from '@/lib/custom-binding-scope';
import {evaluateExpression} from '@/lib/expression';
import {customExpressions,type CustomPageLayout} from '@/lib/custom-page';
import {useAuth} from './AuthProvider';
export default function useCustomBindings(layout:CustomPageLayout|undefined,revision:number,email:string){
 const {expressionUser,application,workspace,access}=useAuth(),sources=useMemo(()=>customExpressions(layout),[layout]),key=useMemo(()=>customBindingScope(sources,application,workspace,email,access,revision),[sources,application,workspace,email,access,revision]);
 const [state,setState]=useState<{key:string;tables:Record<string,any>;errors:Record<string,string>;loading:boolean}>({key:'',tables:{},errors:{},loading:false});
 useEffect(()=>{const controller=new AbortController(),tables:Record<string,any>={},errors:Record<string,string>={};if(!sources.length){setState({key,tables,errors,loading:false});return;}setState({key,tables:{},errors:{},loading:true});
 const request=async(source:string)=>{const r=await fetch('/api/expression-data?source='+encodeURIComponent(source),{headers:{'x-nocode-app':application,'x-nocode-preview-email':email},signal:controller.signal,cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error||'โหลดข้อมูลสูตรไม่ได้');Object.assign(tables,j);};
 const batches:string[][]=[];for(const source of sources){const last=batches[batches.length-1];if(!last||last.join('').length+source.length>3000)batches.push([source]);else last.push(source);}
 void(async()=>{for(const batch of batches){if(controller.signal.aborted)return;try{await request('LIST('+batch.map(s=>'('+s+')').join(',')+')');}catch{for(const source of batch){if(controller.signal.aborted)return;try{await request(source);}catch(e){errors[source]=(e as Error).message;}}}}if(!controller.signal.aborted)setState({key,tables,errors,loading:false});})().catch(()=>{});return()=>controller.abort();
 },[key,revision,email,application]);
 return useMemo(()=>{const context={...expressionUser,userEmail:email,tables:state.tables,now:new Date()};return(source:string):{value?:unknown;error?:string;loading?:boolean}=>{if(state.key!==key||state.loading)return {loading:true};if(state.errors[source])return {error:state.errors[source]};try{return {value:evaluateExpression(source,{},context)};}catch(e){return {error:(e as Error).message};}};},[state,key,expressionUser,email]);
}
