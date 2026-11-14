const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluateExpression}=require('../.test-build/expression'),{expressionLookup}=require('../.test-build/expression-lookup');
function table(rows){return {columns:['id','group','amount'],key:'id',rows,labels:{}};}
function compare(source,row,rows){const data=table(rows),base={tables:{items:data}},run=options=>{try{return {value:evaluateExpression(source,row,options)};}catch(e){return {error:e.message};}};assert.deepEqual(run({...base,getEqualityRows:expressionLookup()}),run(base));}
test('indexed SELECT keeps equality types, blank values, row order, distinct and residual filters',()=>{
 const rows=[{id:1,group:0,amount:1},{id:2,group:false,amount:2},{id:3,group:'0',amount:3},{id:4,group:null,amount:4},{id:5,group:'',amount:5},{id:6,group:undefined,amount:6},{id:7,group:[],amount:7}];
 for(const group of [0,false,'0',null,'',undefined,[],true,1])for(const condition of ['[group] = [_THISROW].[group]','[_THISROW].[group] == [group]','AND([group] = [_THISROW].[group], [amount] > 1)'])compare('SELECT(items[id], '+condition+')',{group},rows);
 for(const source of ['SELECT(items[group], [group] = [_THISROW].[group], TRUE)','SUM(SELECT(items[amount], [group] = [_THISROW].[group]))','ORDERBY(SELECT(items[id], [group] = [_THISROW].[group]), [amount], TRUE)'])compare(source,{group:0},rows.slice(0,6));
});
test('lookup skips repeated full scans for sibling SELECT and preserves unrelated short-circuit errors',()=>{
 let reads=0;const rows=Array.from({length:12000},(_,i)=>({id:i+1,get group(){reads++;return Math.floor(i/10);},amount:1})),data=table(rows),getEqualityRows=expressionLookup(),opts={tables:{items:data},getEqualityRows};
 for(let group=0;group<150;group++)assert.equal(evaluateExpression('COUNT(SELECT(items[id], [group] = [_THISROW].[group]))',{group},opts),10);
 assert.ok(reads<=15000,'build once plus matching rows, not 1,800,000 scans: '+reads);
 for(const source of ['SELECT(items[id], AND(1 / 0 = 1, [group] = [_THISROW].[group]))','SELECT(items[id], OR([group] = [_THISROW].[group], 1 / 0 = 1))'])assert.throws(()=>evaluateExpression(source,{group:-1},opts),/ศูนย์/);
 assert.deepEqual(evaluateExpression('SELECT(items[id], AND([group] = [_THISROW].[group], 1 / 0 = 1))',{group:-1},opts),[]);
});
test('indexes are isolated by snapshot and context; missing fields and empty tables keep interpreter behavior',()=>{
 const lookup=expressionLookup(),data=table([{id:1,group:7,amount:1}]),next=table([{id:2,group:7,amount:2}]);
 assert.deepEqual(lookup(data,'group',7).map(r=>r.id),[1]);assert.deepEqual(lookup(next,'group',7).map(r=>r.id),[2]);
 const source='SELECT(items[id], [group] = [_THISROW].[group])';
 assert.throws(()=>evaluateExpression(source,{group:7},{tables:{items:table([{id:1}])},getEqualityRows:lookup}),/ไม่พบคอลัมน์/);
 assert.deepEqual(evaluateExpression(source,{}, {tables:{items:table([])},getEqualityRows:lookup}),[]);
 assert.throws(()=>evaluateExpression(source,{}, {tables:{items:data},getEqualityRows:lookup}),/ไม่พบคอลัมน์/);
 assert.equal(expressionLookup()(table([{id:3,group:7}]),'group',7)[0].id,3);
});
