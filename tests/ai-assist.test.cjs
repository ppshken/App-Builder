const test = require('node:test');
const assert = require('node:assert/strict');
const { AiQuotaError, aiFormulaMeasurement, aiSettingLinks, geminiProvider, openAiProvider, parseAiSuggestion, validateAiFormula } = require('../.test-build/ai-assist');
const { blankColumn } = require('../.test-build/columns');

test('Text to User accepts unused blank options but rejects a Ref destination or manual choices', () => {
  const {aiDataDesign} = require('../.test-build/ai-data-design');
  const names=new Set(['repairs']),editable=new Map([['repairs',new Set(['technician'])]]);
  const conversion={table:'repairs',column:'technician',type:'user',ref:null,options:''};
  assert.deepEqual(aiDataDesign({tables:[],conversion},names,names,editable),
    {tables:[],conversion:{table:'repairs',column:'technician',type:'user',ref:null}});
  assert.equal(aiDataDesign({tables:[],conversion:{...conversion,ref:'users'}},names,names,editable),null);
  assert.equal(aiDataDesign({tables:[],conversion:{...conversion,options:'Alice'}},names,names,editable),null);
});

test('AI relationships distinguish multiple stored Ref paths and omit inaccessible parents', () => {
  const {aiRelationships} = require('../.test-build/ai-context');
  const columns = [
    {...blankColumn(),name:'origin',type:'ref',ref_table:'sites'},
    {...blankColumn(),name:'destination',type:'ref',ref_table:'sites'},
    {...blankColumn(),name:'computed',type:'ref',ref_table:'sites',is_virtual:1},
    {...blankColumn(),name:'secret',type:'ref',ref_table:'private_sites'},
  ];
  assert.deepEqual(aiRelationships([{name:'jobs',columns}],new Set(['sites'])),[
    {childTable:'jobs',refColumn:'origin',parentTable:'sites',sameParentRefCount:2},
    {childTable:'jobs',refColumn:'destination',parentTable:'sites',sameParentRefCount:2},
  ]);
});

test('AI discovers readable child tables for an explicitly named parent', () => {
  const {selectAiContext,aiContextTerms} = require('../.test-build/ai-context');
  const catalogue = [...Array.from({length:25},(_,i)=>({name:'table_'+i,label:'Table '+i})),
    {name:'repairs',label:'Repairs'},{name:'repair_parts',label:'Repair parts'}];
  const {tables} = selectAiContext(catalogue,name=>name==='repair_parts'
    ? [{...blankColumn(),name:'repair_id',type:'ref',ref_table:'repairs'}] : [], aiContextTerms('Explain repairs'));
  assert.deepEqual(tables.slice(0,2).map(table=>table.name),['repairs','repair_parts']);
  assert.equal(tables.length,20);
});

test('AI follows accessible Ref destinations when a table is explicitly named', () => {
  const {selectAiContext,aiContextTerms} = require('../.test-build/ai-context');
  const catalogue = [...Array.from({length:25},(_,i)=>({name:'table_'+i,label:'Table '+i})),
    {name:'repairs',label:'Repairs'},{name:'repair_status',label:'Repair status'}];
  const reads=[];
  const {tables} = selectAiContext(catalogue,name=>{
    reads.push(name);
    return name==='repairs' ? [
      {...blankColumn(),name:'status_id',type:'ref',ref_table:'repair_status'},
      {...blankColumn(),name:'private_id',type:'ref',ref_table:'private_status'},
    ] : [];
  },aiContextTerms('Explain repairs'));
  assert.deepEqual(tables.slice(0,2).map(table=>table.name),['repairs','repair_status']);
  assert.ok(!reads.includes('private_status'));
  assert.equal(tables.length,20);
});

test('AI loads more columns for a directly named table while bounding other context', () => {
  const {selectAiContext,aiContextTerms} = require('../.test-build/ai-context');
  const catalogue = [{name:'repairs',label:'Repairs'},{name:'parts',label:'Parts'}];
  const columns = Array.from({length:120},(_,i)=>({...blankColumn(),name:'field_'+i,label:'Field '+i}));
  const {tables,coverage} = selectAiContext(catalogue,()=>columns,aiContextTerms('Explain repairs'));
  assert.equal(tables.find(table=>table.name==='repairs').selectedColumns.length,100);
  assert.equal(tables.find(table=>table.name==='parts').selectedColumns.length,30);
  assert.equal(coverage.columnsIncluded,130);
  assert.equal(coverage.columnsAvailableInSelectedTables,240);
});

