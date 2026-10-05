import base64,subprocess,json
ps=r"$ErrorActionPreference='Stop';if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected host'};$foxExport=Join-Path $env:USERPROFILE '.fox-live2d\exports\fox';New-Item -ItemType Directory -Path $foxExport -Force|Out-Null;@{path=$foxExport;ready=(Test-Path -LiteralPath $foxExport)}|ConvertTo-Json -Compress"
program=r'''
import subprocess,sys,json
cmd=json.load(sys.stdin)['cmd']
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5','mobile-computer-frp',cmd],capture_output=True,timeout=25)
print(r.stdout.decode('utf-8-sig',errors='replace'));sys.exit(r.returncode)
'''
remote="python3 -c '"+program.replace("'","'\"'\"'")+"'"
r=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',remote],input=json.dumps({'cmd':'powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand '+base64.b64encode(ps.encode('utf-16le')).decode()}).encode(),capture_output=True,timeout=35)
print(r.stdout.decode());raise SystemExit(r.returncode)
