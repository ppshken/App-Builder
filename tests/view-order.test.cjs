const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {reorderViews}=require('../.test-build/view-order');
test('navigation draft moves immediately without mutating saved positions and can be reset',()=>{
 const {withViewDraft,viewCategory}=require('../.test-build/views');const original=[{name:'b',label:'B',position:'primary',pos:2},{name:'a',label:'A',position:'primary',pos:1}],before=JSON.stringify(original),draft={...original[0],position:'menu',menu_group:'Work',pos:0};
 const preview=withViewDraft(original,draft);assert.deepEqual(preview.map(v=>v.name),['b','a']);assert.equal(preview.filter(v=>v.position==='menu')[0].menu_group,'Work');assert.equal(preview.filter(v=>v.position==='primary').length,1);assert.equal(JSON.stringify(original),before);
 assert.equal(withViewDraft(original,null).filter(v=>v.position==='primary').length,2);assert.equal(withViewDraft(original,{...draft,name:'new'}).length,3);assert.equal(withViewDraft(original,draft).filter(v=>v.name==='b').length,1);
 assert.equal(viewCategory(withViewDraft(original,{...draft,system_generated:0,position:'ref'})[0]),'ref');
});
test('menu reorder writes contiguous positions atomically and rejects stale, duplicate and cross-scope requests',()=>{
 const db=new Database(':memory:');try{db.exec("CREATE TABLE _views(name TEXT PRIMARY KEY,pos INTEGER,menu_group TEXT,position TEXT);INSERT INTO _views VALUES('first',10,'A','menu'),('second',20,'A','menu'),('other',30,'B','menu'),('home',77,NULL,'primary')");
 const base=db.prepare("SELECT name,pos,menu_group FROM _views WHERE position='menu' ORDER BY pos,name").all();
 for(const names of [['first','first','other'],['first','other'],['first','second','home']])assert.throws(()=>reorderViews(db,{position:'menu',names,base}));
 assert.equal(db.prepare("SELECT pos FROM _views WHERE name='first'").get().pos,10);
 assert.deepEqual(reorderViews(db,{position:'menu',names:['other','second','first'],base}),{updated:3});
 assert.deepEqual(db.prepare("SELECT name,pos FROM _views WHERE position='menu' ORDER BY pos").all(),[{name:'other',pos:1},{name:'second',pos:2},{name:'first',pos:3}]);
 assert.equal(db.prepare("SELECT pos FROM _views WHERE name='home'").get().pos,77);
 assert.throws(()=>reorderViews(db,{position:'menu',names:['first','second','other'],base}),e=>e.status===409);
 assert.equal(db.prepare("SELECT menu_group FROM _views WHERE name='first'").get().menu_group,'A');
 }finally{db.close();}
});
