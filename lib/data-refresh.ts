export type DataRefreshReceipt={source:string;table:string;slice:string;query?:string;list?:boolean;recordId?:number};
export type DataRefreshStamp={data:number;realtime:number};
// A receipt acknowledges only the sender's completed authoritative read, never a realtime change.
export function requiredRefresh(previous:DataRefreshStamp,next:DataRefreshStamp,receipt:DataRefreshReceipt|undefined,target:{source:string;table:string;slice:string;query?:string;recordId?:number}){
 const realtime=previous.realtime!==next.realtime,external=previous.data!==next.data;
 const own=receipt?.source===target.source&&receipt.table===target.table&&receipt.slice===target.slice;
 return {list:realtime||external&&!(own&&receipt?.list===true&&receipt.query===target.query),detail:realtime||external&&!(own&&target.recordId!==undefined&&receipt?.recordId===target.recordId)};
}