test('AI appends choice additions to the latest static options and keeps their order', () => {
  const {updateAiEnumOptions} = require('../.test-build/ai-data-design');
  const source = {type:'enumlist',options:'Waiting,On hold,Done'};
  assert.equal(updateAiEnumOptions(source,[' Done ','Waiting for parts']), 'Waiting,On hold,Done,Waiting for parts');
  assert.equal(updateAiEnumOptions({...source,ref_table:'statuses'},['New']),null);
  assert.equal(updateAiEnumOptions(source,['New,Done']),null);
  assert.equal(updateAiEnumOptions(source,[null]),null);
  assert.equal(updateAiEnumOptions(source,undefined,[' On hold ','Unknown']),'Waiting,Done');
  assert.equal(updateAiEnumOptions(source,undefined,['Unknown']),source.options);
  assert.equal(updateAiEnumOptions(source,undefined,['Waiting','On hold','Done']),null);
  assert.equal(updateAiEnumOptions(source,['Parts'],[' On hold ']),'Waiting,Done,Parts');
  assert.equal(updateAiEnumOptions(source,[' Parts '],['Parts']),null);
});

test('AI recognizes Enum option changes without requiring a new type', () => {
  const {aiConversionChangesColumn} = require('../.test-build/ai-data-design');
  const source = {type:'enum',options:'Waiting,Done'};
  const target = {table:'repairs',column:'status',type:'enum',ref:null};
  assert.equal(aiConversionChangesColumn(source,target),false);
  assert.equal(aiConversionChangesColumn(source,{...target,options:'Waiting, Done, Waiting'}),false);
  assert.equal(aiConversionChangesColumn(source,{...target,options:'Waiting,Working,Done'}),true);
  assert.equal(aiConversionChangesColumn(source,{...target,options:'Done,Waiting'}),true);
});

test('AI stages a view and Text-to-Enum conversion with the requested choices', () => {
  const {splitAiConversionPlan} = require('../.test-build/ai-data-design');
  const visible = new Set(['repair_requests']);
  const editable = new Map([['repair_requests',new Set(['status'])]]);
  const first = {tables:[],views:[{table:'repair_requests',label:'Repair requests',kind:'table'}]};
  const conversion = {table:'repair_requests',column:'status',type:'enum',ref:null,options:'New,Closed'};
  assert.deepEqual(splitAiConversionPlan({...first,conversion},visible,visible,editable),{first,next:conversion});
  assert.equal(splitAiConversionPlan({...first,conversion:{...conversion,ref:'other'}},visible,visible,editable),null);
  assert.equal(splitAiConversionPlan({...first,conversion,actions:[{table:'repair_requests',name:'close',label:'Close',
    updates:[{column:'status',formula:'"Closed"'}]}]},visible,visible,editable),null);
});

test('AI stages a new Ref target before converting an existing column', () => {
  const {splitAiConversionPlan,aiDataDesign,aiConversionStageConflict} = require('../.test-build/ai-data-design');
  const existing = new Set(['repair_requests']);
  const editable = new Map([['repair_requests',new Set(['status'])]]);
  const proposal = {
    tables:[{name:'repair_status',label:'Repair status',columns:[{name:'title',label:'Title',type:'text',required:false,ref:null}]}],
    conversion:{table:'repair_requests',column:'status',type:'ref',ref:'repair_status'},
  };
  assert.equal(aiDataDesign(proposal,existing,existing,editable),null);
  assert.deepEqual(splitAiConversionPlan(proposal,existing,existing,editable),{first:{tables:proposal.tables},next:proposal.conversion});
  assert.equal(splitAiConversionPlan(proposal,existing,existing,new Map()),null);
  assert.equal(splitAiConversionPlan({...proposal,conversion:{...proposal.conversion,ref:'other'}},existing,existing,editable),null);
  const views = [{table:'repair_status',label:'Statuses',kind:'table'}];
  const actions = [{table:'repair_status',name:'mark_active',label:'Mark active',condition:'TRUE',updates:[{column:'title',formula:'"Active"'}]}];
  assert.deepEqual(splitAiConversionPlan({...proposal,views,actions},existing,existing,editable),
    {first:{tables:proposal.tables,views,actions},next:proposal.conversion});
  assert.equal(splitAiConversionPlan({...proposal,views:[{...views[0],table:'hidden'}]},existing,existing,editable),null);
  const visible = new Set([...existing,'repair_status']);
  const reuse = {...proposal,tables:[],views};
  assert.deepEqual(splitAiConversionPlan(reuse,visible,visible,editable),
    {first:{tables:[],views},next:proposal.conversion});
  assert.equal(splitAiConversionPlan({...reuse,views:[]},visible,visible,editable),null);
  const editsStatus = {...actions[0],table:'repair_requests',updates:[{column:'status',formula:'1'}]};
  assert.equal(aiConversionStageConflict({...reuse,actions:[editsStatus]}),true);
  assert.equal(aiConversionStageConflict({...reuse,actions}),false);
  assert.equal(aiConversionStageConflict({...reuse,actions:[null]}),false);
  assert.equal(splitAiConversionPlan({...reuse,actions:[editsStatus]},visible,visible,editable),null);
  assert.equal(splitAiConversionPlan({...reuse,changes:[{kind:'edit_default',table:'repair_requests',column:'status',formula:'1'}]},
    visible,visible,editable),null);
});

