import {AsyncLocalStorage} from 'node:async_hooks';
import type {TableAccess} from './access';
export const APPLICATION_COOKIE='nocode_app';
export const DEFAULT_APPLICATION='default';
export type ApplicationScope={id:string;datasets?:Record<string,TableAccess>;temporaryTables?:Set<string>};
const root=globalThis as typeof globalThis & {__nocodeApplicationScope?:AsyncLocalStorage<ApplicationScope>};
const scope=root.__nocodeApplicationScope??=new AsyncLocalStorage<ApplicationScope>();
export const currentApplication=()=>scope.getStore();
export function withApplication<T>(app:ApplicationScope,work:()=>T){return scope.run(app,work);}
export function withApplicationTemporaryTable<T>(name:string,work:()=>T){const application=currentApplication();return application?withApplication({...application,temporaryTables:new Set([...(application.temporaryTables||[]),name])},work):work();}
export function applicationCookie(cookie:string|null){return cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(APPLICATION_COOKIE+'='))?.slice(APPLICATION_COOKIE.length+1)||DEFAULT_APPLICATION;}
export function validApplicationId(id:string){return id===DEFAULT_APPLICATION||/^a_[a-f0-9]{24}$/.test(id);}
export const APPLICATION_CONFIG_TABLES=['_table_overlays','_slices','_views','_actions','_app_settings','_pdf_templates','_automations','_automation_jobs','_app_versions','_role_actions','_user_setting_defs','_user_setting_values'] as const;
export function applicationTable(id:string,table:string){if(!validApplicationId(id))throw Error('รหัสแอปไม่ถูกต้อง');return id===DEFAULT_APPLICATION?table:'_'+id+table;}
const tokens=/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]|[A-Za-z_][A-Za-z0-9_]*/g;
// Only trusted SQL identifiers are routed; string literals (including stored formulas) and comments are untouched.
export function applicationSql(sql:string,id=currentApplication()?.id){if(!id||id===DEFAULT_APPLICATION)return sql;const names=new Set<string>(APPLICATION_CONFIG_TABLES);return sql.replace(tokens,token=>{if(token.startsWith("'")||token.startsWith('--')||token.startsWith('/*'))return token;const quote=['"','`','['].includes(token[0]),name=quote?token.slice(1,-1):token;return names.has(name)?(quote?token[0]+applicationTable(id,name)+(token[0]==='['?']':token[0]):applicationTable(id,name)):token;});}
export class ApplicationBoundaryError extends Error{status=403;}
// Defence in depth for raw business-table reads. API/record permissions still enforce operation and row rights.
export function assertApplicationSql(sql:string){const app=currentApplication();if(!app?.datasets)return;let previous='';for(const token of sql.match(tokens)||[]){if(token.startsWith("'")||token.startsWith('--')||token.startsWith('/*'))continue;const name=['"','`','['].includes(token[0])?token.slice(1,-1):token;const tablePosition=['FROM','JOIN','UPDATE','INTO'].includes(previous.toUpperCase());previous=name;if(tablePosition&&/^t_[a-z][a-z0-9_]{0,40}$/.test(name)&&!app.datasets[name.slice(2)]?.read&&!app.temporaryTables?.has(name))throw new ApplicationBoundaryError('ตารางนี้ไม่ได้เชื่อมกับแอป หรือไม่มีสิทธิ์อ่านข้อมูล');}}
