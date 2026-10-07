export type TableAccess={read:boolean;create:boolean;update:boolean;delete:boolean};
export type AppAccess={owner:boolean;builder:boolean;tables:Record<string,TableAccess>;actions:string[]};
export const NO_ACCESS:AppAccess={owner:false,builder:false,tables:{},actions:[]};
export function tableAccess(access:AppAccess,table:string):TableAccess{return access.owner||access.builder?{read:true,create:true,update:true,delete:true}:access.tables[table]||{read:false,create:false,update:false,delete:false};}
