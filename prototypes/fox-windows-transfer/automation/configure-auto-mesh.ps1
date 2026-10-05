Add-Type -AssemblyName System.Windows.Forms
if(Get-Process LogonUI -ErrorAction SilentlyContinue){throw 'Windows locked'}
$h=[IntPtr]10030484
[FoxInput]::SetForegroundWindow($h)|Out-Null
Start-Sleep -Milliseconds 250
if([FoxInput]::GetForegroundWindow() -ne $h){throw 'Mesh dialog not foreground'}
$r=New-Object FoxInput+RECT;[FoxInput]::GetWindowRect($h,[ref]$r)|Out-Null
foreach($field in @(@(308,'16'),@(353,'24'),@(400,'6'),@(448,'6'),@(492,'2'))){
 [FoxInput]::SetCursorPos(($r.Left+295),($r.Top+[int]$field[0]))|Out-Null
 [FoxInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 80
 [FoxInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 100
 [System.Windows.Forms.SendKeys]::SendWait('^a')
 [System.Windows.Forms.SendKeys]::SendWait([string]$field[1])
}
