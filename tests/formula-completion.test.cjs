const {test}=require('node:test'),assert=require('node:assert/strict');
const {formulaCompletions}=require('../.test-build/formula-completion');
const cols=[{name:'status',type:'enum'},{name:'qty',type:'number'}];
const tables=[{name:'inspection_groups',columns:[{name:'inspection_categories_id',type:'ref'},{name:'inspection_groups',type:'text'}]}];
const suggest=s=>formulaCompletions(s,s.length,cols,tables);
test('partial function and table names match the screenshot workflow',()=>{
 assert.ok(suggest('SE').items.some(i=>i.label==='SELECT()'));
 assert.ok(suggest('SELECT(\n  inspe').items.some(i=>i.label==='inspection_groups'));
 assert.deepEqual(suggest('inspection_groups[').items.map(i=>i.label),['id','inspection_categories_id','inspection_groups']);
 assert.equal(suggest('inspection_groups[inspection_c').items[0].insert,'inspection_categories_id]');
});
test('completion respects local columns, SELECT row scope, quoted text, and an existing closing bracket',()=>{
 assert.ok(suggest('[st').items.some(i=>i.label==='status'));
 assert.ok(suggest('SELECT(inspection_groups[id], [inspection_c').items.some(i=>i.label==='inspection_categories_id'));
 assert.equal(suggest('"SE').items.length,0);
 assert.equal(suggest('"done" + SE').items[0].label,'SELECT()');
 assert.equal(formulaCompletions('[st]',3,cols,tables).items[0].insert,'status');
 assert.equal(suggest('SE').start,0);
});
