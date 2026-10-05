if(-not ('FoxActivate' -as [type])){
Add-Type @'
using System;using System.Runtime.InteropServices;
public class FoxActivate{
 [DllImport("kernel32.dll")]public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")]public static extern bool AttachThreadInput(uint a,uint b,bool attach);
 [DllImport("user32.dll")]public static extern bool BringWindowToTop(IntPtr h);
}
'@
}
if(Get-Process LogonUI -ErrorAction SilentlyContinue){throw 'Windows locked'}
$h=[IntPtr]10030484;$fg=[FoxInput]::GetForegroundWindow();$owner=[uint32]0
$thread=[FoxNativeWindows]::GetWindowThreadProcessId($fg,[ref]$owner)
$self=[FoxActivate]::GetCurrentThreadId();$attached=$false
try{
 $attached=[FoxActivate]::AttachThreadInput($self,$thread,$true)
 [FoxActivate]::BringWindowToTop($h)|Out-Null
 $ok=[FoxInput]::SetForegroundWindow($h)
}finally{if($attached){[FoxActivate]::AttachThreadInput($self,$thread,$false)|Out-Null}}
Start-Sleep -Milliseconds 300
@{target=$h.ToInt64();foreground=([FoxInput]::GetForegroundWindow()).ToInt64();activationResult=$ok;attached=$attached}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\focus-diagnostics.json')
