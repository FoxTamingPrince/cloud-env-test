[Console]::OutputEncoding=[Text.Encoding]::UTF8
$dir=Join-Path $env:USERPROFILE '.fox-live2d\jab-control'
$ready=$null;$result=$null
if(Test-Path -LiteralPath (Join-Path $dir 'ready.json')){$ready=Get-Content -LiteralPath (Join-Path $dir 'ready.json') -Raw -Encoding UTF8|ConvertFrom-Json}
if(Test-Path -LiteralPath (Join-Path $dir 'result.json')){$result=Get-Content -LiteralPath (Join-Path $dir 'result.json') -Raw -Encoding UTF8|ConvertFrom-Json}
$bootstrapError=$null
if(Test-Path -LiteralPath (Join-Path $dir 'bootstrap-error.txt')){$bootstrapError=Get-Content -LiteralPath (Join-Path $dir 'bootstrap-error.txt') -Raw -Encoding UTF8}
@{ready=$ready;result=$result;bootstrapError=$bootstrapError;processes=@(Get-Process java,CubismEditor5 -ErrorAction SilentlyContinue|Select-Object Id,MainWindowHandle,MainWindowTitle,Responding);locked=[bool](Get-Process LogonUI -ErrorAction SilentlyContinue);task=(Get-ScheduledTask -TaskName 'Fox-Cubism-Jab' -ErrorAction SilentlyContinue|Select-Object State);taskInfo=(Get-ScheduledTaskInfo -TaskName 'Fox-Cubism-Jab' -ErrorAction SilentlyContinue|Select-Object LastTaskResult,LastRunTime);updatedCode=[bool](Select-String -LiteralPath (Join-Path $env:USERPROFILE '.fox-live2d\jab\JabController.cs') -SimpleMatch 'IntPtr available=Marshal.AllocHGlobal(131076)')}|ConvertTo-Json -Depth 8 -Compress
