import subprocess,sys,base64
command=sys.stdin.read() if len(sys.argv)==1 else sys.argv[1]
remote='''import re,shlex,subprocess,os
from pathlib import Path
from html import unescape
s=Path('/home/zhangyanbo/owner/xiaowangzi/projects/fox-engineering/docs/kb/devices_inventory.html').read_text()
row=next(x for x in re.findall(r'<tr[^>]*>(.*?)</tr>',s,re.S) if 'FRP VPS' in x)
t=unescape(re.sub(r'<[^>]*>',' ',row))
a=shlex.split(t)
password=a[a.index('-p')+1]
r,w=os.pipe();os.write(w,(password+'\\n').encode());os.close(w)
p=subprocess.run(['sshpass','-d',str(r),'ssh','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8','root@8.163.122.236',COMMAND],pass_fds=(r,))
os.close(r);raise SystemExit(p.returncode)
'''.replace('COMMAND',repr(command))
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=5','company-server-direct','python3 -c '+__import__('shlex').quote(remote)])
raise SystemExit(r.returncode)
