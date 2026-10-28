// Exit status only; do not print response bodies or database paths into health logs.
fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(3500),cache:'no-store'})
 .then(async r=>{if(r.status!==200||(await r.json()).status!=='ok')process.exitCode=1;})
 .catch(()=>{process.exitCode=1;});
