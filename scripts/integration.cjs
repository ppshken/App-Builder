// Always use a fresh, isolated SQLite database. Never run tests against data.db.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
async function main() {
  fs.mkdirSync('.test-data', { recursive: true });
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const runFolder=fs.mkdtempSync(path.resolve('.test-data','run-'));
  const dbPath = path.join(runFolder, `integration-${Date.now()}.db`);
  let webhookServer,webhookUrl='';
  if(process.argv[2]==='workflows'){const requests=[],http=require('node:http');webhookServer=http.createServer(async(req,res)=>{if(req.url==='/stats'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(requests));return;}let body='';for await(const chunk of req)body+=chunk;requests.push({url:req.url,key:req.headers['idempotency-key'],payload:JSON.parse(body||'{}')});res.setHeader('Content-Type','application/json');if(req.url==='/flaky'&&requests.filter(r=>r.url==='/flaky').length===1){res.statusCode=503;res.end(JSON.stringify({error:'test failure'}));return;}res.end(JSON.stringify({result:{reference:'EXT-001',status:'รับข้อมูลแล้ว'}}));});await new Promise(resolve=>webhookServer.listen(0,'127.0.0.1',resolve));webhookUrl='http://127.0.0.1:'+webhookServer.address().port;}
  const env = { ...process.env, NOCODE_BUILD_DIR: '.next-tests', NOCODE_DB_PATH: dbPath, NEXT_TELEMETRY_DISABLED: '1', NOCODE_TEST_PORT: String(port), NOCODE_TEST_URL: `http://127.0.0.1:${port}`, NOCODE_TEST_DB: dbPath,...(webhookUrl?{NOCODE_WEBHOOK_ORIGINS:webhookUrl,NOCODE_TEST_WEBHOOK_URL:webhookUrl}:{}) };
  const server = spawn(process.execPath, ['scripts/test-server.cjs'], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = ''; server.stdout.on('data', b => { output += b; }); server.stderr.on('data', b => { output += b; });
  try {
    const deadline = Date.now() + 90000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(output);
      try { const r = await fetch(`${env.NOCODE_TEST_URL}/api/auth/session`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error('Test server did not start\n' + output);
    if(process.argv[2]!=="auth") {
      const response=await fetch(env.NOCODE_TEST_URL+"/api/auth/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Test Owner",email:"a@example.com",password:"TestPassword123"})});
      if(!response.ok)throw Error(await response.text());
      env.NOCODE_TEST_COOKIE=response.headers.get("set-cookie").split(";")[0];
      env.NOCODE_TEST_EMAIL="a@example.com";
    }
    console.log(`Testing isolated database: ${dbPath}`);
    const browserTests = { workflows:"tests/workflows-browser.cjs", attachments:"tests/attachment-types-browser.cjs", automationapi:"tests/automation-api.test.cjs", resetedit:"tests/reset-on-edit-browser.cjs", formulaeditor:"tests/formula-editor-browser.cjs", pendingchildren:"tests/pending-child-choices-browser.cjs", refvalidif:"tests/ref-valid-if-api.cjs", childform:"tests/child-form-layout-browser.cjs", audit:"tests/audit-log-browser.cjs", exceltext:"tests/excel-text-import.cjs", inlinevisual:"tests/inline-visual-browser.cjs", partinline:"tests/part-inline-consistency-browser.cjs", partof:"tests/part-of-browser.cjs", expressionfunctions:"tests/expression-functions-browser.cjs", formulaguide:"tests/formula-guide-browser.cjs", cleartable:"tests/clear-table-browser.cjs", performance:"tests/performance-browser.cjs", pagestack:"tests/runtime-page-stack-browser.cjs", decoration:"tests/data-decoration-browser.cjs", viewnames:"tests/view-names-browser.cjs", longtext:"tests/longtext-browser.cjs", selectall:"tests/enumlist-select-all-browser.cjs", enumvalidif:"tests/enum-valid-if-browser.cjs", rolesession:"tests/role-session-browser.cjs", fontweight:"tests/font-weight-browser.cjs", closedetails:"tests/close-details-browser.cjs", backstate:"tests/back-state-browser.cjs", formsave:"tests/form-save-browser.cjs", imagelabels:"tests/image-labels-browser.cjs", location:"tests/location-browser.cjs", specialviews:"tests/special-views-browser.cjs", livepreview:"tests/live-preview-browser.cjs", rawdata:"tests/raw-data-browser.cjs", appmedia:"tests/app-media-browser.cjs", loginflash:"tests/login-theme-browser.cjs", actiontargets:"tests/action-targets-browser.cjs", upgrades: "tests/upgrades-browser.cjs", userformulas: "tests/user-formulas-browser.cjs", permissions: "tests/permissions-browser.cjs", auth: "tests/auth-browser.cjs", cache: "tests/runtime-cache-browser.cjs", systemid: "tests/system-id-browser.cjs", identity: "tests/key-identity-browser.cjs", dropdown: "tests/dropdown-browser.cjs", grid: "tests/grid-browser.cjs", sharedloading: "tests/shared-loading-browser.cjs", smooth: "tests/smooth-browser.cjs", refresh: "tests/view-refresh-browser.cjs", filters: "tests/filter-browser.cjs", unique: "tests/unique-browser.cjs", conversion: "tests/conversion-browser.cjs", safety: "tests/safety-browser.cjs", defaults: "tests/defaults-browser.cjs", detaildesign: "tests/detail-design-browser.cjs", navigation: 'tests/navigation-browser.cjs', browser: 'tests/browser.cjs', features: 'tests/features-browser.cjs', designer: 'tests/designer-browser.cjs', automation: 'tests/automation-browser.cjs', builder: 'tests/builder-browser.cjs', media: 'tests/media-browser.cjs', select: 'tests/select-browser.cjs', ref: 'tests/ref-browser.cjs', viewpages: 'tests/view-pages-browser.cjs', layouts: 'tests/view-layouts-browser.cjs', events: 'tests/view-events-browser.cjs', appearance: 'tests/appearance-browser.cjs', lists: 'tests/lists-browser.cjs', inline: 'tests/inline-browser.cjs' };
    const args = browserTests[process.argv[2]] ? [browserTests[process.argv[2]]] : ['--test', 'tests/api.test.cjs', 'tests/lists-api.test.cjs', 'tests/inline-api.test.cjs', 'tests/features-api.test.cjs', 'tests/automation-api.test.cjs', 'tests/settings-api.test.cjs', 'tests/media-api.test.cjs', 'tests/select-api.test.cjs', 'tests/ref-api.test.cjs', 'tests/view-options-api.test.cjs', 'tests/view-display-api.test.cjs', 'tests/view-events-api.test.cjs'];
    const runner = spawn(process.execPath, env.NOCODE_TEST_COOKIE ? ["--require", "./scripts/auth-test-preload.cjs", ...args] : args, { env, stdio: 'inherit', windowsHide: true });
    const code = await new Promise(resolve => runner.on('exit', resolve));
    if (code !== 0) console.error(output);
    process.exitCode = code === null ? 1 : code;
  } finally {
    webhookServer?.close();
    server.kill('SIGTERM');
    server.stdout.destroy(); server.stderr.destroy();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
