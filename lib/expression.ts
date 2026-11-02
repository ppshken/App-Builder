import {createUuid} from "./uuid";
import {normalizeDateTime} from "./datetime";
import {distanceKilometers} from "./location";
import {durationMilliseconds,formatDuration,normalizeDuration,isDuration,temporalKind,temporalMilliseconds} from "./duration";
import {formatExpressionText} from "./expression-text";
// A bounded parser/interpreter shared by browser and server. No executable user code.
export type Value = string | number | boolean | null | string[];
type Node = { kind: "literal"; value: Value; start:number; end:number } | { kind: "column"; name: string; start: number; end: number }
  | { kind: "outer"; name: string; start: number; end: number }
  | { kind: "deref"; column: string; name: string; start: number; end: number; refStart: number; refEnd: number }
  | { kind: "table"; table: string; name: string; start: number; end: number }
  | { kind: "related"; table: string; name: string; refColumn?: string; start: number; end: number; tableStart: number; tableEnd: number; refStart?: number }
  | { kind: "unary"; op: string; value: Node } | { kind: "binary"; op: string; left: Node; right: Node }
  | { kind: "call"; name: string; args: Node[] };
type Token = { kind: string; text: string; start: number; end: number; value?: Value };
const arities: Record<string, [number, number]> = {
  IF: [3, 3], IFS: [2, 100], AND: [1, 100], OR: [1, 100], NOT: [1, 1],
  ISBLANK: [1, 1], ISNOTBLANK: [1, 1], CONCATENATE: [1, 100], LEN: [1, 1],
  TRIM: [1, 1], UPPER: [1, 1], LOWER: [1, 1], TODAY: [0, 0], NOW: [0, 0], DATE: [1, 1],
  YEAR: [1, 1], MONTH: [1, 1], DAY: [1, 1], ROUND: [1, 1], ABS: [1, 1], MIN: [1, 100], MAX: [1, 100],
  LIST: [0, 100], COUNT: [1, 1], IN: [2, 2], UNIQUEID: [0, 0], USEREMAIL: [0, 0], USERID: [0,0], USERNAME: [0,0], USERROLE: [0,0], USERROLEKEY: [0,0], ISOWNER: [0,0], USERSETTINGS: [1,1],
  DISTANCE:[2,2],DURATION:[1,1], TOTALHOURS:[1,1], TOTALMINUTES:[1,1], TOTALSECONDS:[1,1],
  ORDERBY:[2,41],SELECT: [2, 3], SUM: [1, 1], RIGHT: [2, 2], TEXT: [1, 2], INDEX: [2, 2],
};
export const FUNCTION_NAMES = Object.keys(arities);
function fail(message: string, at?: number): never { throw new Error(message + (at === undefined ? "" : ` (ตำแหน่ง ${at + 1})`)); }
export const isBlank = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
export function asBoolean(v: Value): boolean {
  if (typeof v === "boolean") return v;
  if (v === 0 || v === 1) return v === 1;
  if (isBlank(v)) return false;
  return fail("เงื่อนไขต้องได้ค่า TRUE หรือ FALSE กรุณาใช้การเปรียบเทียบ เช่น [qty] > 0");
}
function numeric(v: Value): number {
  if (isBlank(v)) return 0;
  if ((typeof v !== "number" && typeof v !== "string") || !Number.isFinite(Number(v)))
    return fail("สูตรต้องใช้ตัวเลข กรุณาตรวจค่าของคอลัมน์ที่นำมาคำนวณ");
  return Number(v);
}
function equivalent(a: Value, b: Value) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  // SQLite yes/no values are 0/1; AppSheet-style comparisons also use TRUE/FALSE.
  if (typeof a === "boolean" && (b === 0 || b === 1)) return a === (b === 1);
  if (typeof b === "boolean" && (a === 0 || a === 1)) return b === (a === 1);
  return a === b || (isBlank(a) && isBlank(b));
}
function listEquivalent(a: Value, b: Value): boolean {
  // Numeric IDs are serialized as strings in lists; text codes remain distinct.
  if ((typeof a === "number" && typeof b === "string") || (typeof b === "number" && typeof a === "string")) {
    const number = (typeof a === "number" ? a : b) as number;
    const text = (typeof a === "string" ? a : b) as string;
    return Number.isFinite(number) && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)
      && Number.isFinite(Number(text)) && number === Number(text);
  }
  return equivalent(a, b);
}
function tokenize(source: string): Token[] {
  if (source.length > 4000) fail("สูตรยาวเกิน 4,000 ตัวอักษร กรุณาแบ่งเป็นช่องคำนวณหลายช่อง");
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    const start = i, ch = source[i];
    if (ch === "[") {
      const end = source.indexOf("]", i + 1);
      if (end < 0) fail("ขาด ] ปิดชื่อคอลัมน์", i);
      const name = source.slice(i + 1, end).trim();
      if (/^Related_[a-z][a-z0-9_]{0,40}(?::[a-z][a-z0-9_]{0,40})?$/.test(name)) {
        i = end + 1; tokens.push({kind: "related", text: name, start, end: i}); continue;
      }
      if (!/^(?:[a-z][a-z0-9_]{0,40}|_THIS|_THISROW|__SYNC_(?:CREATED|UPDATED|FAILED|SOURCE))$/.test(name)) fail("ใช้ชื่อคอลัมน์ในระบบภายใน [ ] เช่น [qty]", i);
      i = end + 1; tokens.push({ kind: "column", text: name, start, end: i });
    } else if (ch === '"' || ch === "'") {
      let value = "", closed = false; i++;
      while (i < source.length) {
        if (source[i] === ch) {
          if (source[i + 1] === ch) { value += ch; i += 2; continue; }
          i++; closed = true; break;
        }
        if (source[i] === "\\") {
          i++;
          if (i >= source.length) break;
          const escape: Record<string, string> = { n: "\n", r: "\r", t: "\t", "\\": "\\", '"': '"', "'": "'" };
          if (!(source[i] in escape)) fail("อักขระหลีกไม่รองรับ กรุณาตรวจเครื่องหมายหลัง backslash", i);
          value += escape[source[i++]];
        } else value += source[i++];
      }
      if (!closed) fail("ขาดเครื่องหมายคำพูดปิดข้อความ", start);
      tokens.push({ kind: "literal", text: source.slice(start, i), value, start, end: i });
    } else {
      const rest = source.slice(i);
      const num = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      const word = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
      const op = rest.match(/^(?:<=|>=|<>|!=|==|[+\-*/%=<>&(),.])/);
      if (num) {
        i += num[0].length;
        if (!Number.isFinite(Number(num[0]))) fail("ตัวเลขในสูตรใหญ่เกินไป", start);
        tokens.push({ kind: "literal", text: num[0], value: Number(num[0]), start, end: i });
      } else if (word) {
        i += word[0].length;
        const text = word[0].toUpperCase();
        tokens.push({ kind: ["TRUE", "FALSE", "NULL"].includes(text) && !/^\s*\[/.test(source.slice(i)) ? "literal" : "word", text,
          value: text === "TRUE" ? true : text === "FALSE" ? false : null, start, end: i });
      } else if (op) { i += op[0].length; tokens.push({ kind: "op", text: op[0], start, end: i }); }
      else fail(`ไม่รองรับอักขระ "${ch}" กรุณาตรวจรูปแบบสูตร`, i);
    }
    if (tokens.length > 1000) fail("สูตรซับซ้อนเกินไป กรุณาแบ่งเป็นช่องคำนวณหลายช่อง");
  }
  tokens.push({ kind: "end", text: "", start: i, end: i });
  return tokens;
}
// Format validated tokens, retaining original literals and every grouping bracket.
// This changes whitespace only; it never evaluates the expression.
export function formatFormula(source:string):string {
  parseExpression(source);
  const tokens=tokenize(source).slice(0,-1),pairs=new Map<number,number>(),stack:number[]=[];
  tokens.forEach((t,i)=>{if(t.text==='(')stack.push(i);else if(t.text===')')pairs.set(stack.pop()!,i);});
  const indent=(depth:number)=>'  '.repeat(depth);
  function render(start:number,end:number,depth:number):string {
    let out='';
    for(let i=start;i<end;i++) {
      const t=tokens[i];
      if(t.text==='(') {
        const close=pairs.get(i)!,call=i>start&&tokens[i-1].kind==='word';
        if(call) {
          const ranges:[number,number][]=[];let begin=i+1;
          for(let j=begin;j<close;j++) {if(tokens[j].text==='(')j=pairs.get(j)!;else if(tokens[j].text===','){ranges.push([begin,j]);begin=j+1;}}
          if(begin<close)ranges.push([begin,close]);
          const args=ranges.map(([a,b])=>render(a,b,depth+1));
          const multiline=args.length>1||args.some(a=>a.includes('\n')||a.length>72);
          out+=multiline?'(\n'+args.map(a=>indent(depth+1)+a).join(',\n')+'\n'+indent(depth)+')':'('+args.join(', ')+')';
        }else out+='('+render(i+1,close,depth)+')';
        i=close;continue;
      }
      if(t.kind==='op'&&t.text!=='.'&&t.text!==',') {
        const previous=i>start?tokens[i-1]:undefined;
        const unary=(t.text==='+'||t.text==='-')&&(!previous||(previous.kind==='op'&&previous.text!==')'));
        out=unary?out+t.text:out.trimEnd()+' '+t.text+' ';continue;
      }
      if(t.text===','){out=out.trimEnd()+', ';continue;}
      if(t.text==='.'){out=out.trimEnd()+'.';continue;}
      out+=t.kind==='column'||t.kind==='related'?'['+t.text+']':source.slice(t.start,t.end);
    }
    return out.trim();
  }
  const formatted=render(0,tokens.length,0);
  // Keep the parser's existing limits and leave the caller's original text intact on failure.
  parseExpression(formatted);
  return formatted;
}
export function parseExpression(source: string): Node {
  if (typeof source !== "string" || !source.trim()) fail("กรุณากรอกสูตร");
  const tokens = tokenize(source);
  let p = 0, depth = 0;
  const precedence: Record<string, number> = { "=": 1, "==": 1, "<>": 1, "!=": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "%": 4 };
  function expression(min = 0): Node {
    if (++depth > 64) fail("สูตรซ้อนกันเกิน 64 ชั้น กรุณาแบ่งสูตร");
    const token = tokens[p++];
    let node: Node;
    if (token.kind === "literal") node = { kind: "literal", value: token.value!, start:token.start, end:token.end };
    else if (token.kind === "related") {
      const [table, refColumn] = token.text.slice("Related_".length).split(":");
      if (table === "id" || refColumn === "id") fail("Related ต้องระบุชื่อตารางลูกและคอลัมน์ Ref ที่ถูกต้อง", token.start);
      const tableStart = source.indexOf("Related_", token.start) + "Related_".length;
      const property = tokens[p].kind === "column" ? tokens[p++] : undefined;
      if (property?.text.startsWith("_")) fail("Related ต้องดึงคอลัมน์ข้อมูลของตารางลูก", property.start);
      node = {kind: "related", table, name: property?.text || "id", refColumn, start: property?.start ?? token.start, end: property?.end ?? token.end, tableStart, tableEnd: tableStart + table.length, refStart: refColumn ? tableStart + table.length + 1 : undefined};
    }
    else if (token.kind === "column") {
      if (token.text === "_THISROW") {
        if (tokens[p].text !== "." || tokens[p + 1]?.kind !== "column" || tokens[p + 1].text.startsWith("_")) fail("ใช้ [_THISROW].[ชื่อคอลัมน์] เพื่ออ้างแถวในฟอร์ม", token.start);
        p++; const col = tokens[p++]; node = { kind: "outer", name: col.text, start: col.start, end: col.end };
      } else if (tokens[p].text === ".") {
        p++; const property = tokens[p++];
        if (property.kind !== "column" || property.text.startsWith("_") || token.text.startsWith("_")) fail("ดึงข้อมูลจาก Ref ด้วย [product].[product_price]", token.start);
        node = { kind: "deref", column: token.text, name: property.text, start: property.start, end: property.end, refStart: token.start, refEnd: token.end };
      } else node = { kind: "column", name: token.text, start: token.start, end: token.end };
    }
    else if (token.text === "+" || token.text === "-") node = { kind: "unary", op: token.text, value: expression(5) };
    else if (token.text === "(") {
      node = expression();
      if (tokens[p].text !== ")") fail("ขาด ) ปิดวงเล็บ", tokens[p].start);
      p++;
    } else if (token.kind === "word") {
      if (tokens[p].kind === "column") {
        const table = source.slice(token.start, token.end), col = tokens[p++];
        if (!/^[a-z][a-z0-9_]{0,40}$/.test(table) || table === "id" || col.text.startsWith("_")) fail("ใช้ชื่อตารางและคอลัมน์ในระบบ เช่น permission[permission_key]", token.start);
        node = { kind: "table", table, name: col.text, start: col.start, end: col.end };
      } else {
      if (!Object.hasOwn(arities, token.text)) fail(`ไม่รองรับฟังก์ชัน ${token.text} ในรุ่นนี้`, token.start);
      if (tokens[p].text !== "(") fail(`ใส่วงเล็บหลัง ${token.text} เช่น ${token.text}()`, tokens[p].start);
      p++;
      const args: Node[] = [];
      if (tokens[p].text !== ")") {
        while (true) {
          args.push(expression());
          if (tokens[p].text !== ",") break;
          p++;
        }
      }
      if (tokens[p].text !== ")") fail("ขาด ) หรือ , คั่นค่าของฟังก์ชัน", tokens[p].start);
      p++;
      const [low, high] = arities[token.text];
      if (args.length < low || args.length > high || (token.text === "IFS" && args.length % 2))
        fail(`${token.text} ต้องรับ ${token.text === "IFS" ? "เงื่อนไขและผลลัพธ์เป็นคู่" : low === high ? `${low} ค่า` : `${low}–${high} ค่า`}`, token.start);
      node = { kind: "call", name: token.text, args };
      if (token.text === "SELECT" && args[0].kind !== "table") fail("SELECT ช่องแรกต้องเป็น ตาราง[คอลัมน์] เช่น SELECT(permission[permission_key], TRUE)", token.start);
      }
    } else fail("คาดว่าจะเป็นค่า ชื่อคอลัมน์ หรือฟังก์ชัน", token.start);
    while (Object.hasOwn(precedence, tokens[p].text) && precedence[tokens[p].text] >= min) {
      const op = tokens[p++].text;
      node = { kind: "binary", op, left: node, right: expression(precedence[op] + 1) };
    }
    depth--; return node;
  }
  const root = expression();
  if (tokens[p].kind !== "end") fail(`พบ "${tokens[p].text}" เกินมา กรุณาตรวจเครื่องหมายคั่นหรือวงเล็บ`, tokens[p].start);
  return root;
}

