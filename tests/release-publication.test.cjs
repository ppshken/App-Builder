const {test}=require('node:test'),assert=require('node:assert/strict');
const {publicationBlockers}=require('../.test-build/release-publication-policy');
const base={_tables:[{name:'orders',owner_app_id:'app',source_kind:'INTERNAL_DATABASE'}],_columns:[{id:1,table_name:'orders',name:'title',type:'text'}]};
const plan=ops=>({appId:'app',operations:ops,conflicts:[],summary:{liveChanged:false},blockers:[]});
test('schema publication requires explicit server opt-in',()=>{
 const {schemaPublicationEnabled}=require('../.test-build/release-publication-policy');
 for(const value of ['', '0','true','yes',' 1 '])assert.equal(schemaPublicationEnabled(value),false);
 assert.equal(schemaPublicationEnabled('1'),true);
});
test('publication supports owned save conditions and automatic role policy without bypassing shared boundaries',()=>{
 const next=structuredClone(base);next._columns[0].required=1;next._columns[0].valid_if='TRUE';
 const update={id:'_columns:1',kind:'update_configuration',category:'configuration',table:'orders',name:'title',fields:['required','valid_if','default_expr']};
 assert.deepEqual(publicationBlockers(plan([update]),base,next,[],0),[]);
 assert.ok(publicationBlockers(plan([update]),base,next,['orders'],0).length);
 const table={id:'_tables:new',kind:'create_table',category:'schema',table:'new_table',fields:[]};next._tables.push({name:'new_table',owner_app_id:'app',source_kind:'INTERNAL_DATABASE'});
 assert.deepEqual(publicationBlockers(plan([table]),base,next,[],5),[]);
});
test('publication accepts nullable physical additions, rejects destructive/shared/physical formula changes',()=>{
 const next=structuredClone(base);next._columns.push({id:2,table_name:'orders',name:'memo',type:'text',is_virtual:0});const op={id:'_columns:new',kind:'create_column',category:'schema',table:'orders',name:'memo'};
 assert.deepEqual(publicationBlockers(plan([op]),base,next,[],0),[]);
 next._columns[1].valid_if='TRUE';assert.deepEqual(publicationBlockers(plan([op]),base,next,[],0),[]);next._columns[1].valid_if=null;
 assert.ok(publicationBlockers(plan([op]),base,next,['orders'],0).length);assert.ok(publicationBlockers(plan([{...op,kind:'delete_column'}]),base,next,[],0).length);
 assert.ok(publicationBlockers(plan([{...op,kind:'update_configuration',fields:['auto_number_json']}]),base,next,[],0).length);
});
test('phase five permits owned virtual additions and formula edits but never physical conversion or shared formulas',()=>{
 const next=structuredClone(base);next._columns.push({id:2,table_name:'orders',name:'computed',type:'number',is_virtual:1,virtual_expr:'1 + 2'});
 const create={id:'_columns:new',kind:'create_column',category:'schema',table:'orders',name:'computed',fields:[]};
 assert.deepEqual(publicationBlockers(plan([create]),base,next,[],0),[]);
 const previous=structuredClone(next);previous._columns[1].virtual_expr='1';const edit={...create,id:'_columns:2',kind:'update_configuration',category:'configuration',fields:['virtual_expr']};
 assert.deepEqual(publicationBlockers(plan([edit]),previous,next,[],0),[]);
 assert.ok(publicationBlockers(plan([edit]),previous,next,['orders'],0).length);
 assert.ok(publicationBlockers(plan([{...edit,fields:['virtual_expr','is_part_of']}]),previous,next,[],0).length);
 assert.ok(publicationBlockers(plan([{...edit,kind:'alter_column',category:'schema',fields:['type']}]),previous,next,[],0).length);
 next._tables[0].owner_app_id='other';assert.ok(publicationBlockers(plan([edit]),previous,next,[],0).length);
});
test('automatic role policy is previewed and confirmed by the publication API',()=>{
 const next=structuredClone(base);next._tables.push({name:'new_table',owner_app_id:'app',source_kind:'INTERNAL_DATABASE'});const p=plan([{id:'_tables:new',kind:'create_table',category:'schema',table:'new_table'}]);
 assert.deepEqual(publicationBlockers(p,base,next,[],0),[]);assert.deepEqual(publicationBlockers(p,base,next,[],1),[]);
});
test('publication journal serializes separate connections and fences expired attempts',()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{publicationJournal,claimPublication,assertPublicationLease,finishPublication}=require('../.test-build/publication-journal');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'publish-journal-')),source=path.join(dir,'source.db'),a=publicationJournal(source),b=publicationJournal(source);try{
 const attempt=claimPublication(a,'default','workspace',1,'intent');assert.throws(()=>claimPublication(b,'other','another',2,'next'),/กำลังทำงาน/);assertPublicationLease(b,attempt);
 const {withPublicationArchiveGuard}=require('../.test-build/publication-journal');assert.throws(()=>withPublicationArchiveGuard(source,'default','workspace',()=>{}),/กำลังเผยแพร่/);
 a.prepare('UPDATE attempts SET lease_until=0 WHERE id=?').run(attempt.id);const replacement=claimPublication(b,'default','workspace',1,'intent');assert.throws(()=>assertPublicationLease(a,attempt));finishPublication(a,attempt,'committed');assert.equal(b.prepare('SELECT status FROM attempts WHERE id=?').get(replacement.id).status,'preparing');finishPublication(b,replacement,'failed');assert.equal(withPublicationArchiveGuard(source,'default','workspace',()=>42),42);
 }finally{a.close();b.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('source guards reject restored generations, replaced files and switched connections',()=>{
 const {samePublicationSource}=require('../.test-build/release-publication-policy'),connection={},expected={connection,generation:1,identity:'device:inode'};
 assert.equal(samePublicationSource(expected,{...expected}),true);assert.equal(samePublicationSource(expected,{...expected,generation:2}),false);assert.equal(samePublicationSource(expected,{...expected,identity:'other:inode'}),false);assert.equal(samePublicationSource(expected,{...expected,connection:{}}),false);
});
test('publication revisions detect same/external connection writes, ignore unrelated noise, preserve rollback and reject missing tracking',()=>{
 const fs=require('fs'),path=require('path'),os=require('os'),D=require('better-sqlite3'),{initializeDatabase}=require('../.test-build/schema'),{installReleaseTrackingFor,releaseRevisionStamp,releaseRevisionTriggers}=require('../.test-build/release-data-revisions');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'release-revisions-')),file=path.join(dir,'fixture.db'),a=new D(file);let b;
 try{initializeDatabase(a,file);a.exec('CREATE TABLE t_fixture(id INTEGER PRIMARY KEY,value TEXT);CREATE TABLE noise(value TEXT)');installReleaseTrackingFor(a,'t_fixture');b=new D(file);let stamp=releaseRevisionStamp(a,['fixture']);a.exec("INSERT INTO noise VALUES('irrelevant')");assert.equal(releaseRevisionStamp(a,['fixture']),stamp);a.exec("INSERT INTO t_fixture VALUES(1,'one')");assert.notEqual(releaseRevisionStamp(a,['fixture']),stamp);stamp=releaseRevisionStamp(a,['fixture']);b.exec("UPDATE t_fixture SET value='two'");assert.notEqual(releaseRevisionStamp(a,['fixture']),stamp);stamp=releaseRevisionStamp(a,['fixture']);assert.throws(()=>a.transaction(()=>{a.exec("UPDATE t_fixture SET value='rolled back'");throw Error('rollback');})());assert.equal(releaseRevisionStamp(a,['fixture']),stamp);a.exec('DROP TRIGGER "'+releaseRevisionTriggers('t_fixture')[0].name+'"');assert.throws(()=>releaseRevisionStamp(a,['fixture']),/ติดตาม/);
 }finally{b?.close();a.close();fs.rmSync(dir,{recursive:true,force:true});}
});