test('AI follow-up prioritizes current entities then restores relevant history from the app catalogue', () => {
  const {aiContextTerms,selectAiContext} = require('../.test-build/ai-context');
  const catalogue = [...Array.from({length:25},(_,i)=>({name:'table_'+i,label:'Table '+i})),
    {name:'repair_requests',label:'Repair requests'},{name:'repair_status',label:'Repair status'}];
  const mentions = aiContextTerms('Repair status', '', 'Use repair_requests and a hidden_table');
  const {tables} = selectAiContext(catalogue,()=>[],mentions);
  assert.deepEqual(tables.slice(0,2).map(table=>table.name),['repair_status','repair_requests']);
  assert.ok(!tables.some(table=>table.name==='hidden_table'));
});

test('AI resolves displayed names only when unique and prefers an exact internal name', () => {
  const {ambiguousAiNames,resolveAiName} = require('../.test-build/ai-context');
  const tables = [{name:'repair_status',label:'สถานะแจ้งซ่อม'},{name:'request_status',label:'สถานะ'}];
  assert.equal(resolveAiName('สถานะแจ้งซ่อม',tables),'repair_status');
  const duplicates = [...tables,{name:'other_status',label:'สถานะแจ้งซ่อม'}];
  assert.equal(resolveAiName('สถานะแจ้งซ่อม',duplicates),undefined);
  assert.equal(resolveAiName('repair_status',duplicates),'repair_status');
  assert.deepEqual(ambiguousAiNames('สถานะแจ้งซ่อม',duplicates).map(table=>table.name),['repair_status','other_status']);
  assert.deepEqual(ambiguousAiNames('repair_status',duplicates),[]);
  assert.deepEqual(ambiguousAiNames('unknown',duplicates),[]);
});

test('AI prioritizes selected and named late columns, includes accessible Ref targets, and reports truncation', () => {
  const {aiContextTerms,selectAiContext} = require('../.test-build/ai-context');
  const catalogue = [...Array.from({length:25},(_,i)=>({name:'table_'+i,label:'Table '+i})),
    {name:'inspection',label:'ตรวจสภาพ'},{name:'vehicles',label:'รถ'},{name:'car',label:'Car'}];
  const columns = Array.from({length:70},(_,i)=>({...blankColumn(),name:'field_'+i,label:'Field '+i}));
  columns[69]={...columns[69],name:'vehicle_id',label:'ทะเบียนรถ',type:'ref',ref_table:'vehicles'};
  columns[68]={...columns[68],name:'private_id',ref_table:'private_table'};
  const reads=[];
  const {tables,coverage}=selectAiContext(catalogue,name=>{reads.push(name);return name==='inspection'?columns:[];},
    aiContextTerms('แก้สูตรของทะเบียนรถ ในตารางตรวจสภาพ','[private_id]'), {table:'inspection',column:'field_67'});
  assert.equal(tables[0].name,'inspection');
  assert.equal(tables[0].selectedColumns[0].name,'field_67');
  assert.ok(tables[0].selectedColumns.some(column=>column.name==='vehicle_id'));
  assert.equal(tables[1].name,'vehicles');
  assert.ok(!reads.includes('private_table'));
  assert.equal(reads.length,catalogue.length);
  assert.equal(new Set(reads).size,reads.length);
  assert.deepEqual(coverage,{tablesIncluded:20,tablesAvailable:28,columnsIncluded:30,columnsAvailableInSelectedTables:70});
  assert.equal(aiContextTerms('car_model')({name:'car',label:'Car'}),0);
});