/** Rewrite table tokens only; string literals and column identifiers are preserved. */
export function remapExpressionTables(source:string,mapping:Record<string,string>){
 if(!source.trim()||!Object.keys(mapping).length)return source;
 parseExpression(source);const tokens=tokenize(source),edits:{start:number;end:number;value:string}[]=[];
 for(let i=0;i<tokens.length-1;i++){const t=tokens[i],name=source.slice(t.start,t.end);if(t.kind==='word'&&tokens[i+1].kind==='column'&&mapping[name])edits.push({start:t.start,end:t.end,value:mapping[name]});if(t.kind==='related'){const table=t.text.slice(8).split(':')[0];if(mapping[table]){const start=source.indexOf('Related_',t.start)+8;edits.push({start,end:start+table.length,value:mapping[table]});}}}
 for(const edit of edits.reverse())source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);return source;
}
function visit(node: Node, fn: (node: Node) => void) {
  fn(node);
  if (node.kind === "unary") visit(node.value, fn);
  if (node.kind === "binary") { visit(node.left, fn); visit(node.right, fn); }
  if (node.kind === "call") node.args.forEach((arg) => visit(arg, fn));
}
export function userSettingReferences(source:string):(string|null)[]{const names=new Set<string|null>();if(source.trim())visit(parseExpression(source),n=>{if(n.kind==="call"&&n.name==="USERSETTINGS"){const a=n.args[0];names.add(a.kind==="literal"&&typeof a.value==="string"?a.value:null);}});return [...names];}
function listSourceNode(node:Node):{table:string;column:string}|null{if(node.kind==='table'||node.kind==='related')return {table:node.table,column:node.name};if(node.kind==='call'&&['SELECT','ORDERBY'].includes(node.name))return listSourceNode(node.args[0]);return null;}
function scopedVisit(node: Node, fn: (node: Node, table?: string) => void, table?: string) {
  fn(node, table);
  if (node.kind === "unary") scopedVisit(node.value, fn, table);
  if (node.kind === "binary") { scopedVisit(node.left, fn, table); scopedVisit(node.right, fn, table); }
  if (node.kind === "call") node.args.forEach((arg, i) => scopedVisit(arg, fn, node.name === "SELECT" && i === 1 && node.args[0].kind === "table" ? node.args[0].table : node.name==="ORDERBY"&&i%2===1?listSourceNode(node.args[0])?.table||table:table));
}
export function references(source: string): string[] {
  const names = new Set<string>();
  scopedVisit(parseExpression(source), (n, table) => { if (n.kind === "outer" || (n.kind === "column" && (!table || n.name === "_THIS"))) names.add(n.name); });
  scopedVisit(parseExpression(source), (n, table) => { if (n.kind === "deref" && !table) names.add(n.column); });
  scopedVisit(parseExpression(source), (n, table) => { if (n.kind === "related" && !table) names.add("id"); });
  return [...names];
}
export function tableReferences(source: string, includeRelated = true): { table: string; column: string }[] {
  const result: { table: string; column: string }[] = [];
  scopedVisit(parseExpression(source), (n, table) => {
    if (n.kind === "table") result.push({ table: n.table, column: n.name });
    else if (n.kind === "related" && includeRelated) { result.push({table: n.table, column: n.name}); if (n.refColumn) result.push({table: n.table, column: n.refColumn}); }
    else if (n.kind === "column" && table && n.name !== "_THIS") result.push({ table, column: n.name });
    else if (n.kind === "deref" && table) result.push({ table, column: n.column });
  });
  return result;
}
export function relatedReferences(source: string): {table: string; column: string; refColumn?: string; ownerTable?: string}[] {
  const result: {table: string; column: string; refColumn?: string; ownerTable?: string}[] = [];
  scopedVisit(parseExpression(source), (n, ownerTable) => {
    if (n.kind === "related") result.push({table: n.table, column: n.name, refColumn: n.refColumn, ownerTable});
  });
  return result;
}
export function referencePaths(source: string): { column: string; property: string; table?: string }[] {
  const paths: { column: string; property: string; table?: string }[] = [];
  scopedVisit(parseExpression(source), (n, table) => { if (n.kind === "deref") paths.push({ column: n.column, property: n.name, table }); });
  return paths;
}
export function renameDereference(source: string, table: string, old: string, next: string, refs: Record<string, string>, schemas: Record<string, Record<string, string>>): string {
  if (!source) return source;
  const spans: { start: number; end: number }[] = [];
  scopedVisit(parseExpression(source), (n, scope) => {
    if (n.kind === "deref" && n.name === old && (scope ? schemas[scope]?.[n.column] : refs[n.column]) === table) spans.push(n);
  });
  for (const span of spans.sort((a, b) => b.start - a.start)) source = source.slice(0, span.start) + `[${next}]` + source.slice(span.end);
  return source;
}
export function listSource(source: string): { table: string; column: string } | null {
  if (!source.trim()) return null;
  return listSourceNode(parseExpression(source));
}
// Migrate only LIST literals that produce the final result. Never replace text
// in SELECT conditions, IF tests, column names or unrelated expressions.
export function rewriteReferenceListLiterals(source:string, convert:(value:string)=>string):string {
  const spans:{start:number;end:number;value:string}[]=[];
  function rewrite(node:Node) {
    if(node.kind!=="call")return;
    if(node.name==="IF"){rewrite(node.args[1]);rewrite(node.args[2]);}
    else if(node.name==="IFS")for(let i=1;i<node.args.length;i+=2)rewrite(node.args[i]);
    else if(node.name==="LIST")for(const arg of node.args)if(arg.kind==="literal"&&typeof arg.value==="string"){
      spans.push({start:arg.start,end:arg.end,value:JSON.stringify(convert(arg.value))});
    }
  }
  rewrite(parseExpression(source));
  for(const span of spans.sort((a,b)=>b.start-a.start))source=source.slice(0,span.start)+span.value+source.slice(span.end);
  return source;
}
export function renameReference(source: string, oldName: string, newName: string, targetTable?: string): string {
  if (!source) return source;
  const nodes: { start: number; end: number }[] = [];
  scopedVisit(parseExpression(source), (n, table) => {
    if (n.kind === "table" && targetTable === n.table && n.name === oldName) nodes.push(n);
    else if (n.kind === "related" && targetTable === n.table) {
      if (n.name === oldName && n.start > n.tableEnd) nodes.push(n);
      if (n.refColumn === oldName && n.refStart !== undefined) nodes.push({start: n.refStart, end: n.refStart + oldName.length});
    }
    else if (n.kind === "column" && n.name === oldName && (targetTable ? table === targetTable : !table)) nodes.push(n);
    else if (n.kind === "outer" && !targetTable && n.name === oldName) nodes.push(n);
    else if (n.kind === "deref" && n.column === oldName && (targetTable ? table === targetTable : !table)) nodes.push({ start: n.refStart, end: n.refEnd });
  });
  // Replace spans from the end; text literals such as "[qty]" are left untouched.
  for (const n of nodes.sort((a, b) => b.start - a.start)) source = source.slice(0, n.start) + (source[n.start] === "[" ? `[${newName}]` : newName) + source.slice(n.end);
  return source;
}
const parsedCache = new Map<string, Node>();
// Formatting rules are fixed; values are still evaluated with this call's clock.
const bangkokDateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
export type ExpressionTable = { columns: string[]; key: string; rows: Record<string, Value>[]; labels: Record<string, string>; labelImages?:Record<string,string>; refs?: Record<string, string>; relatedRefs?: Record<string, string> };
export type ExpressionUser = {userId?:number;userName?:string;userRole?:string;userRoleKey?:string;userSettings?:Record<string,Value>};
export type ExpressionContext = ExpressionUser & { tableName?: string; columnTypes?:Record<string,string>;tables?: Record<string, ExpressionTable>; getTable?: (name: string) => ExpressionTable; getRelatedTable?: (name: string, column: string) => ExpressionTable; refTables?: Record<string, string> };
export type ExpressionOptions = ExpressionContext & { now?: Date; resolve?: (name: string) => Value; userEmail?: string; referenceListTable?: string };
export function evaluateExpression(source: string | Node, row: Record<string, Value> = {}, options: ExpressionOptions = {}): Value {
  let node: Node;
  if (typeof source === "string") {
    node = parsedCache.get(source) ?? parseExpression(source);
    if (!parsedCache.has(source)) {
      if (parsedCache.size >= 128) parsedCache.delete(parsedCache.keys().next().value!);
      parsedCache.set(source, node);
    }
  } else node = source;
  const now = options.now ?? new Date();
  let steps = 0;
  let formattedTime: {date:string;time:string}|undefined;
  const timeParts = () => {
    if(formattedTime)return formattedTime;
    const parts = bangkokDateFormatter.formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)!.value;
    return formattedTime = { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}:${get("second")}` };
  };
  function dataset(name: string): ExpressionTable {
    const data = options.getTable ? options.getTable(name) : options.tables && Object.hasOwn(options.tables, name) ? options.tables[name] : undefined;
    if (!data) fail(`ไม่พบข้อมูลตาราง ${name} กรุณาตรวจชื่อในระบบหรือโหลดข้อมูลใหม่`);
    if (data.rows.length > 10000) fail("ตารางตัวเลือกมีข้อมูลเกิน 10,000 แถว กรุณาลดจำนวนรายการ");
    return data;
  }
  function tableValue(data: ExpressionTable, name: string, candidate: Record<string, Value>) {
    if (!data.columns.includes(name)) fail(`ไม่พบคอลัมน์ [${name}] ในตารางตัวเลือก`);
    const value = candidate[name];
    if (isBlank(value)) return null;
    if (typeof value !== "string" && typeof value !== "number") fail("คอลัมน์ตัวเลือกต้องเป็นข้อความหรือตัวเลข");
    return String(value);
  }
  function run(n: Node, scope?: { row: Record<string, Value>; refs: Record<string, string>; table?: string }, referenceResult = false): Value {
    if (++steps > (options.tables || options.getTable ? 100000 : 2000)) fail("สูตรใช้การคำนวณมากเกินไป กรุณาแบ่งสูตร");
    let result: Value;
    if (n.kind === "literal") result = n.value;
    else if (n.kind === "table") {
      const data = dataset(n.table);
      if (!data.columns.includes(n.name)) fail(`ไม่พบคอลัมน์ [${n.name}] ในตาราง ${n.table}`);
      if (referenceResult && n.table !== options.referenceListTable) fail(`สูตร List ต้องดึงจากตาราง ${options.referenceListTable}`);
      result = data.rows.map(r => {const value=tableValue(data,n.name,r);return value===null ? null : referenceResult ? String(r.id) : value;}).filter((v): v is string => v !== null);
    } else if (n.kind === "related") {
      const data = options.getRelatedTable ? options.getRelatedTable(n.table, n.name) : dataset(n.table);
      if (data.rows.length > 10000) fail("ตาราง Related มีข้อมูลเกิน 10,000 แถว");
      if (!data.columns.includes(n.name)) fail(`ไม่พบคอลัมน์ [${n.name}] ในตาราง ${n.table}`);
      const owner = scope?.table || options.tableName;
      const links = Object.entries(data.relatedRefs ?? data.refs ?? {}).filter(([name, target]) => (!n.refColumn || name === n.refColumn) && (!owner || target === owner));
      if (links.length !== 1) fail(links.length ? `ตาราง ${n.table} มี Ref ไปตารางแม่หลายช่อง กรุณาระบุ [Related_${n.table}:ชื่อคอลัมน์Ref][${n.name}]` : `ไม่พบ Ref จากตาราง ${n.table} ไปตารางแม่ปัจจุบัน`);
      if (referenceResult && n.table !== options.referenceListTable) fail(`สูตร List ต้องดึงจากตาราง ${options.referenceListTable}`);
      const id = scope ? scope.row.id : options.resolve ? options.resolve("id") : row.id;
      const values: string[] = [];
      // An unsaved parent must never match orphan rows with an empty Ref.
      if (!isBlank(id)) for (const candidate of data.rows) {
        if (++steps > 100000) fail("สูตรใช้การคำนวณมากเกินไป กรุณาแบ่งสูตร");
        if (!listEquivalent(candidate[links[0][0]], id ?? null)) continue;
        const value = tableValue(data, n.name, candidate);
        if (value !== null) values.push(referenceResult ? String(candidate.id) : value);
      }
      result = values;
    } else if (n.kind === "deref") {
      const table = (scope?.refs || options.refTables || {})[n.column];
      if (!table) fail(`คอลัมน์ [${n.column}] ต้องเป็นชนิด Ref ก่อนดึง [${n.name}]`);
      const id = run({ kind: "column", name: n.column, start: n.refStart, end: n.refEnd }, scope);
      if (isBlank(id)) result = null;
      else {
        const data = dataset(table);
        if (!data.columns.includes(n.name)) fail(`ไม่พบคอลัมน์ [${n.name}] ในตาราง ${table}`);
        const target = data.rows.find(r => r.id === Number(id));
        if (!target) fail(`ไม่พบแถวที่ [${n.column}] อ้างอิง กรุณาเลือกข้อมูลใหม่`);
        result = target[n.name] ?? null;
      }
    } else if (n.kind === "column" || n.kind === "outer") {
      if (scope && n.kind === "column" && n.name !== "_THIS") {
        if (!Object.hasOwn(scope.row, n.name)) fail(`ไม่พบคอลัมน์ [${n.name}] ในตารางที่ SELECT`);
        result = scope.row[n.name] ?? null;
      } else if (options.resolve) result = options.resolve(n.name);
      else if (Object.hasOwn(row, n.name)) result = row[n.name] ?? null;
      else fail(`ไม่พบคอลัมน์ [${n.name}] กรุณาตรวจชื่อในระบบ`);
    } else if (n.kind === "unary") {const v=run(n.value,scope);result=isDuration(v)?formatDuration((n.op==="-"?-1:1)*durationMilliseconds(v)):(n.op==="-"?-1:1)*numeric(v);}
    else if (n.kind === "binary") {
      const a = run(n.left, scope), b = run(n.right, scope);
      switch (n.op) {
        case "+": result = isDuration(a)&&isDuration(b)?formatDuration(durationMilliseconds(a)+durationMilliseconds(b)):numeric(a)+numeric(b); break;
        case "-": {const typedTime=(n.left.kind==="column"&&options.columnTypes?.[n.left.name]==="time")||(n.right.kind==="column"&&options.columnTypes?.[n.right.name]==="time");if(typedTime&&(isBlank(a)||isBlank(b))){result=null;break;}const left=temporalKind(a)||(n.left.kind==="column"&&["date","datetime"].includes(options.columnTypes?.[n.left.name]||"")?options.columnTypes![n.left.name]:null),right=temporalKind(b)||(n.right.kind==="column"&&["date","datetime"].includes(options.columnTypes?.[n.right.name]||"")?options.columnTypes![n.right.name]:null);if((left&&isBlank(b))||(right&&isBlank(a))){result=null;break;}if(left&&right){if(left!==right)fail('กรุณาลบวันที่ชนิดเดียวกัน Date กับ Date หรือ DateTime กับ DateTime');const diff=temporalMilliseconds(String(a))-temporalMilliseconds(String(b));result=left==='date'?diff/86400000:formatDuration(diff);}else if(isDuration(a)&&isDuration(b))result=formatDuration(durationMilliseconds(a)-durationMilliseconds(b));else result=numeric(a)-numeric(b);break;}
        case "*": result = numeric(a) * numeric(b); break;
        case "/": case "%": {
          const divisor = numeric(b);
          if (divisor === 0) fail("หารด้วยศูนย์ไม่ได้ กรุณาใช้ IF ตรวจค่าก่อนหาร");
          result = n.op === "/" ? numeric(a) / divisor : numeric(a) % divisor; break;
        }
        case "&": result = String(a ?? "") + String(b ?? ""); break;
        case "=": case "==": result = equivalent(a, b); break;
        case "<>": case "!=": result = !equivalent(a, b); break;
        default: {
          if (isBlank(a) || isBlank(b)) result = false;
          else {
            const durations=isDuration(a)&&isDuration(b);
            const left = durations?durationMilliseconds(a):typeof a === "number" || typeof b === "number" ? numeric(a) : String(a);
            const right = durations?durationMilliseconds(b):typeof a === "number" || typeof b === "number" ? numeric(b) : String(b);
            result = n.op === "<" ? left < right : n.op === ">" ? left > right : n.op === "<=" ? left <= right : left >= right;
          }
        }
      }
    } else {
      const arg = (i: number, reference = false) => run(n.args[i], scope, reference);
      switch (n.name) {
        case "ORDERBY": {
          const source=listSourceNode(n.args[0]);if(!source)fail('ORDERBY ช่องแรกต้องเป็น ตาราง[id] หรือ SELECT(ตาราง[id], เงื่อนไข)');
          const data=dataset(source.table);if(!['id',data.key].includes(source.column))fail('ORDERBY ต้องใช้รายการ id หรือ Key ของตาราง');
          if(referenceResult&&source.table!==options.referenceListTable)fail('สูตร List ต้องดึงจากตาราง '+options.referenceListTable);
          const keys=arg(0,referenceResult);if(!Array.isArray(keys))fail('ORDERBY ต้องรับรายการรหัสแถว');if(keys.length>10000)fail('ORDERBY รับได้ไม่เกิน 10,000 แถว');
          const sorters:{node:Node;descending:boolean}[]=[];for(let i=1;i<n.args.length;i+=2)sorters.push({node:n.args[i],descending:i+1<n.args.length?asBoolean(arg(i+1)):false});
          const keyColumn=referenceResult?'id':source.column,lookup=new Map(data.rows.map(row=>[String(row[keyColumn]),row]));
          const decorated=keys.map((key,index)=>{const row=lookup.get(String(key));if(!row)fail('ORDERBY ไม่พบรหัสแถว '+String(key)+' ในตาราง '+source.table);return {key,index,sorts:sorters.map(sort=>{const value=run(sort.node,{row,refs:data.refs||{},table:source.table});if(Array.isArray(value))fail('ค่าสำหรับเรียง ORDERBY ต้องเป็นค่าเดียว');return value;})};});
          const compare=(a:Value,b:Value)=>{if(isBlank(a)||isBlank(b))return isBlank(a)?isBlank(b)?0:-1:1;if(isDuration(a)&&isDuration(b))return durationMilliseconds(a)-durationMilliseconds(b);if(typeof a==='number'&&typeof b==='number')return a-b;if(typeof a==='boolean'&&typeof b==='boolean')return Number(a)-Number(b);return String(a).localeCompare(String(b),'th',{numeric:true});};
          decorated.sort((a,b)=>{for(let i=0;i<sorters.length;i++){const compared=compare(a.sorts[i],b.sorts[i]);if(compared)return compared*(sorters[i].descending?-1:1);}return a.index-b.index;});result=decorated.map(item=>item.key);break;
        }
        case "SELECT": {
          const source = n.args[0]; if (source.kind !== "table") fail("SELECT ต้องระบุตาราง[คอลัมน์]");
          const data = dataset(source.table), distinct = n.args.length === 3 ? asBoolean(arg(2)) : false;
          if (referenceResult && source.table !== options.referenceListTable) fail(`สูตร List ต้องดึงจากตาราง ${options.referenceListTable}`);
          if (!data.columns.includes(source.name)) fail(`ไม่พบคอลัมน์ [${source.name}] ในตาราง ${source.table}`);
          const values: string[] = [];
          for (const candidate of data.rows) {
            if (!asBoolean(run(n.args[1], { row: candidate, refs: data.refs || {}, table: source.table }))) continue;
            const value = tableValue(data, source.name, candidate); if (value !== null) values.push(referenceResult ? String(candidate.id) : value);
          }
          result = distinct ? [...new Set(values)] : values; break;
        }
        case "IF": result = arg(asBoolean(arg(0)) ? 1 : 2, referenceResult); break;
        case "IFS": {
          result = null;
          for (let i = 0; i < n.args.length; i += 2) if (asBoolean(arg(i))) { result = arg(i + 1, referenceResult); break; }
          break;
        }
        case "AND": result = n.args.every(a => asBoolean(run(a, scope))); break;
        case "OR": result = n.args.some(a => asBoolean(run(a, scope))); break;
        case "NOT": result = !asBoolean(arg(0)); break;
        case "LIST": result = n.args.map(a => { const v = run(a, scope); if (typeof v !== "string" && typeof v !== "number") fail("LIST ต้องรับข้อความหรือตัวเลข"); return String(v); }); break;
        case "COUNT": { const v = arg(0); if (!Array.isArray(v)) fail("COUNT ต้องรับรายการ เช่น [tags]"); result = v.length; break; }
        case "IN": { const needle = arg(0), values = arg(1); if (!Array.isArray(values)) fail("IN ต้องรับรายการในช่องที่สอง เช่น IN(\"ด่วน\", [tags])"); result = values.some(v => listEquivalent(needle, v)); break; }
        case "UNIQUEID": result = createUuid(); break;
        case "USERID": result = options.userId ?? null; break;
        case "USERNAME": result = options.userName || ""; break;
        case "USERROLE": result = options.userRole || ""; break;
        case "USERROLEKEY": result = options.userRoleKey || ""; break;
        case "ISOWNER": result = options.userRoleKey === "owner"; break;
        case "USERSETTINGS": {const key=arg(0);if(typeof key!=="string"||!key.trim())fail('USERSETTINGS ต้องรับชื่อในระบบ เช่น USERSETTINGS("branch")');if(!options.userSettings||!Object.hasOwn(options.userSettings,key))fail('ไม่พบค่าตั้งค่าผู้ใช้ "'+key+'" กรุณาตรวจชื่อในระบบที่ผู้ใช้และสิทธิ์');result=options.userSettings![key];break;}
        case "USEREMAIL": result = options.userEmail || ""; break;
        case "ISBLANK": result = isBlank(arg(0)); break;
        case "ISNOTBLANK": result = !isBlank(arg(0)); break;
        case "CONCATENATE": result = n.args.map(a => String(run(a, scope) ?? "")).join(""); break;
        case "DISTANCE": {const from=arg(0),to=arg(1);result=isBlank(from)||isBlank(to)?null:distanceKilometers(from,to);break;}
        case "DURATION": result=normalizeDuration(arg(0));break;
        case "TOTALHOURS": case "TOTALMINUTES": case "TOTALSECONDS": {const v=arg(0);result=isBlank(v)?null:durationMilliseconds(v)/(n.name==='TOTALHOURS'?3600000:n.name==='TOTALMINUTES'?60000:1000);break;}
        case "SUM": {const values=arg(0);if(!Array.isArray(values))fail("SUM ต้องรับรายการ เช่น SUM(SELECT(order_item[amount], TRUE))");if(values.length>10000)fail("SUM รับรายการได้ไม่เกิน 10,000 ค่า");result=values.some(v=>isDuration(v))&&values.every(v=>isBlank(v)||isDuration(v))?formatDuration(values.reduce((total,v)=>total+(isBlank(v)?0:durationMilliseconds(v)),0)):values.reduce((total,v)=>total+numeric(v),0);break;}
        case "RIGHT": {const value=arg(0),count=numeric(arg(1));if(!Number.isSafeInteger(count)||count<0)fail("RIGHT จำนวนตัวอักษรต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป");if(Array.isArray(value))fail("RIGHT ต้องรับข้อความหรือตัวเลข ไม่ใช่รายการ");result=count===0?"":Array.from(String(value??"")).slice(-count).join("");break;}
        case "TEXT": result=formatExpressionText(arg(0),n.args.length===2?arg(1):undefined);break;
        case "INDEX": {const values=arg(0),index=numeric(arg(1));if(!Array.isArray(values))fail("INDEX ต้องรับรายการ เช่น INDEX([tags], 1)");if(!Number.isSafeInteger(index))fail("INDEX ตำแหน่งต้องเป็นจำนวนเต็ม โดยรายการแรกเริ่มที่ 1");result=index>=1&&index<=values.length?values[index-1]:null;break;}
        case "LEN": result = Array.from(String(arg(0) ?? "")).length; break;
        case "TRIM": result = String(arg(0) ?? "").trim().replace(/\s+/g, " "); break;
        case "UPPER": result = String(arg(0) ?? "").toUpperCase(); break;
        case "LOWER": result = String(arg(0) ?? "").toLowerCase(); break;
        case "DATE": {
          const value = arg(0);
          if (isBlank(value)) { result = null; break; }
          if (typeof value !== "string") fail('DATE ต้องรับวันที่หรือวันเวลา เช่น DATE([created_at])');
          const text = value.trim();
          if (temporalKind(text) === "date") { temporalMilliseconds(text); result = text; }
          else if (temporalKind(text) === "datetime") result = normalizeDateTime(text).slice(0, 10);
          else fail('DATE ต้องรับวันที่ YYYY-MM-DD หรือวันเวลา YYYY-MM-DDTHH:MM:SS');
          break;
        }
        case "TODAY": result = timeParts().date; break;
        case "NOW": { const t = timeParts(); result = `${t.date}T${t.time}+07:00`; break; }
        case "YEAR": case "MONTH": case "DAY": {
          const v = String(arg(0) ?? "");
          if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v)) fail(`${n.name} ต้องใช้วันที่ เช่น "2026-10-05"`);
          const date = v.slice(0, 10);
          const d = new Date(`${date}T00:00:00Z`);
          if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) fail("วันที่ในสูตรไม่ถูกต้อง กรุณาตรวจวัน เดือน และปี");
          result = Number(date.slice(n.name === "YEAR" ? 0 : n.name === "MONTH" ? 5 : 8, n.name === "YEAR" ? 4 : n.name === "MONTH" ? 7 : 10)); break;
        }
        case "ROUND": { const v = numeric(arg(0)); result = Math.sign(v) * Math.round(Math.abs(v)); break; }
        case "ABS": result = Math.abs(numeric(arg(0))); break;
        case "MIN": result = Math.min(...n.args.map(a => numeric(run(a, scope)))); break;
        case "MAX": result = Math.max(...n.args.map(a => numeric(run(a, scope)))); break;
        default: return fail(`ไม่รองรับฟังก์ชัน ${n.name}`);
      }
    }
    if (typeof result === "number" && !Number.isFinite(result)) fail("ผลคำนวณใหญ่เกินไป กรุณาตรวจตัวเลขในสูตร");
    if (typeof result === "string" && result.length > 10000) fail("ข้อความที่สูตรสร้างยาวเกิน 10,000 ตัวอักษร");
    return result;
  }
  return run(node,undefined,!!options.referenceListTable);
}
