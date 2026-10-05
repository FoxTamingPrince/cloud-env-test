import json, subprocess, sys
program=r'''
import json,pathlib,subprocess,sys
folder=pathlib.Path('/home/zhangyanbo/.local/share/fox-live2d-transfer')
names=['ready.json','result.json','bootstrap-error.txt']
for n in names:
 (folder/('jab-'+n)).unlink(missing_ok=True)
batch=''.join('-get .fox-live2d/jab-control/'+n+' '+str(folder/('jab-'+n))+'\n' for n in names)
opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5']
p=subprocess.run(['sftp',*opts,'-b','-','mobile-computer-frp'],input=batch.encode(),capture_output=True,timeout=25)
result={}
for n in names:
 f=folder/('jab-'+n)
 if f.exists():
  s=f.read_text(encoding='utf-8-sig')
  result[n]=json.loads(s) if n.endswith('.json') else s
print(json.dumps(result,ensure_ascii=False))
sys.exit(p.returncode)
'''
if '--swing' in sys.argv:
 program=program.replace('jab-control/', 'swing9-control/').replace("['ready.json','result.json','bootstrap-error.txt']","['ready.json','result.json','fault.json']")
remote="python3 -c '"+program.replace("'","'\"'\"'")+"'"
p=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',remote],capture_output=True,timeout=35)
print(p.stdout.decode(errors='replace'));sys.exit(p.returncode)
