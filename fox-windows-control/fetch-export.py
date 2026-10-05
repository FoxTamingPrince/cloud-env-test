import subprocess,pathlib,json
base=pathlib.Path(__file__).resolve().parent.parent
program=r'''
import pathlib,subprocess,json
f=pathlib.Path('/home/zhangyanbo/.local/share/fox-live2d-transfer/fox-export-20261005')
opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5']
p=subprocess.run(['sftp',*opts,'-b','-','mobile-computer-frp'],input=('get -R .fox-live2d/exports/fox '+str(f)+'\n').encode(),capture_output=True,timeout=45)
if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace'))
print(json.dumps({'files':[{'name':str(p.relative_to(f)),'bytes':p.stat().st_size} for p in f.rglob('*') if p.is_file()]}))
'''
cmd="python3 -c '"+program.replace("'","'\"'\"'")+"'"
r=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',cmd],capture_output=True,timeout=55)
if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace'))
print(r.stdout.decode())
p=base/'fox-live2d-runtime-work/public/fox-live2d/models/fox';p.parent.mkdir(parents=True,exist_ok=True)
subprocess.run(['scp','-q','-r','company-server-direct:/home/zhangyanbo/.local/share/fox-live2d-transfer/fox-export-20261005',str(p)],check=True,timeout=45)
print(json.dumps({'saved':str(p),'files':[str(f.relative_to(p)) for f in p.rglob('*') if f.is_file()]}))
