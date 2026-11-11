"use client";
import {useLayoutEffect,useRef,type TableHTMLAttributes} from 'react';

// Equalize the visible page using its natural tallest data row. Keep native table
// layout, wrapping, interactive controls and group/header sizing intact.
export default function UniformTable(props:TableHTMLAttributes<HTMLTableElement>){
 const tableRef=useRef<HTMLTableElement>(null);
 useLayoutEffect(()=>{
  const table=tableRef.current;if(!table)return;let frame=0,disposed=false;
  const measure=()=>{frame=0;if(disposed||!table.isConnected||!table.getClientRects().length||!table.offsetWidth)return;
   const rows=Array.from(table.tBodies).flatMap(body=>Array.from(body.rows).filter(row=>!row.classList.contains('record-group-row')&&Array.from(row.cells).some(cell=>cell.tagName==='TD')));
   // Reset and apply in one layout phase, so content can shrink as well as grow.
   table.style.removeProperty('--uniform-data-row-height');
   if(rows.length){const height=Math.max(...rows.map(row=>row.offsetHeight));if(height>0)table.style.setProperty('--uniform-data-row-height',height+'px');}
  };
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(measure);};
  const changes=new MutationObserver(records=>{if(records.some(record=>record.target!==table||record.type!=='attributes'||record.attributeName!=='style'))schedule();});
  changes.observe(table,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});
  const rootChanges=new MutationObserver(schedule);rootChanges.observe(document.documentElement,{attributes:true,attributeFilter:['style','class','data-mode']});
  const resize=new ResizeObserver(schedule);resize.observe(table);if(table.parentElement)resize.observe(table.parentElement);
  table.addEventListener('load',schedule,true);table.addEventListener('error',schedule,true);document.fonts?.addEventListener('loadingdone',schedule);
  measure();
  return()=>{disposed=true;if(frame)cancelAnimationFrame(frame);changes.disconnect();rootChanges.disconnect();resize.disconnect();table.removeEventListener('load',schedule,true);table.removeEventListener('error',schedule,true);document.fonts?.removeEventListener('loadingdone',schedule);table.style.removeProperty('--uniform-data-row-height');};
 },[]);
 return <table {...props} ref={tableRef} data-uniform-rows="true"/>;
}