test('schema commands start a design and a missing plan never reports a completed change', () => {
  const {isAiSchemaRequest,aiDataDesignStatus} = require('../.test-build/ai-data-design');
  assert.equal(isAiSchemaRequest('สร้างตาราง repair_requests ชื่อ ใบแจ้งซ่อม'),true);
  assert.equal(isAiSchemaRequest('ในตาราง inspection ตั้ง Valid_If ของคอลัมน์ mile'),true);
  assert.equal(isAiSchemaRequest('Please add column notes to orders'),true);
  assert.equal(isAiSchemaRequest('สร้าง View รายการอะไหล่'),true);
  assert.equal(isAiSchemaRequest('สร้าง Action รับงาน'),true);
  assert.equal(isAiSchemaRequest('คอลัมน์ Ref ใช้ยังไง'),false);
  assert.equal(isAiSchemaRequest('How do I create a table?'),false);
  assert.match(aiDataDesignStatus(false,true,false),/ยังไม่ได้แผน/);
  assert.match(aiDataDesignStatus(true,false,false),/เปิดพื้นที่พัฒนาโครงสร้าง/);
  assert.match(aiDataDesignStatus(true,true,false),/กดยืนยัน/);
});

test('schema proposals validate Ref targets, reserved names, and supported types', () => {
  const { aiDataDesign } = require('../.test-build/ai-data-design');
  const design={tables:[
    {name:'orders',label:'Orders',columns:[{name:'customer',label:'Customer',type:'ref',required:true,ref:'customers'}]},
    {name:'order_items',label:'Lines',columns:[{name:'order',label:'Order',type:'ref',required:true,ref:'orders'}]},
  ]};
  const existing=new Set(['customers','private_data']),visible=new Set(['customers']);
  assert.deepEqual(aiDataDesign(design,existing,visible),design);
  const view={label:'Order list',table:'orders',kind:'list'};
  assert.deepEqual(aiDataDesign({...design,views:[view]},existing,visible)?.views,[view]);
  assert.equal(aiDataDesign({tables:[],views:[{...view,table:'private_data'}]},existing,visible),null);
  const action={name:'score',label:'Score',table:'orders',condition:'TRUE',updates:[{column:'customer',formula:'1'}]};
  assert.deepEqual(aiDataDesign({...design,actions:[action]},existing,visible)?.actions,[action]);
  assert.equal(aiDataDesign({tables:[],actions:[{...action,table:'customers'}]},existing,visible),null);
  assert.equal(aiDataDesign({...design,actions:[{...action,updates:[{column:'id',formula:'1'}]}]},existing,visible),null);
  for(const patch of [{ref:'private_data'},{ref:'missing'},{name:'id'},{type:'constructor'}]){
    const changed=structuredClone(design);Object.assign(changed.tables[0].columns[0],patch);
    assert.equal(aiDataDesign(changed,existing,visible),null);
  }
  const collision=structuredClone(design);collision.tables[0].name='customers';
  assert.equal(aiDataDesign(collision,existing,visible),null);
  const calculated=structuredClone(design);
  Object.assign(calculated.tables[0].columns[0],{required:false,formula:' [id] '});
  assert.equal(aiDataDesign(calculated,existing,visible).tables[0].columns[0].formula,'[id]');
  calculated.tables[0].columns[0].required=true;
  assert.equal(aiDataDesign(calculated,existing,visible),null);
});

test('AI Automation drafts accept only supported events and one existing Action identifier', async () => {
  const raw = { label: ' Check ', table: 'inspection', event: 'update', action: 'set_status', enabled: true };
  const provider = geminiProvider('test', 'test-model', async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(JSON.parse(body.messages.at(-1).content).mode, 'automation_draft');
    assert.match(body.messages.at(-2).content, /automationActions/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ answer: 'Draft', formula: null, automationDraft: raw }) } }] });
  });
  const result = await provider({ question: 'Draft', context: {}, formula: false, automationDraft: true }, new AbortController().signal);
  assert.deepEqual(result.automationDraft, { label: 'Check', table: 'inspection', event: 'update', action: 'set_status' });
  const parse = input => parseAiSuggestion({ answer: 'Draft', formula: null, automationDraft: input }).automationDraft;
  assert.equal(parse({ ...raw, event: 'schedule' }), null);
  assert.equal(parse({ ...raw, action: 'https://example.test' }), null);
});

