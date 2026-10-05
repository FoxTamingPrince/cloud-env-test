Add-Type @'
using System;using System.Runtime.InteropServices;
public class FoxInput {
 [StructLayout(LayoutKind.Sequential)] public struct RECT{public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr extra);
 [DllImport("user32.dll")] public static extern void keybd_event(byte k,byte s,uint f,UIntPtr extra);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
}
'@
if(Get-Process LogonUI -ErrorAction SilentlyContinue){throw 'Windows locked'}
[FoxInput]::SetProcessDPIAware()|Out-Null
[FoxInput]::PostMessage([IntPtr]33554920,16,[IntPtr]0,[IntPtr]0)|Out-Null
$h=[IntPtr]18612732
[FoxInput]::SetForegroundWindow($h)|Out-Null
Start-Sleep -Milliseconds 300
if([FoxInput]::GetForegroundWindow() -ne $h){throw 'Cubism not foreground'}
$r=New-Object FoxInput+RECT
[FoxInput]::GetWindowRect($h,[ref]$r)|Out-Null
[FoxInput]::SetCursorPos(($r.Left+240),($r.Top+370))|Out-Null
[FoxInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
[FoxInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 200
[FoxInput]::keybd_event(17,0,0,[UIntPtr]::Zero)
[FoxInput]::keybd_event(65,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 100
[FoxInput]::keybd_event(65,0,2,[UIntPtr]::Zero)
[FoxInput]::keybd_event(17,0,2,[UIntPtr]::Zero)
