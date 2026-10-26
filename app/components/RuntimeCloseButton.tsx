"use client";
import {createContext,useContext,type ButtonHTMLAttributes} from 'react';
export const RuntimeCloseContext=createContext<(run:()=>void)=>void>(run=>run());
export default function RuntimeCloseButton({onClose,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{onClose:()=>void}) {
 const request=useContext(RuntimeCloseContext);
 return <button type="button" {...props} onClick={()=>request(onClose)}/>;
}
