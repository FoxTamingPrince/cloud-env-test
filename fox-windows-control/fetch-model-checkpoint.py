import subprocess,pathlib,json
base=pathlib.Path(__file__).resolve().parent.parent
program=r'''
import pathlib,subprocess,json
f=pathlib.Path('/home/zhangyanbo/.local/share/fox-live2d-transfer/fox-live2d-bound-checkpoint.cmo3')
opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5']
s='.fox-live2d/model-v5-20261004-101410/fox-live2d/fox-live2d-v5.cmo3'
p=subprocess.run(['sftp',*opts,'-b','-','mobile-computer-frp'],input=('get '+s+' '+str(f)+'\n').encode(),capture_output=True,timeout=30)
if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace'))
print(json.dumps({'bytes':f.stat().st_size}))
'''
cmd="python3 -c '"+program.replace("'","'\"'\"'")+"'"
r=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',cmd],capture_output=True,timeout=40)
if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace'))
p=base/'fox-live2d-bound-checkpoint.cmo3'
subprocess.run(['scp','-q','company-server-direct:/home/zhangyanbo/.local/share/fox-live2d-transfer/'+p.name,str(p)],check=True,timeout=30)
print(json.dumps({'bytes':p.stat().st_size,'saved':str(p)}))
