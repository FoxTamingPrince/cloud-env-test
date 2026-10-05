import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const pnpm=process.env.FOX_PNPM_BIN||'pnpm';
for(const dir of ['fox-voice','fox-live2d-runtime-work']){
 const r=spawnSync(pnpm,['install','--frozen-lockfile'],{cwd:path.join(root,dir),stdio:'inherit'});
 if(r.error)throw r.error;if(r.status)process.exit(r.status);
}

const git=spawnSync('git',['config','core.hooksPath','.githooks'],{cwd:root,stdio:'inherit'});
if(git.status)process.exit(git.status);
