"use client";
import {useLayoutEffect,useState} from 'react';
import type {ViewDisplay} from '@/lib/view-display';
import {dashboardLayout} from '@/lib/dashboard-layout';
export function useDashboardLayout(d:ViewDisplay){
 const [element,ref]=useState<HTMLElement|null>(null),[width,setWidth]=useState(0);
 useLayoutEffect(()=>{if(!element)return;const update=()=>{const next=Math.floor(element.getBoundingClientRect().width);if(next>0)setWidth(previous=>previous===next?previous:next);};update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();},[element]);
 return {ref,...dashboardLayout(d,width)};
}
