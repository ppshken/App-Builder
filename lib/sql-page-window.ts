/** Choose the nearer end of a stable SQL ordering after COUNT and permission filtering. */
export function sqlPageWindow(total:number,page:number,size:number,direction:'ASC'|'DESC'){
 if(!Number.isSafeInteger(total)||total<0||!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(size)||size<1||!['ASC','DESC'].includes(direction))throw Error('หน้าข้อมูลไม่ถูกต้อง');
 const last=Math.max(1,Math.ceil(total/size)),offset=(Math.min(page,last)-1)*size,limit=Math.min(size,total-offset),fromEnd=total-offset-limit,reverse=fromEnd<offset;
 return {offset:reverse?fromEnd:offset,limit,direction:reverse?(direction==='ASC'?'DESC':'ASC'):direction,reverse};
}
