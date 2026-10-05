"""Use the existing private device inventory; never print connection credentials."""
import subprocess, sys, shlex
from pathlib import Path
put = len(sys.argv) == 4 and sys.argv[1] == '--put'
if put:
    content = Path(sys.argv[2]).read_bytes()
    command = 'umask 077; cat > ' + shlex.quote(sys.argv[3])
else:
    content = None
    command = sys.stdin.read() if len(sys.argv) == 1 else sys.argv[1]
remote = '''import re,shlex,subprocess,os,sys
from pathlib import Path
from html import unescape
s=Path('/home/zhangyanbo/owner/xiaowangzi/projects/fox-engineering/docs/kb/devices_inventory.html').read_text()
row=next(x for x in re.findall(r'<tr[^>]*>(.*?)</tr>',s,re.S) if 'FRP VPS' in x)
a=shlex.split(unescape(re.sub(r'<[^>]*>',' ',row)))
password=a[a.index('-p')+1]
r,w=os.pipe();os.write(w,(password+'\\n').encode());os.close(w)
p=subprocess.run(['sshpass','-d',str(r),'ssh','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8','root@8.163.122.236',COMMAND],pass_fds=(r,),input=sys.stdin.buffer.read() if PUT else None)
os.close(r);raise SystemExit(p.returncode)
'''.replace('COMMAND', repr(command)).replace('PUT', repr(put))
r = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', 'company-server-direct', 'python3 -c ' + shlex.quote(remote)], input=content)
raise SystemExit(r.returncode)
