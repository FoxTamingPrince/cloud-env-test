"""Transfer only the prepared public Java Access Bridge control files."""
import base64,json,pathlib,subprocess,sys
folder=pathlib.Path(__file__).resolve().parent.parent/'fox-windows-jab'
names=['JabController.cs','jab-file-worker.ps1','swing-agent/FoxAttach.java','swing-agent/build-agent.ps1','swing-agent/src/fox/agent/FoxSwingAgentV9.java']
payload={name:base64.b64encode((folder/name).read_bytes()).decode() for name in names}
code=r'''
import base64,json,pathlib,subprocess,sys
data=json.load(sys.stdin);folder=pathlib.Path('/home/zhangyanbo/.local/share/fox-live2d-transfer')
batch='-mkdir .fox-live2d/jab\n-mkdir .fox-live2d/jab-control\n-mkdir .fox-live2d/jab/swing-agent\n-mkdir .fox-live2d/jab/swing-agent/src\n-mkdir .fox-live2d/jab/swing-agent/src/fox\n-mkdir .fox-live2d/jab/swing-agent/src/fox/agent\n'
for name,content in data.items():
 if name not in ['JabController.cs','jab-file-worker.ps1','swing-agent/FoxAttach.java','swing-agent/build-agent.ps1','swing-agent/src/fox/agent/FoxSwingAgentV9.java']:raise ValueError('Unexpected file')
 f=folder/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(base64.b64decode(content));batch+='put '+str(f)+' .fox-live2d/jab/'+name+'\n'
opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5']
r=subprocess.run(['sftp',*opts,'-b','-','mobile-computer-frp'],input=batch.encode(),capture_output=True,timeout=35)
print('JAB transfer complete' if r.returncode==0 else 'JAB transfer failed');sys.exit(r.returncode)
'''
remote="python3 -c '"+code.replace("'","'\"'\"'")+"'"
r=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',remote],input=json.dumps(payload).encode(),capture_output=True,timeout=45)
print(r.stdout.decode());sys.exit(r.returncode)
