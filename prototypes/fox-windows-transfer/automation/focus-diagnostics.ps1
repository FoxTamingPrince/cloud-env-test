$h=[IntPtr]10030484
$ok=[FoxInput]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 300
$fg=[FoxInput]::GetForegroundWindow()
$owner=[uint32]0;[FoxNativeWindows]::GetWindowThreadProcessId($fg,[ref]$owner)|Out-Null
$title=New-Object Text.StringBuilder 512;[FoxNativeWindows]::GetWindowText($fg,$title,512)|Out-Null
@{target=$h.ToInt64();foreground=$fg.ToInt64();owner=$owner;title=$title.ToString();activationResult=$ok;locked=[bool](Get-Process LogonUI -ErrorAction SilentlyContinue)}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\focus-diagnostics.json')
