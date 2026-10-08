"use client";
import type {ReactNode,CSSProperties} from "react";
import {dataStyleFor,type DataStyle} from "@/lib/data-decoration";
import type {ExpressionOptions} from "@/lib/expression";
import Icon,{type IconName} from "./Icon";
export default function DecoratedValue({column,row,config,options,children}:{column:string;row:Record<string,any>;config?:DataStyle;options?:ExpressionOptions;children:ReactNode}){if(!config)return <>{children}</>;const {appearance:s,error}=dataStyleFor(column,row,config,options);const icon=s.icon?<Icon className="value-decoration-icon" name={s.icon as IconName} aria-hidden="true" style={{color:s.icon_color||undefined}}/>:null;return <span data-column={column} className={"value-decoration value-decoration-"+s.style+" value-decoration-size-"+s.size} title={error||undefined} style={{color:s.color||undefined,background:s.background||undefined,borderColor:s.border_color||undefined,borderRadius:s.radius+"px",fontWeight:s.bold?700:undefined} as CSSProperties}>{s.icon_position==="before"&&icon}<span className="value-decoration-content">{children}</span>{s.icon_position==="after"&&icon}{error&&<span className="sr-only">{error}</span>}</span>;}
