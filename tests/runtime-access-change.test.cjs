const {test}=require('node:test'),assert=require('node:assert/strict');
const {runtimeAccessInvalidates}=require('../.test-build/access');
const rights={read:true,create:true,update:true,delete:false,export:false};
const access=()=>({owner:true,builder:true,tables:{},actions:['existing'],datasets:{orders:{...rights}}});
test('unrelated additive access changes keep the mounted form and its draft',()=>{
 const before=access(),after=access();after.datasets.other={...rights};after.actions.push('new_action');
 assert.equal(runtimeAccessInvalidates(before,after),false);
 assert.equal(runtimeAccessInvalidates(before,access()),false);
 const member={owner:false,builder:false,tables:{orders:{...rights}},actions:[],datasets:{orders:{...rights}}};
 assert.equal(runtimeAccessInvalidates(member,{...member,tables:{...member.tables,other:{...rights}},datasets:{...member.datasets,other:{...rights}}}),false);
});
test('revoked rights, changed rules, role or boundary still invalidate protected screens',()=>{
 const before=access();
 for(const modify of [a=>delete a.datasets.orders,a=>a.datasets.orders.read=false,a=>a.datasets.orders.update=false,a=>a.actions=[],a=>a.owner=false,a=>a.builder=false,a=>a.rowRules={'orders:read':'FALSE'},a=>a.effectiveRole={name:'new',label:'New'},a=>a.datasets=undefined]){
  const after=access();modify(after);assert.equal(runtimeAccessInvalidates(before,after),true,JSON.stringify(after));
 }
});
