const {test}=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
test('AUD-006 unknown integration modes fail before launching a substitute suite',()=>{
 const result=spawnSync(process.execPath,['scripts/integration.cjs','synthetic_invalid_mode'],{cwd:process.cwd(),env:{...process.env,NOCODE_TEST_PRODUCTION:'1'},encoding:'utf8',timeout:90000,windowsHide:true});
 assert.notEqual(result.status,0,'An unknown mode must not silently pass the default API suite');
 assert.match(result.stderr,/Unknown integration mode/);
 assert.doesNotMatch(result.stdout,/Testing isolated database|TAP version/,'Invalid input must fail before opening any test database/server');
});
