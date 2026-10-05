import json
from pathlib import Path
import subprocess
import sys

base=Path(__file__).resolve().parent.parent
server=r'''
import json,pathlib,subprocess,sys
f='/home/zhangyanbo/.local/share/fox-live2d-transfer/'
a=['sftp','-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-b','-','mobile-computer-frp']
r=subprocess.run(a,input=('get .fox-live2d/cubism-windows.json '+f+'cubism-windows.json\n').encode(),capture_output=True,timeout=30)
if r.returncode:sys.exit(r.returncode)
data=json.loads(pathlib.Path(f+'cubism-windows.json').read_text(encoding='utf-8-sig'))
for x in data:
 if not x['file'].startswith('cubism-') or pathlib.Path(x['file']).name != x['file']:raise ValueError('Unexpected filename')
batch=''.join('get .fox-live2d/'+x['file']+' '+f+x['file']+'\n' for x in data)
r=subprocess.run(a,input=batch.encode(),capture_output=True,timeout=30)
print(json.dumps(data,ensure_ascii=False));sys.exit(r.returncode)
'''
remote="python3 -c '"+server.replace("'","'\"'\"'")+"'"
r=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',remote],capture_output=True,timeout=65)
if r.returncode:print(r.stderr.decode());sys.exit(r.returncode)
data=json.loads(r.stdout)
(base/'cubism-windows.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
for x in data:
 subprocess.run(['scp','-q','company-server-direct:/home/zhangyanbo/.local/share/fox-live2d-transfer/'+x['file'],str(base/x['file'])],check=True,timeout=30)
print(json.dumps(data,ensure_ascii=False,indent=2))
