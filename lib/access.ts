export type TableAccess={read:boolean;create:boolean;update:boolean;delete:boolean;export?:boolean};
export type AppAccess={owner:boolean;builder:boolean;tables:Record<string,TableAccess>;actions:string[];datasets?:Record<string,TableAccess>;applicationRole?:{name:string;label:string};effectiveRole?:{name:string;label:string};rowRules?:Record<string,string>};
export const NO_ACCESS:AppAccess={owner:false,builder:false,tables:{},actions:[]};
// Preserve drafts only for additive grants to previously absent resources. Any
// change to existing rights, role, rules or security boundary still fences caches.
export function runtimeAccessInvalidates(before:AppAccess,after:AppAccess){
 const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
 const equal=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const rest=({tables,datasets,actions,...other}:AppAccess)=>other;
 if(!equal(rest(before),rest(after))||!!before.datasets!==!!after.datasets)return true;
 for(const field of ['tables','datasets'] as const)for(const [name,rights] of Object.entries(before[field]||{}))if(!equal(rights,after[field]?.[name]))return true;
 return before.actions.some(action=>!after.actions.includes(action));
}
export function tableAccess(access:AppAccess,table:string):TableAccess{const rights:TableAccess=access.owner||access.builder?{read:true,create:true,update:true,delete:true,export:true}:access.tables[table]||{read:false,create:false,update:false,delete:false,export:false};if(!access.datasets)return rights;const limit=access.datasets[table];return {read:!!limit?.read&&rights.read,create:!!limit?.read&&!!limit.create&&rights.create,update:!!limit?.read&&!!limit.update&&rights.update,delete:!!limit?.read&&!!limit.delete&&rights.delete,export:!!limit?.read&&!!limit.export&&!!rights.export};}
