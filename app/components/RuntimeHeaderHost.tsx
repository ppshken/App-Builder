"use client";
import {createContext} from 'react';
export const RuntimeHeaderHost=createContext<HTMLElement|null>(null);

// All screens in an app elect their header together, including during a child portal's layout commit.
type Claim=(owns:boolean)=>void;
const elections=new WeakMap<Element,{claims:Map<HTMLElement,Claim>;observer:MutationObserver;sync:()=>void}>();
export function registerRuntimeHeader(app:Element,screen:HTMLElement,claim:Claim){
 let election=elections.get(app);if(!election){const claims=new Map<HTMLElement,Claim>();const sync=()=>{const winner=Array.from(app.querySelectorAll<HTMLElement>('.runtime-screen')).filter(el=>claims.has(el)&&!el.closest('[hidden],.runtime-background')).at(-1);for(const [element,notify] of claims)notify(element===winner);};const observer=new MutationObserver(sync);observer.observe(app,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});election={claims,observer,sync};elections.set(app,election);}
 election.claims.set(screen,claim);election.sync();return()=>{election!.claims.delete(screen);election!.sync();if(!election!.claims.size){election!.observer.disconnect();elections.delete(app);}};
}
