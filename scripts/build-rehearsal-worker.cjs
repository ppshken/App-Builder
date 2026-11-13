const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--target','ES2022','--lib','ES2023,DOM','--module','commonjs','--moduleResolution','node','--esModuleInterop','--skipLibCheck','--strict','--outDir','.rehearsal-worker','lib/rehearsal-worker-entry.ts','lib/publication-validation-worker-entry.ts'],{stdio:'inherit',windowsHide:true});
process.exit(result.status??1);
