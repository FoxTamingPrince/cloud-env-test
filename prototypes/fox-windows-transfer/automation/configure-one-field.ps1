if(Get-Process LogonUI -ErrorAction SilentlyContinue){throw 'Windows locked'}
[FoxDpi]::SetThreadDpiAwarenessContext([IntPtr](-4))|Out-Null
$h=[IntPtr]10030484
$fg=[FoxInput]::GetForegroundWindow();$owner=[uint32]0;$thread=[FoxNativeWindows]::GetWindowThreadProcessId($fg,[ref]$owner);$self=[FoxActivate]::GetCurrentThreadId()
$attached=[FoxActivate]::AttachThreadInput($self,$thread,$true)
try{[FoxActivate]::BringWindowToTop($h)|Out-Null;[FoxInput]::SetForegroundWindow($h)|Out-Null}finally{if($attached){[FoxActivate]::AttachThreadInput($self,$thread,$false)|Out-Null}}
$r=New-Object FoxInput+RECT;[FoxInput]::GetWindowRect($h,[ref]$r)|Out-Null
[FoxInput]::SetCursorPos(($r.Left+295),($r.Top+308))|Out-Null
$p=New-Object FoxDpi+POINT;[FoxDpi]::GetCursorPos([ref]$p)|Out-Null
$hit=[FoxDpi]::WindowFromPoint($p);$hitOwner=[uint32]0;[FoxNativeWindows]::GetWindowThreadProcessId($hit,[ref]$hitOwner)|Out-Null
if($hitOwner -ne 28164){throw 'Pointer is outside Cubism; no input sent'}
[FoxInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 100
[FoxInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 100
if([FoxInput]::GetForegroundWindow() -ne $h){throw 'Dialog lost focus after click; no keys sent'}
[FoxInput]::keybd_event(17,0,0,[UIntPtr]::Zero);[FoxInput]::keybd_event(65,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 100
[FoxInput]::keybd_event(65,0,2,[UIntPtr]::Zero);[FoxInput]::keybd_event(17,0,2,[UIntPtr]::Zero)
foreach($key in @(49,54)){
 if([FoxInput]::GetForegroundWindow() -ne $h){throw 'Dialog lost focus; typing stopped'}
 [FoxInput]::keybd_event($key,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 50
 [FoxInput]::keybd_event($key,0,2,[UIntPtr]::Zero)
}
