import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
const names=execFileSync('git',['diff','--cached','--name-only','--diff-filter=ACMR','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/sk-[A-Za-z0-9_-]{16,}/,/gh[pousr]_[A-Za-z0-9_]{20,}/,/github_pat_[A-Za-z0-9_]+/,/-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/];
const configured=[];
if(existsSync('fox-voice/.dev.vars'))for(const line of readFileSync('fox-voice/.dev.vars','utf8').split('\n')){
 const split=line.indexOf('=');if(split<0)continue;
 const name=line.slice(0,split),value=line.slice(split+1).trim();
 if(/KEY|TOKEN|SECRET|PASSWORD/i.test(name)&&value.length>8)configured.push(value);
}
const failures=[];
for(const name of names){
 const sample=/\.(?:env|dev\.vars)\.example$/.test(name);
 if(!sample&&(/(^|\/)(?:\.env[^/]*|\.dev\.vars[^/]*|node_modules)(\/|$)/.test(name)||name==='voice-bridge/tts-config.json')){failures.push(name);continue;}
 const content=execFileSync('git',['show',`:${name}`],{maxBuffer:100*1024*1024}).toString('utf8');
 if(patterns.some(pattern=>pattern.test(content))||configured.some(value=>content.includes(value)))failures.push(name);
}
if(failures.length){console.error('提交已停止：这些文件可能包含密钥、私有配置或依赖：\n'+[...new Set(failures)].join('\n'));process.exit(1);}
console.log(`提交检查通过：${names.length} 个文件，未发现匹配的密钥或私有配置。`);
