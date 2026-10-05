$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected host'}
$d=Join-Path $env:USERPROFILE '.fox-live2d'
$log=Join-Path $d 'swing-build.log'
try {
 $ready=Get-Content -Raw -Encoding UTF8 (Join-Path $d 'tools\jdk17-ready.json')|ConvertFrom-Json
 if(!$ready.ready){throw 'Private JDK is not ready'}
 $jdk=Split-Path (Split-Path $ready.javac -Parent) -Parent
 $agent=Join-Path $d 'jab\swing-agent'
 $src=Get-Content -Raw -Encoding UTF8 (Join-Path $agent 'build-agent.ps1')
 $src=$src.Replace('$PSScriptRoot',("'"+$agent.Replace("'","''")+"'"))
 & ([scriptblock]::Create($src)) -JavaHome $jdk *> $log
 $target=Get-Process -Id 40676 -ErrorAction Stop
 $jre='C:\Program Files\Live2D Cubism 5.3\app\jre'
 $expected=Join-Path $jre 'bin\java.exe'
 if($target.ProcessName -ne 'java' -or $target.Path -ne $expected){throw 'Cubism PID command differs; no attach'}
 $control=Join-Path $d 'swing9-control'
 New-Item -ItemType Directory -Path $control -Force|Out-Null
 $config=Join-Path $control 'config.json'
 [IO.File]::WriteAllText($config,(@{pid=40676;expectedJavaHome=$jre;controlDirectory=$control}|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
 & $ready.java --add-modules jdk.attach -cp (Join-Path $agent 'build\launcher') FoxAttach 40676 $jre $expected (Join-Path $agent 'fox-swing-agent-v9.jar') $config *>> $log
 if($LASTEXITCODE -ne 0){throw ('Attach launcher exit '+$LASTEXITCODE)}
 @{attached=$true;pid=40676}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 (Join-Path $d 'swing-bootstrap.json')
} catch {
 $_.Exception.ToString()|Add-Content -Encoding UTF8 $log
 @{attached=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 (Join-Path $d 'swing-bootstrap.json')
 throw
}
