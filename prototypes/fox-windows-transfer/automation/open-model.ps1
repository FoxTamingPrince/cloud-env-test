Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System; using System.Runtime.InteropServices;
public class FoxAuthoringWindow {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int hgt,bool repaint);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
'@
$dir=Join-Path $env:USERPROFILE '.fox-live2d'
$h=[IntPtr]33554920
[FoxAuthoringWindow]::ShowWindow($h,9)|Out-Null
[FoxAuthoringWindow]::MoveWindow($h,100,100,1280,960,$true)|Out-Null
$focused=[FoxAuthoringWindow]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 300
if([FoxAuthoringWindow]::GetForegroundWindow() -eq $h){
 [FoxAuthoringWindow]::keybd_event(17,0,0,[UIntPtr]::Zero)
 [FoxAuthoringWindow]::keybd_event(79,0,0,[UIntPtr]::Zero)
 [FoxAuthoringWindow]::keybd_event(79,0,2,[UIntPtr]::Zero)
 [FoxAuthoringWindow]::keybd_event(17,0,2,[UIntPtr]::Zero)
}
@{focused=$focused;action='open-file-dialog';timestamp=(Get-Date).ToString('o')}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $dir 'authoring-action-result.json')
