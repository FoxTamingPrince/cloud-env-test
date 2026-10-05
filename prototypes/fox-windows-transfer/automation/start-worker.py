import json
from pathlib import Path
import subprocess
import sys

worker=Path(__file__).with_name('worker.ps1').read_text()
program=r'''
import json,base64,pathlib,subprocess,sys
req=json.load(sys.stdin)
f=pathlib.Path('/home/zhangyanbo/.local/share/fox-live2d-transfer/worker.ps1');f.write_text(req['script'])
opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes']
r=subprocess.run(['sftp',*opts,'-b','-','mobile-computer-frp'],input=('-mkdir .fox-live2d/control\nput '+str(f)+' .fox-live2d/control/worker.ps1\n').encode(),capture_output=True,timeout=30)
if r.returncode:print('Transfer failed');sys.exit(r.returncode)
ps="$ErrorActionPreference='Stop';$t=Get-ScheduledTask -TaskName 'Fox-Cubism-Worker' -ErrorAction SilentlyContinue;if($t.State -ne 'Running'){$s=Get-Content -Raw -Encoding UTF8 'C:\\Users\\zhangyanbo\\.fox-live2d\\control\\worker.ps1';$e=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($s));$a=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-WindowStyle Hidden -NoLogo -NoProfile -NonInteractive -EncodedCommand '+$e);$p=New-ScheduledTaskPrincipal -UserId 'MOBILE-COMPUTER\\zhangyanbo' -LogonType Interactive -RunLevel Limited;Register-ScheduledTask -TaskName 'Fox-Cubism-Worker' -Action $a -Principal $p -Force|Out-Null;Start-ScheduledTask -TaskName 'Fox-Cubism-Worker'};Get-ScheduledTask -TaskName 'Fox-Cubism-Worker'|Select-Object TaskName,State|ConvertTo-Json -Compress"
c='powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand '+base64.b64encode(ps.encode('utf-16le')).decode()
r=subprocess.run(['ssh',*opts,'mobile-computer-frp',c],stdin=subprocess.DEVNULL,capture_output=True,timeout=30)
print(r.stdout.decode('utf-8',errors='replace'));sys.exit(r.returncode)
'''
cmd="python3 -c '"+program.replace("'","'\"'\"'")+"'"
r=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',cmd],input=json.dumps({'script':worker}).encode(),capture_output=True,timeout=65)
print(r.stdout.decode(errors='replace'));sys.exit(r.returncode)
