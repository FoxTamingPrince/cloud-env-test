import json, subprocess, sys
program=r'''
import json,pathlib,subprocess,sys
folder=pathlib.Path('/home/zhangyanbo/.local/share/fox-live2d-transfer')
names=['swing-build.log','swing-bootstrap.json','swing-control/receipts/ab2f3413-5a89-4148-89f4-c005b2527caf.json']
for n in names:
 (folder/('diag-'+n.replace('/','-'))).unlink(missing_ok=True)
batch=''.join('-get .fox-live2d/'+n+' '+str(folder/('diag-'+n.replace('/','-')))+'\n' for n in names)
opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5']
p=subprocess.run(['sftp',*opts,'-b','-','mobile-computer-frp'],input=batch.encode(),capture_output=True,timeout=25)
result={}
for n in names:
 f=folder/('diag-'+n.replace('/','-'))
 if f.exists():
  b=f.read_bytes();s=b.decode('utf-16' if b.startswith(b'\xff\xfe') else 'utf-8-sig')
  result[n]=json.loads(s) if n.endswith('.json') else s
print(json.dumps(result,ensure_ascii=False))
sys.exit(p.returncode)
'''
if '--swing' in sys.argv:
 program=program.replace('jab-control/', 'swing-control/').replace("['ready.json','result.json','bootstrap-error.txt']","['ready.json','result.json']")
remote="python3 -c '"+program.replace("'","'\"'\"'")+"'"
p=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',remote],capture_output=True,timeout=35)
print(p.stdout.decode(errors='replace'));print(p.stderr.decode(errors='replace'));sys.exit(p.returncode)
