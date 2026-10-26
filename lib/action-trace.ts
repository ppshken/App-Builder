import {AsyncLocalStorage} from 'node:async_hooks';
export type TraceStep={kind:string;label:string;table?:string;row_id?:number;column?:string;formula?:string;before?:unknown;after?:unknown;input?:Record<string,unknown>;passed?:boolean;status?:string};
const storage=new AsyncLocalStorage<TraceStep[]>();
export function withActionTrace<T>(steps:TraceStep[],run:()=>T){return storage.run(steps,run);}
export function traceAction(step:TraceStep){const steps=storage.getStore();if(steps){if(steps.length>=1000)throw Error('ผลทดสอบเกิน 1,000 ขั้นตอน กรุณาลดขนาด Action');steps.push(step);}}
