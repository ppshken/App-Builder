// Keep the configured initial set stable. Only an outside selection is promoted.
export function choiceButtons<T extends {value:string}>(initial:readonly T[],options:readonly T[],selected:readonly string[],limit:number):T[]{
 const count=Math.max(1,Math.min(5,limit)),base=initial.slice(0,count),baseIds=new Set(base.map(o=>o.value));
 const outside=options.filter(o=>selected.includes(o.value)&&!baseIds.has(o.value));
 return [...outside,...base].slice(0,count);
}
