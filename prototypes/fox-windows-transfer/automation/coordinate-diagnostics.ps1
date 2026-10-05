if(-not ('FoxDpi' -as [type])){
Add-Type @'
using System;using System.Runtime.InteropServices;
public class FoxDpi{[StructLayout(LayoutKind.Sequential)]public struct POINT{public int X,Y;}[DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);[DllImport("user32.dll")]public static extern bool GetCursorPos(out POINT p);[DllImport("user32.dll")]public static extern IntPtr WindowFromPoint(POINT p);}
'@
}
$h=[IntPtr]18612732
$r1=New-Object FoxInput+RECT;[FoxInput]::GetWindowRect($h,[ref]$r1)|Out-Null
$old=[FoxDpi]::SetThreadDpiAwarenessContext([IntPtr](-4))
$r2=New-Object FoxInput+RECT;[FoxInput]::GetWindowRect($h,[ref]$r2)|Out-Null
$p=New-Object FoxDpi+POINT;[FoxDpi]::GetCursorPos([ref]$p)|Out-Null
@{before=$r1;after=$r2;cursor=$p;windowUnderCursor=([FoxDpi]::WindowFromPoint($p)).ToInt64();foreground=([FoxInput]::GetForegroundWindow()).ToInt64()}|ConvertTo-Json -Depth 4|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\input-coordinates.json')
