"use client";
import {useAuth} from "./AuthProvider";import {appResourceUrl} from "@/lib/pwa";
import {useImagePreview} from "./ImagePreviewProvider";
import {usePendingImagePreview} from './PendingImagesProvider';
export default function PreviewImage({src,alt,...props}:React.ImgHTMLAttributes<HTMLImageElement> & {src:string;alt:string}) {
 const open=useImagePreview(),{application}=useAuth();src=appResourceUrl(usePendingImagePreview(src),application);
 return <img loading="lazy" decoding="async" referrerPolicy="no-referrer" {...props} src={src} alt={alt} role="button" tabIndex={0} aria-label={`ดูภาพเต็ม ${alt}`} title="กดดูภาพเต็ม" onClick={e=>{e.stopPropagation();open(src,alt);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();open(src,alt);}}}/>;
}
