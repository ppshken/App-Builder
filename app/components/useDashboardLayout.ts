"use client";
import {useLayoutEffect,useState} from 'react';
import type {ViewDisplay} from '@/lib/view-display';
import {dashboardLayout} from '@/lib/dashboard-layout';
export function useDashboardLayout(d:ViewDisplay){
 const [element,ref]=useState<HTMLElement|null>(null),[size,setSize]=useState({width:0,availableHeight:0,touchLayout:false});
 const layout=dashboardLayout(d,size.width,size.touchLayout);
 useLayoutEffect(()=>{if(!element)return;let frame=0;
 const update=()=>{const width=Math.floor(element.getBoundingClientRect().width),panels=element.querySelector<HTMLElement>('.dashboard-panels');if(width<=0||!panels)return;
 const touchLayout=innerWidth<1024&&!!element.closest(".runtime-app");
 const main=element.closest('main'),nav=element.closest('.runtime-app')?.querySelector<HTMLElement>('.runtime-primary'),navRect=nav?.getBoundingClientRect();
 const viewport=window.visualViewport,viewportBottom=Math.min(innerHeight,viewport?viewport.height+viewport.offsetTop:innerHeight),bottom=navRect&&navRect.height>0?Math.min(viewportBottom,navRect.top):viewportBottom;
 let scroll=0;for(let node:HTMLElement|null=panels.parentElement;node;node=node.parentElement){scroll+=node.scrollTop;if(node===main)break;}
 const availableHeight=Math.max(0,Math.floor(bottom-panels.getBoundingClientRect().top-scroll-12));
 setSize(old=>old.width===width&&old.availableHeight===availableHeight&&old.touchLayout===touchLayout?old:{width,availableHeight,touchLayout});};
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};update();const observer=new ResizeObserver(schedule);observer.observe(element);const nav=element.closest(".runtime-app")?.querySelector(".runtime-primary");if(nav)observer.observe(nav);const tabs=element.querySelector(":scope > .dashboard-tabs");if(tabs)observer.observe(tabs);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
 return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);};},[element,d.dashboard_layout,d.dashboard_mobile_tabs,d.dashboard_gap,layout.mode]);
 return {ref,availableHeight:size.availableHeight,...layout};
}
