import json
from pathlib import Path
import subprocess
import sys
import uuid

folder=Path(__file__).resolve().parent
body=Path(sys.argv[1]).read_text()
if 'public class FoxInput' in body:
    body=body.split("'@\n",1)[1]
inspect=(folder/'inspect-native.ps1').read_text()
body+='\nStart-Sleep -Milliseconds 300\n'+inspect
request_id=str(uuid.uuid4())
program=r'''
import json,pathlib,subprocess,sys,time
req=json.load(sys.stdin)
f=pathlib.Path('/home/zhangyanbo/.local/share/fox-live2d-transfer')
(f/'command.ps1').write_text(req['script'])
(f/'request.json').write_text(json.dumps({'id':req['id'],'action':'execute'}))
a=['sftp','-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-b','-','mobile-computer-frp']
batch='put '+str(f/'command.ps1')+' .fox-live2d/control/command.ps1\nput '+str(f/'request.json')+' .fox-live2d/control/request.json\n'
r=subprocess.run(a,input=batch.encode(),capture_output=True,timeout=30)
if r.returncode:print('Transfer failed');sys.exit(r.returncode)
for i in range(8):
 r=subprocess.run(a,input=('get .fox-live2d/control/result.json '+str(f/'worker-result.json')+'\n').encode(),capture_output=True,timeout=15)
 if r.returncode==0:
  result=json.loads((f/'worker-result.json').read_text(encoding='utf-8-sig'))
  if result.get('id')==req['id']:
   print(json.dumps(result,ensure_ascii=False));sys.exit(0 if result.get('ok') else 1)
 time.sleep(2)
print(json.dumps({'id':req['id'],'status':'pending-do-not-restart'}))
'''
cmd="python3 -c '"+program.replace("'","'\"'\"'")+"'"
r=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',cmd],input=json.dumps({'script':body,'id':request_id}).encode(),capture_output=True,timeout=65)
print(r.stdout.decode(errors='replace'))
if r.returncode:print(r.stderr.decode(errors='replace'))
sys.exit(r.returncode)
