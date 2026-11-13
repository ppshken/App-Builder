import {AsyncLocalStorage} from 'node:async_hooks';

export type DevelopmentContext={id:string;sourceAppId:string;databaseFile:string};
const globalScope=globalThis as typeof globalThis&{__nocodeDevelopmentScope?:AsyncLocalStorage<DevelopmentContext>};
const scope=globalScope.__nocodeDevelopmentScope??=new AsyncLocalStorage<DevelopmentContext>();
export const currentDevelopment=()=>scope.getStore();
export function withDevelopment<T>(context:DevelopmentContext,work:()=>T){return scope.run(context,work);}
export class DevelopmentIsolationError extends Error {status=409;}
export function assertDevelopmentEffect(effect:string){if(currentDevelopment())throw new DevelopmentIsolationError('พื้นที่พัฒนาปิดการทำงานจริง: '+effect+' กรุณาใช้การจำลองแทน');}
export function assertDevelopmentAction(kind:string){if(currentDevelopment()&&!['set','add','copy','delete','grouped'].includes(kind))throw new DevelopmentIsolationError('พื้นที่พัฒนาทดลองได้เฉพาะ Action เปลี่ยนข้อมูลภายในพื้นที่ ใช้การจำลองสำหรับ Action ประเภทนี้');}
