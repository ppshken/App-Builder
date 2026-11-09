// Preserve the existing order inside each group, including legacy mixed metadata.
export function dataColumnOrder<T extends {is_virtual?:number|boolean}>(columns:readonly T[]):T[]{
 return [...columns.filter(c=>!c.is_virtual),...columns.filter(c=>!!c.is_virtual)];
}
