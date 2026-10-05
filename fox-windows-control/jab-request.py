"""Issue one UUID request to the interactive public JAB worker."""
import json, pathlib, subprocess, sys, uuid
root=pathlib.Path(__file__).resolve().parent.parent
swing=any(x in sys.argv for x in ['--swing','--swing2','--swing3'])
pending='--pending-ok' in sys.argv
req=json.loads(pathlib.Path(sys.argv[1]).read_text())
req['id']=str(uuid.uuid4())
request_dir=root/'fox-windows-control'/('requests-swing' if swing else 'requests')
request_dir.mkdir(exist_ok=True)
(request_dir/(req['id']+'.json')).write_text(json.dumps(req,ensure_ascii=False,indent=2))
program=r'''
import base64,json,subprocess,sys
r=json.load(sys.stdin)
data=base64.b64encode(json.dumps(r,ensure_ascii=False,separators=(',',':')).encode()).decode()
ps=r"""[Console]::OutputEncoding=[Text.Encoding]::UTF8;$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE '.fox-live2d\jab-control';$ready=Get-Content -Raw -Encoding UTF8 (Join-Path $d 'ready.json')|ConvertFrom-Json;if(!$ready.ready -or !(Get-Process -Id $ready.pid -ErrorAction SilentlyContinue)){throw 'Worker is not ready'};$raw=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('DATA'));$r=$raw|ConvertFrom-Json;$p=Join-Path $d 'request.json';$tmp=Join-Path $d ('request-'+$r.id+'.tmp');[IO.File]::WriteAllText($tmp,$raw,(New-Object Text.UTF8Encoding($false)));if([IO.File]::Exists($p)){[IO.File]::Replace($tmp,$p,($p+".previous"))}else{[IO.File]::Move($tmp,$p)};$out=Join-Path $d ('receipts\'+$r.id+'.json');$end=(Get-Date).AddSeconds(30);while((Get-Date) -lt $end){if(Test-Path -LiteralPath $out){try{$fs=[IO.File]::Open($out,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete));$sr=New-Object IO.StreamReader($fs,[Text.Encoding]::UTF8);try{$s=$sr.ReadToEnd()}finally{$sr.Dispose()};$v=$s|ConvertFrom-Json;if($v.id -eq $r.id -and $v.state -eq 'completed'){[Console]::WriteLine(($v.response|ConvertTo-Json -Depth 16 -Compress));exit 0}}catch{}};Start-Sleep -Milliseconds 200};throw ('Outcome unconfirmed for '+$r.id+'; no retry')""".replace('DATA',data)
command='powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand '+base64.b64encode(ps.encode('utf-16le')).decode()
opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5']
p=subprocess.run(['ssh',*opts,'mobile-computer-frp',command],stdin=subprocess.DEVNULL,capture_output=True,timeout=40)
print(p.stdout.decode('utf-8',errors='replace'))
if p.returncode:print(p.stderr.decode('utf-8',errors='replace'))
sys.exit(p.returncode)
'''
if swing:
 program=program.replace(r'.fox-live2d\jab-control',r'.fox-live2d\swing9-control')
 program=program.replace('if(!$ready.ready -or', 'if(!$ready.active -or')
 program=program.replace('$r=$raw|ConvertFrom-Json;', '$r=$raw|ConvertFrom-Json;$r|Add-Member -NotePropertyName runId -NotePropertyValue $ready.runId -Force;$r|Add-Member -NotePropertyName pid -NotePropertyValue $ready.pid -Force;$raw=$r|ConvertTo-Json -Depth 20 -Compress;')
 if pending:
  program=program.replace("$v.state -eq 'completed'","$v.state -in @('completed','claimed','executing')")
if '--swing2' in sys.argv:program=program.replace('swing9-control','swing2-control')
if '--swing3' in sys.argv:program=program.replace('swing9-control','swing3-control')
remote="python3 -c '"+program.replace("'","'\"'\"'")+"'"
p=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',remote],input=json.dumps(req).encode(),capture_output=True,timeout=50)
raw=p.stdout.decode('utf-8',errors='replace').strip().lstrip('\ufeff')
try:
 response=json.loads(raw)
 target=root/'fox-windows-control'/('last-swing-response.json' if swing else 'last-jab-response.json')
 target.write_text(json.dumps(response,ensure_ascii=False,indent=2))
 (target.parent/(req['id']+'.json')).write_text(json.dumps(response,ensure_ascii=False,indent=2))
 if isinstance(response.get('result'),dict) and 'nodes' in response['result']:
  print(json.dumps({'ok':response.get('ok'),'id':req['id'],'nodes':len(response['result']['nodes']),'saved':str(target)},ensure_ascii=False))
 else:print(raw)
except Exception:
 print('Unconfirmed request '+req['id']);print(raw);print(p.stderr.decode(errors='replace'))
sys.exit(p.returncode)
