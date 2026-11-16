"use client";
import {useMemo,type ReactNode} from 'react';
import CustomPage from './CustomPage';
import {evaluateExpression,type ExpressionOptions} from '@/lib/expression';
import type {CustomPageLayout,CustomNode} from '@/lib/custom-page';
import type {Column} from '@/lib/columns';
import './list-card.css';
type Props={layout:CustomPageLayout;row:Record<string,any>;columns:Column[];options:ExpressionOptions;displayField?:(c:Column)=>ReactNode;actions?:string[];busy?:boolean;onAction?:(name:string)=>void;onDetail?:()=>void};
export default function ListCard({layout,row,columns,options,displayField,actions=[],busy=false,onAction,onDetail}:Props){
 const binding=useMemo(()=>{const cache=new Map<string,{value?:any;error?:string}>();return(source:string)=>{if(!cache.has(source)){try{cache.set(source,{value:evaluateExpression(source,row,options)});}catch{cache.set(source,{error:'คำนวณไม่ได้'});}}return cache.get(source)!;};},[row,options]);
 const renderValue=(node:CustomNode,value:unknown)=>{const match=/^\[([a-z][a-z0-9_]{0,40})\]$/.exec(node.valueExpr?.trim()||''),col=match?columns.find(c=>c.name===match[1]):undefined;return col&&row.__errors?.[col.name]?'คำนวณไม่ได้':col&&displayField?displayField(col):value==null?'':Array.isArray(value)?value.join(', '):String(value);};
 return <div className="custom-list-card" data-row-id={row.id} role="group" aria-label={'รายการ '+(row.__label??row.id)} tabIndex={onDetail?0:undefined} onClick={ev=>{if(!(ev.target as HTMLElement).closest('button,a,input,select,textarea'))onDetail?.();}} onKeyDown={ev=>{if(ev.target===ev.currentTarget&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();onDetail?.();}}}><CustomPage layout={layout} rowContext working={busy?'card-busy':undefined} binding={binding} renderValue={renderValue} availableActions={busy?[]:actions} onActivate={node=>{if(busy)return;if(node.event==='action'){if(node.action&&actions.includes(node.action))onAction?.(node.action);}else onDetail?.();}}/></div>;
}
