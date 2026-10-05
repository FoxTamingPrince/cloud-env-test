$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected host'}
$d=Join-Path $env:USERPROFILE '.fox-live2d\jab-control'
$r=Get-Content -Raw -Encoding UTF8 (Join-Path $d 'ready.json')|ConvertFrom-Json
if($r.ready -or !$r.stopped -or $r.reason -ne 'faulted'){throw 'Worker is not confirmed faulted; no stop'}
$t=Get-ScheduledTask -TaskName 'Fox-Cubism-Jab'
$u=$t.Principal.UserId; if($u -match '^S-1-'){ $u=(New-Object Security.Principal.SecurityIdentifier($u)).Translate([Security.Principal.NTAccount]).Value }; if($t.Actions.Execute -ne 'powershell.exe' -or ($u -ne 'MOBILE-COMPUTER\zhangyanbo' -and $u -ne 'zhangyanbo')){throw ('Task identity changed: '+$u)}
$p=Get-Process -Id ([int]$r.pid) -ErrorAction SilentlyContinue
if($p -and $p.ProcessName -ne 'powershell'){throw 'PID identity changed'}
Stop-ScheduledTask -TaskName 'Fox-Cubism-Jab'
@{stoppedWorkerPid=$r.pid;taskState=(Get-ScheduledTask -TaskName 'Fox-Cubism-Jab').State.ToString();editorAlive=[bool](Get-Process -Id 40676 -ErrorAction SilentlyContinue)}|ConvertTo-Json -Compress
