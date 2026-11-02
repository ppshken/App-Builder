import {remapExpressionTables} from './expression';
const formulaKeys=new Set(['condition','expression','formula','expr','valueExpr','showIf','disabledIf','rowExpr','show_if','valid_if','required_if','editable_if','part_show_if','part_add_if','part_valid_if']);
const formulaMaps=new Set(['values','initial_values','defaults','payload','response_values']);
export function remapApplicationConfig(value:any,mapping:Record<string,string>,key='',formulaMap=false):any{
 const reference=(text:string)=>{const parts=text.split(':');if(parts[0]==='related'&&mapping[parts[1]])parts[1]=mapping[parts[1]];else if(parts.length===2&&mapping[parts[0]])parts[0]=mapping[parts[0]];return parts.join(':');};
 if(typeof value==='string'){
  if(formulaMap||formulaKeys.has(key)||key.endsWith('_expr'))return remapExpressionTables(value,mapping);
  if(['table','table_name','ref_table','owner_table','source_table','target_table'].includes(key))return mapping[value]||value;
  if(key==='text'&&value.startsWith('='))return '='+remapExpressionTables(value.slice(1),mapping);
  if(['detail_order','form_order','fields'].includes(key))return reference(value);
  return value;
 }
 if(Array.isArray(value))return value.map(v=>remapApplicationConfig(v,mapping,key,formulaMap));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,v])=>[reference(name),remapApplicationConfig(v,mapping,name,formulaMaps.has(key))]));
 return value;
}