test('schema edits require an owned table and retain only the allowed fields', () => {
  const { aiDataDesign } = require('../.test-build/ai-data-design');
  const existing = new Set(['orders','shared']);
  const editable = new Map([['orders',new Set(['title'])]]);
  const changes = [
    {kind:'rename_label',table:'orders',column:'title',label:' New title '},
    {kind:'set_label',table:'orders',column:'title'},
    {kind:'add_column',table:'orders',column:{name:'source',label:'Source',type:'ref',required:false,ref:'shared',is_key:true}},
  ];
  const normalize = edits => aiDataDesign({tables:[],changes:edits},existing,existing,editable);
  const plan = normalize(changes);
  assert.equal(plan.changes[0].label,'New title');
  assert.equal(plan.changes[2].column.is_key,undefined);
  assert.equal(normalize([{...changes[0],table:'shared'}]),null);
  assert.equal(normalize([{...changes[0],kind:'change_type'}]),null);
  assert.equal(normalize([{...changes[2],column:{...changes[2].column,required:true}}]),null);
  const validation={kind:'edit_validation',table:'orders',column:'title',formula:'ISNOTBLANK([_THIS])'};
  assert.equal(normalize([validation]).changes[0].message,undefined);
  assert.equal(normalize([{...validation,message:''}]).changes[0].message,'');
  assert.equal(normalize([{...validation,message:'x'.repeat(1001)}]),null);
  assert.equal(normalize([{...validation,kind:'edit_required_if',formula:'[qty] > 0'}]).changes[0].kind,'edit_required_if');
  assert.equal(normalize([{...validation,kind:'edit_required_if',formula:''}]).changes[0].formula,'');
  assert.equal(normalize([{...validation,kind:'edit_formula',formula:''}]),null);
  assert.equal(normalize([{...validation,kind:'edit_required_if',formula:' '}]),null);
  const conversion={table:'orders',column:'title',type:'ref',ref:'shared'};
  assert.deepEqual(aiDataDesign({tables:[],conversion},existing,existing,editable),{tables:[],conversion});
  assert.equal(aiDataDesign({tables:[],conversion,changes},existing,existing,editable),null);
  assert.equal(aiDataDesign({tables:[],conversion},existing,new Set(['orders']),editable),null);
});

test('Copilot retains bounded recent conversation context as plain text', () => {
  const { aiConversation } = require('../.test-build/ai-assist');
  const history = Array.from({length: 5}, (_, i) => ({ question: String(i), answer: 'a'.repeat(1300), role: 'system' }));
  const normalized = aiConversation(history);
  assert.deepEqual(normalized.map(turn => turn.question), ['1', '2', '3', '4']);
  assert.equal(normalized[0].answer.length, 1200);
  assert.equal(normalized[0].role, undefined);
  assert.deepEqual(aiConversation([null, {question: 'x', answer: {}}]), []);
});

test('AI View drafts accept only a label, table and supported display type', () => {
  const parse = viewDraft => parseAiSuggestion({ answer: 'Draft', formula: null, viewDraft }).viewDraft;
  assert.deepEqual(parse({ label: ' Pending ', table: 'inspection', kind: 'list', position: 'primary', show_if: 'TRUE' }),
    { label: 'Pending', table: 'inspection', kind: 'list' });
  assert.equal(parse({ label: 'Pending', table: 'inspection', kind: 'form' }), null);
  assert.equal(parse({ label: 'Pending', table: '../other', kind: 'table' }), null);
  assert.equal(parse({ label: ' '.repeat(6), table: 'inspection', kind: 'table' }), null);
});

test('AI settings links resolve only server-known identifiers to encoded internal routes', () => {
  const suggestion = parseAiSuggestion({ answer: 'Check settings', formula: null,
    references: ['setting_0', 'setting_0', '/api/users', 'setting_900', 'setting_1', 'setting_2'] });
  const links = aiSettingLinks(suggestion.references, [
    { kind: 'column', table: 'inspection', name: 'status&app=other', label: 'Status' },
    { kind: 'slice', table: 'inspection', name: 'pending', label: 'Pending' },
    { kind: 'action', table: 'inspection', name: 'complete', label: 'Complete' },
  ]);
  assert.deepEqual(links.map(link => link.href), [
    '/t/inspection/edit?column=status%26app%3Dother', '/slices?name=pending', '/actions?name=complete',
  ]);
});

