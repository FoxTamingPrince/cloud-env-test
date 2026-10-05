$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected host'}
$taskName='Fox-Cubism-Jab'
if((Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue).State -eq 'Running'){throw 'JAB task already running; no restart'}
$scriptPath=Join-Path $env:USERPROFILE '.fox-live2d\jab\jab-file-worker.ps1'
$script="`$ErrorActionPreference='Stop';try{`$s=Get-Content -Raw -Encoding UTF8 '$scriptPath';& ([scriptblock]::Create(`$s))}catch{`$_.Exception.ToString()|Set-Content -Encoding UTF8 (Join-Path `$env:USERPROFILE '.fox-live2d\jab-control\bootstrap-error.txt');exit 1}"
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-WindowStyle Hidden -NoLogo -NoProfile -NonInteractive -EncodedCommand '+$encoded)
$principal=New-ScheduledTaskPrincipal -UserId 'MOBILE-COMPUTER\zhangyanbo' -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Force|Out-Null
Start-ScheduledTask -TaskName $taskName
@{started=$true;task=$taskName}|ConvertTo-Json -Compress
