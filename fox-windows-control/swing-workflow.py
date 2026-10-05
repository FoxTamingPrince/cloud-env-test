"""Run a bounded sequential UI workflow through the guarded Swing file protocol."""
import json,base64,pathlib,subprocess,sys
base=pathlib.Path(__file__).resolve().parent
plan=json.loads(pathlib.Path(sys.argv[1]).read_text())
if not isinstance(plan,list) or len(plan)>30:raise ValueError('Workflow must be <=30 steps')
encoded=base64.b64encode(json.dumps(plan,ensure_ascii=False).encode()).decode()
ps=pathlib.Path(base/'swing-workflow-client.ps1').read_text().replace('__PLAN__',encoded)
program=r'''
import json,subprocess,base64,sys
s=json.load(sys.stdin)['script'];opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5']
from pathlib import Path
f=Path('/home/zhangyanbo/.local/share/fox-live2d-transfer/swing-workflow.ps1');f.write_text(s,encoding='utf-8')
a=subprocess.run(['sftp',*opts,'-b','-','mobile-computer-frp'],input=('put '+str(f)+' .fox-live2d/swing-workflow.ps1\n').encode(),capture_output=True,timeout=20)
if a.returncode:raise RuntimeError(a.stderr.decode(errors='replace'))
launch=r"$ErrorActionPreference='Stop';$f=Join-Path $env:USERPROFILE '.fox-live2d\swing-workflow.ps1';& ([ScriptBlock]::Create([IO.File]::ReadAllText($f,[Text.Encoding]::UTF8)));exit 0"
c='powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand '+base64.b64encode(launch.encode('utf-16le')).decode()
r=subprocess.run(['ssh',*opts,'mobile-computer-frp',c],stdin=subprocess.DEVNULL,capture_output=True,timeout=55)
print(r.stdout.decode('utf-8-sig',errors='replace'));print(r.stderr.decode(errors='replace') if r.returncode else '');sys.exit(r.returncode)
'''
remote="python3 -c '"+program.replace("'","'\"'\"'")+"'"
r=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',remote],input=json.dumps({'script':ps}).encode(),capture_output=True,timeout=85)
raw=r.stdout.decode('utf-8-sig',errors='replace').strip()
try:
 parsed=json.JSONDecoder().raw_decode(raw)[0]
 compact=[]
 for step in parsed.get('steps',[]):
  v={k:step[k] for k in ['op','id','name','nodes','status','skipped'] if k in step}
  v['fields']=[{k:n.get(k) for k in ['nodeId','name','text']} for n in step.get('interesting',[]) if n.get('text') not in ['', '#FFFFFF','#000000']]
  v['values']=[n for n in step.get('numeric',[]) if n['screenBounds'][0]<330]
  if 'result' in step:v['result']={k:z for k,z in step['result'].items() if k not in ['node','parentNodes','operationIds'] } if isinstance(step['result'],dict) else step['result']
  compact.append(v)
 print(json.dumps({'ok':parsed.get('ok'),'error':parsed.get('error'),'steps':compact},ensure_ascii=False))
except Exception:print(raw[:3000])
print(r.stderr.decode(errors='replace') if r.returncode else '')
(base/'last-swing-workflow.json').write_text(raw)
sys.exit(r.returncode)