test('AI measurement includes only numeric metrics, permitted tables and generic failure status', () => {
  assert.deepEqual(aiFormulaMeasurement({
    loadMs: 12.5, totalMs: Infinity, calculationFailed: true, error: 'private', value: 'private',
    reads: { rowsLoaded: 120, dataLoads: 2, rowsByTable: { inspection: 100, hidden: 20 }, row: { id: 1 } },
    evaluation: { steps: 30, memoHits: -2, selectRows: 'private' },
  }, new Set(['inspection'])), {
    loadMs: 12.5, reads: { rowsLoaded: 120, dataLoads: 2, rowsByTable: { inspection: 100 } },
    evaluation: { steps: 30 }, calculationFailed: true,
  });
  assert.equal(aiFormulaMeasurement({ reads: { rowsLoaded: '120' } }, new Set()), null);
});

test('AI provider sends only supplied context, disables storage, and forwards the abort signal', async () => {
  const controller = new AbortController();
  const context = { tables: [{ name: 'inspection' }] };
  const provider = openAiProvider('test-key', 'test-model', async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(init.redirect, 'error');
    assert.equal(init.signal, controller.signal);
    assert.equal(body.store, false);
    assert.deepEqual(JSON.parse(body.messages.find(message=>message.role==='user').content), { question: 'example', context, mode: 'formula' });
    return Response.json({ choices: [{ message: { content: '{"answer":"example","formula":"[amount] + 1"}' } }] });
  });
  assert.deepEqual(await provider({ question: 'example', context, formula: true }, controller.signal),
    { answer: 'example', formula: '[amount] + 1' });
});

test('AI provider suppresses upstream error details and rejects malformed output', async () => {
  const provider = openAiProvider('test-key', 'test-model', async () => new Response('private', { status: 500 }));
  await assert.rejects(provider({ question: 'example', context: {}, formula: false }, new AbortController().signal),
    { message: 'AI provider request failed' });
  assert.throws(() => parseAiSuggestion({ answer: 'ok', formula: 1 }));
  assert.throws(() => parseAiSuggestion({ answer: 'ok', formula: 'a'.repeat(4001) }));
  assert.deepEqual(parseAiSuggestion({ answer: ' ok ', formula: null }), { answer: 'ok', formula: null });
});

test('AI formulas reuse syntax, schema, dependency and result type validation', () => {
  const column = { ...blankColumn(), name: 'total', label: 'Total', type: 'number', is_virtual: true };
  const amount = { ...blankColumn(), name: 'amount', label: 'Amount', type: 'number' };
  const columns = [column, amount];
  const check = source => validateAiFormula(source, column, 'virtual_expr', 'inspection', columns, []);
  assert.equal(check('[amount] + 1'), null);
  assert.ok(check('[missing] + 1'));
  assert.ok(check('SUM(private_table[amount])'));
  assert.ok(check('[total] + 1'));
  assert.ok(check('"wrong type"'));
});

test('AI provider distinguishes exhausted credits from request throttling', async () => {
  for (const code of ['credit_balance_exhausted', 'rate_limit_exceeded']) {
    const provider = openAiProvider('test-key', 'test-model', async () =>
      Response.json({ error: { code } }, { status: 429 }));
    await assert.rejects(provider({ question: 'example', context: {}, formula: false }, new AbortController().signal),
      err => code === 'credit_balance_exhausted' ? err instanceof AiQuotaError : err.message === 'AI provider request failed');
  }
});

test('Gemini sends structured output requests to Google and shares the existing response parser', async () => {
  const provider = geminiProvider('gemini-test-key', 'gemini-3.1-flash-lite', async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer gemini-test-key');
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'gemini-3.1-flash-lite');
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.store, undefined);
    return Response.json({ choices: [{ message: { content: '{"answer":"ok","formula":null}' } }] });
  });
  const signal = new AbortController().signal;
  const request = { question: 'example', context: {}, formula: false };
  assert.deepEqual(await provider(request, signal), { answer: 'ok', formula: null });
  const limited = geminiProvider('gemini-test-key', 'gemini-3.1-flash-lite', async () => new Response(null, { status: 429 }));
  await assert.rejects(limited(request, signal), AiQuotaError);
});
