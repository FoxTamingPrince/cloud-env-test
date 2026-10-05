$ErrorActionPreference='Stop'
$dir=Join-Path $env:USERPROFILE '.fox-live2d'
$out=Join-Path $dir 'jab-start.json'
try {
 if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected host'}
 if(Get-Process java,CubismEditor5 -ErrorAction SilentlyContinue){throw 'Existing editor detected; no duplicate launch'}
 $launcher='C:\Program Files\Live2D Cubism 5.3\CubismEditor5.exe'
 $model=Join-Path $dir 'model-v5-20261004-101410\fox-live2d\fox-live2d-v5.cmo3'
 if(!(Test-Path -LiteralPath $model)){throw 'Saved model missing'}
 $psi=New-Object Diagnostics.ProcessStartInfo
 $psi.UseShellExecute=$false
 $psi.FileName=$launcher
 $psi.Arguments='"'+$model+'"'
 $psi.WorkingDirectory=Split-Path -LiteralPath $launcher
 $psi.EnvironmentVariables['JAVA_TOOL_OPTIONS']='-Djavax.accessibility.assistive_technologies=com.sun.java.accessibility.AccessBridge'
 $p=[Diagnostics.Process]::Start($psi)
 @{ok=$true;launcherPid=$p.Id;model=$model;scope='child-process-only'}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 $out
} catch {@{ok=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 $out;throw}
