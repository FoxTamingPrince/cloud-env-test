[Console]::OutputEncoding=[Text.Encoding]::UTF8
$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected Windows host'}
$dir=Join-Path $env:USERPROFILE '.fox-live2d'
$p=@(Get-Process java,CubismEditor5 -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,MainWindowHandle,MainWindowTitle,Responding)
$backups=@(Get-ChildItem -LiteralPath (Join-Path $dir 'model-v5-20261004-101410\fox-live2d') -Filter '*.before-jab-*' | Select-Object Name,Length,LastWriteTime)
$model=Get-Item -LiteralPath (Join-Path $dir 'model-v5-20261004-101410\fox-live2d\fox-live2d-v5.cmo3')|Select-Object Name,Length,LastWriteTime
$jdkReady=Join-Path $dir 'tools\jdk17-ready.json'
$jdk=$null;if(Test-Path -LiteralPath $jdkReady){$jdk=Get-Content -LiteralPath $jdkReady -Raw -Encoding UTF8|ConvertFrom-Json}
$rel=Get-Content -Raw -LiteralPath 'C:\Program Files\Live2D Cubism 5.3\app\jre\release'
$toolsTask=Get-ScheduledTask -TaskName 'Fox-Cubism-Tools' -ErrorAction SilentlyContinue
$toolsInfo=Get-ScheduledTaskInfo -TaskName 'Fox-Cubism-Tools' -ErrorAction SilentlyContinue
$zipFiles=@(Get-ChildItem -LiteralPath (Join-Path $dir 'tools\jdk17') -File -ErrorAction SilentlyContinue|Select-Object Name,Length)
@{modules=@{compiler=($rel -match 'jdk.compiler');attach=($rel -match 'jdk.attach');jar=($rel -match 'jdk.jartool')};toolTaskState=$toolsTask.State.ToString();toolTaskResult=$toolsInfo.LastTaskResult;jdkDownloads=$zipFiles;instrumentDll=[bool](Test-Path -LiteralPath 'C:\Program Files\Live2D Cubism 5.3\app\jre\bin\instrument.dll');jdk=$jdk;computer=$env:COMPUTERNAME;locked=[bool](Get-Process LogonUI -ErrorAction SilentlyContinue);processes=$p;backups=$backups;model=$model}|ConvertTo-Json -Depth 5 -Compress
