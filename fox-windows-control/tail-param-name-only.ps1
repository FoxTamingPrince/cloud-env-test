$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected host'}
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public class FoxParamKeys {
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr h,StringBuilder s,int count);
 [DllImport("user32.dll")]public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
}
'@
$h=[IntPtr]1247640;$owner=[uint32]0
[FoxParamKeys]::GetWindowThreadProcessId($h,[ref]$owner)|Out-Null
$t=New-Object Text.StringBuilder 256;[FoxParamKeys]::GetWindowText($h,$t,256)|Out-Null
if(![FoxParamKeys]::IsWindow($h) -or $owner -ne 40676 -or $t.ToString() -ne '新参数'){throw 'Dialog identity changed; no typing'}
function Send-Key([int]$k,[int]$scan){
 $l=[int64]$scan*65536+1
 if(![FoxParamKeys]::PostMessage($h,256,[IntPtr]$k,[IntPtr]$l)){throw 'keydown failed'}
 if(![FoxParamKeys]::PostMessage($h,257,[IntPtr]$k,[IntPtr]($l+3221225472))){throw 'keyup failed'}
 Start-Sleep -Milliseconds 15
}
function Type-Text([string]$s){foreach($c in $s.ToCharArray()){if(![FoxParamKeys]::PostMessage($h,258,[IntPtr][int]$c,[IntPtr]1)){throw 'char failed'};Start-Sleep -Milliseconds 5}}
Type-Text 'Tail swing'
Start-Sleep -Milliseconds 300
Send-Key 9 15
@{typed=$true;confirmed=$false;name='Tail swing';id='ParamTailSwing';minimum=-1;default=0;maximum=1}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\tail-param-name-only.json')
