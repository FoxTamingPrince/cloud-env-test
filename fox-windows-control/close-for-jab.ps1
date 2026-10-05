$ErrorActionPreference='Stop'
$base=Join-Path $env:USERPROFILE '.fox-live2d'
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$model=Join-Path $base 'model-v5-20261004-101410\fox-live2d\fox-live2d-v5.cmo3'
Copy-Item $model ($model+'.before-jab-'+$stamp)
$control=Join-Path $base 'control'
$request=Join-Path $control 'request.json'
if(Test-Path $request){Move-Item $request (Join-Path $control ('request-unconfirmed-'+$stamp+'.json'))}
$source=Join-Path $control 'command.ps1'
if(Test-Path $source){Copy-Item $source (Join-Path $control ('command-unconfirmed-'+$stamp+'.ps1'))}
Add-Type @'
using System;using System.Runtime.InteropServices;
public class FoxGracefulClose{[DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);}
'@
[FoxGracefulClose]::PostMessage([IntPtr]18612732,16,[IntPtr]0,[IntPtr]0)|Out-Null
