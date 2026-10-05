$ErrorActionPreference='Stop'
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public class FoxCloseDialogs {
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr h,StringBuilder s,int count);
 [DllImport("user32.dll")]public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
}
'@
$out=@()
foreach($w in @(@{h=20255740;title='摇摆运动的自动生成'})){
 $h=[IntPtr]$w.h
 if(![FoxCloseDialogs]::IsWindow($h)){continue}
 $owner=[uint32]0;[FoxCloseDialogs]::GetWindowThreadProcessId($h,[ref]$owner)|Out-Null
 $title=New-Object Text.StringBuilder 512;[FoxCloseDialogs]::GetWindowText($h,$title,512)|Out-Null
 if($owner -ne 40676 -or $title.ToString() -ne $w.title){throw 'Dialog identity changed; no close sent'}
 $posted=[FoxCloseDialogs]::PostMessage($h,16,[IntPtr]0,[IntPtr]0)
 $out+=@{hwnd=$w.h;title=$w.title;posted=$posted}
}
ConvertTo-Json -InputObject $out -Compress|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\close-sway-dialog.json')
