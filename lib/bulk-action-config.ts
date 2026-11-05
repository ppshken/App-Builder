export type BulkActionConfig={enabled:boolean;allowed_action_ids:string[];max_selection:number;confirmation_required:true;toolbar_position:'top'|'bottom'};
export const BULK_DEFAULTS:BulkActionConfig={enabled:false,allowed_action_ids:[],max_selection:100,confirmation_required:true,toolbar_position:'top'};
export function validateBulkConfig(value:unknown):BulkActionConfig{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Bulk Actions configuration must be an object');
 const v=value as BulkActionConfig;
 if(Object.keys(v).some(k=>!Object.hasOwn(BULK_DEFAULTS,k))||typeof v.enabled!=='boolean'||!Array.isArray(v.allowed_action_ids)||v.allowed_action_ids.length>100||new Set(v.allowed_action_ids).size!==v.allowed_action_ids.length||v.allowed_action_ids.some(n=>typeof n!=='string'||!/^[a-z][a-z0-9_]{0,40}$/.test(n))||!Number.isInteger(v.max_selection)||v.max_selection<1||v.max_selection>100||v.confirmation_required!==true||!['top','bottom'].includes(v.toolbar_position))throw Error('Invalid Bulk Actions configuration (maximum 100; confirmation required)');
 return v;
}
export type BulkSelection=Record<string,string>;
export function toggleBulkRows(selected:BulkSelection,rows:{id:number;__version?:string;__permissions?:{update?:boolean;delete?:boolean}}[],checked:boolean,max:number):BulkSelection{
 const next={...selected};for(const row of rows){if(!checked){delete next[row.id];continue;}if(row.__permissions?.update===false&&row.__permissions?.delete!==true||!Number.isSafeInteger(row.id)||row.id<1||!row.__version||!/^[a-f0-9]{64}$/.test(row.__version))continue;if(Object.hasOwn(next,row.id)||Object.keys(next).length<max)next[row.id]=row.__version;}return next;
}
