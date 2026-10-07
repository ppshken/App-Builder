"use client";
import {useImagePreview} from "./ImagePreviewProvider";
export default function PreviewImage({src,alt,...props}:React.ImgHTMLAttributes<HTMLImageElement> & {src:string;alt:string}) {
 const open=useImagePreview();
 return <img {...props} src={src} alt={alt} role="button" tabIndex={0} aria-label={`ดูภาพเต็ม ${alt}`} title="กดดูภาพเต็ม" onClick={e=>{e.stopPropagation();open(src,alt);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();open(src,alt);}}}/>;
}
