"""Execute a scoped authoring task in the existing home Windows user session."""
import base64
import json
from pathlib import Path
import subprocess
import sys

script = Path(sys.argv[1]).read_text()
server_program = r'''
import base64,json,pathlib,subprocess,sys
request=json.load(sys.stdin)
folder=pathlib.Path('/home/zhangyanbo/.local/share/fox-live2d-transfer')
source=folder/'authoring-action.ps1'
source.write_text(request['script'],encoding='utf-8')
opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5']
r=subprocess.run(['sftp',*opts,'-b','-','mobile-computer-frp'],input=('put '+str(source)+' .fox-live2d/authoring-action.ps1\n').encode(),capture_output=True,timeout=30)
if r.returncode: print('Script transfer failed');sys.exit(r.returncode)
ps="function Wait-FoxTask { $end=(Get-Date).AddSeconds(25); while((Get-ScheduledTask -TaskName 'Fox-Cubism-Action' -ErrorAction SilentlyContinue).State -eq 'Running'){if((Get-Date) -gt $end){throw 'Existing task still running; no restart'};Start-Sleep -Milliseconds 250} };Wait-FoxTask;$s=Get-Content -Raw -Encoding UTF8 'C:\\Users\\zhangyanbo\\.fox-live2d\\authoring-action.ps1';$e=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($s));$a=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-WindowStyle Hidden -NoLogo -NoProfile -NonInteractive -EncodedCommand '+$e);$p=New-ScheduledTaskPrincipal -UserId 'MOBILE-COMPUTER\\zhangyanbo' -LogonType Interactive -RunLevel Limited;Register-ScheduledTask -TaskName 'Fox-Cubism-Action' -Action $a -Principal $p -Force|Out-Null;Start-ScheduledTask -TaskName 'Fox-Cubism-Action';Start-Sleep -Milliseconds 500;Wait-FoxTask;Get-ScheduledTaskInfo 'Fox-Cubism-Action'|Select-Object LastTaskResult|ConvertTo-Json -Compress"
command='powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand '+base64.b64encode(ps.encode('utf-16le')).decode()
r=subprocess.run(['ssh',*opts,'mobile-computer-frp',command],stdin=subprocess.DEVNULL,capture_output=True,timeout=30)
print(r.stdout.decode('utf-8',errors='replace'))
if r.returncode:print('Remote execution failed',r.returncode)
sys.exit(r.returncode)
'''
remote = "python3 -c '" + server_program.replace("'", "'\"'\"'") + "'"
result = subprocess.run(
    ['ssh', '-o', 'BatchMode=yes', 'company-server-direct', remote],
    input=json.dumps({'script': script}).encode(), capture_output=True, timeout=65,
)
print(result.stdout.decode(errors='replace'))
if result.returncode:
    print(result.stderr.decode(errors='replace'))
sys.exit(result.returncode)
