$p=New-Object FoxDpi+POINT;[FoxDpi]::GetCursorPos([ref]$p)|Out-Null
$h=[FoxDpi]::WindowFromPoint($p);$owner=[uint32]0;[FoxNativeWindows]::GetWindowThreadProcessId($h,[ref]$owner)|Out-Null
$title=New-Object Text.StringBuilder 512;[FoxNativeWindows]::GetWindowText($h,$title,512)|Out-Null
$class=New-Object Text.StringBuilder 128;[FoxNativeWindows]::GetClassName($h,$class,128)|Out-Null
@{window=$h.ToInt64();owner=$owner;process=(Get-Process -Id $owner).ProcessName;title=$title.ToString();class=$class.ToString()}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\cursor-owner.json')
