$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected host'}
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public class FoxKeyWindow {
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr h,StringBuilder s,int count);
 [DllImport("user32.dll")]public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
}
'@
$h=[IntPtr]7341856;$owner=[uint32]0
[FoxKeyWindow]::GetWindowThreadProcessId($h,[ref]$owner)|Out-Null
$title=New-Object Text.StringBuilder 512;[FoxKeyWindow]::GetWindowText($h,$title,512)|Out-Null
if(![FoxKeyWindow]::IsWindow($h) -or $owner -ne 40676 -or $title.ToString() -notlike '*fox-live2d-v5.cmo3'){throw 'Window identity changed; no key sent'}
$a=[FoxKeyWindow]::PostMessage($h,256,[IntPtr]35,[IntPtr]0x014f0001)
$b=[FoxKeyWindow]::PostMessage($h,257,[IntPtr]35,[IntPtr]-1051787263)
@{hwnd=7341856;key='End';downPosted=$a;upPosted=$b;queuedOnly=$true}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\key-params-end.json')
