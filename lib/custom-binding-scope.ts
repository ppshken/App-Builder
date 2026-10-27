import type {AppAccess} from './access';
/** Bind in-memory expression snapshots to the same identity and ACL as the server. */
export function customBindingScope(sources:string[],application:string,workspace:string,email:string,access:AppAccess,revision:number){return JSON.stringify([application,workspace,email,{owner:access.owner,builder:access.builder,tables:access.tables,datasets:access.datasets,rowRules:access.rowRules,role:access.effectiveRole?.name},revision,sources]);}
