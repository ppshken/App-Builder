"use client";
import {useEffect,useState,type ReactNode} from "react";
import {isRemoteImageSource} from "@/lib/image-source";
import {usePendingImagePreview} from './PendingImagesProvider';
export function LabelThumbnail({src}:{src?:unknown}){const preview=usePendingImagePreview(typeof src==='string'?src:''),[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[preview]);if(failed||typeof src!=="string"||!(/^\/api\/images\/[a-f0-9-]{36}$/.test(src)||isRemoteImageSource(src)))return null;return <img className="row-label-image" src={preview} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;}
export default function RecordLabel({text,image}:{text:ReactNode;image?:unknown}){return <span className="row-label"><LabelThumbnail src={image}/><span className="row-label-text">{text}</span></span>;}
