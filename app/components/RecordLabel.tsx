"use client";
import {useEffect,useState,type ReactNode} from "react";
export function LabelThumbnail({src}:{src?:unknown}){const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);if(failed||typeof src!=="string"||!/^\/api\/images\/[a-f0-9-]{36}$/.test(src))return null;return <img className="row-label-image" src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>;}
export default function RecordLabel({text,image}:{text:ReactNode;image?:unknown}){return <span className="row-label"><LabelThumbnail src={image}/><span className="row-label-text">{text}</span></span>;}
