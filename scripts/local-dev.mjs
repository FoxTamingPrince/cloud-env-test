import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2]||'all';
if(!['all','voice','live2d'].includes(mode)) throw Error('Use all, voice or live2d.');
let child,server,closing=false;
function close(code=0){if(closing)return;closing=true;child?.kill('SIGTERM');server?.close();setTimeout(()=>process.exit(code),800).unref();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>close());
if(mode!=='live2d'){
 const cli=path.join(root,'fox-voice/scripts/run-framework.mjs');
 child=spawn(process.execPath,[cli,'dev','--port',process.env.FOX_WEB_PORT||'5194'],{cwd:path.join(root,'fox-voice'),stdio:'inherit'});
 child.on('error',e=>{console.error(e.message);close(1);});
 child.on('exit',code=>{if(!closing)close(code||0);});
 console.log(`小狐狸网页：http://127.0.0.1:${process.env.FOX_WEB_PORT||5194}/`);
}
if(mode!=='voice'){
 const pub=path.join(root,'fox-live2d-runtime-work/public');
 const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.vert':'text/plain','.frag':'text/plain','.moc3':'application/octet-stream'};
 server=createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const full=path.resolve(pub,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
   if(!full.startsWith(pub+path.sep)) {res.writeHead(403).end();return;}
   const info=await stat(full);if(!info.isFile())throw Error();
   res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   createReadStream(full).pipe(res);
  }catch{res.writeHead(404).end('Not found');}
 });
 const port=Number(process.env.FOX_MODEL_PORT||5195);
 server.on('error',e=>{console.error(e.message);close(1);});
 server.listen(port,'127.0.0.1',()=>console.log(`狐狸动作预览：http://127.0.0.1:${port}/review.html`));
}
