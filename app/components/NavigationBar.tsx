"use client";
import {forwardRef} from "react";
import Icon from "./Icon";
import type {IconName} from "@/lib/icons";
import {featuredNavigationItem,type NavigationSettings} from "@/lib/navigation";
export type NavigationItem={name:string;label:string;icon:IconName};
const NavigationBar=forwardRef<HTMLDivElement,{items:NavigationItem[];active:string;settings:NavigationSettings;onSelect?:(name:string)=>void;className?:string;staticPreview?:boolean;label?:string}>(function NavigationBar({items,active,settings,onSelect,className="",staticPreview=false,label="Primary Navigation"},ref){
 const featured=settings.style.startsWith("raised")?featuredNavigationItem(items.map(i=>i.name),settings):"";
 const classes="app-navigation nav-style-"+settings.style+" nav-labels-"+settings.labels+" nav-surface-"+settings.surface+" nav-density-"+settings.density+" "+className;
 return <div ref={ref} role={staticPreview?undefined:"navigation"} aria-label={staticPreview?undefined:label} className={classes} hidden={!items.length}>{items.map(item=>{
 const current=item.name===active,content=<><span className="nav-icon"><Icon name={item.icon}/></span><span className="nav-label">{item.label}</span></>;
 return staticPreview?<span key={item.name} className="app-nav-item" aria-current={current?"page":undefined} data-featured={item.name===featured?"true":undefined}>{content}</span>:<button type="button" key={item.name} className="app-nav-item" aria-label={item.label} title={item.label} aria-current={current?"page":undefined} data-featured={item.name===featured?"true":undefined} onClick={()=>onSelect?.(item.name)}>{content}</button>;
 })}</div>;
});
export default NavigationBar;
