$ErrorActionPreference='Stop'
$dir=Join-Path $env:USERPROFILE '.fox-live2d'
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public class FoxTargetMouse {
 [StructLayout(LayoutKind.Sequential)]public struct RECT {public int L,T,R,B;}
 [StructLayout(LayoutKind.Sequential)]public struct POINT {public int X,Y;}
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr h,StringBuilder s,int count);
 [DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")]public static extern bool ScreenToClient(IntPtr h,ref POINT p);
 [DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
}
'@
$h=[IntPtr]9899838;$actual=[uint32]0
[FoxTargetMouse]::GetWindowThreadProcessId($h,[ref]$actual)|Out-Null
if($actual -ne 40676){throw 'Dialog owner changed'}
$title=New-Object Text.StringBuilder 512
[FoxTargetMouse]::GetWindowText($h,$title,512)|Out-Null
if($title.ToString() -ne '自动网格生成'){throw 'Unexpected dialog'}
$old=[FoxTargetMouse]::SetThreadDpiAwarenessContext([IntPtr](-4))
try {
 $r=New-Object FoxTargetMouse+RECT
 if(![FoxTargetMouse]::GetWindowRect($h,[ref]$r)){throw 'Window geometry unavailable'}
 $sx=($r.R-$r.L)/291.0;$sy=($r.B-$r.T)/324.0
 if([Math]::Abs($sx-$sy) -gt 0.05 -or $sx -lt 0.5 -or $sx -gt 4){throw 'Dialog scale changed'}
 $point=New-Object FoxTargetMouse+POINT
 $point.X=[int]($r.L+(376+25-254)*$sx)
 $point.Y=[int]($r.T+(597+10-453)*$sy)
 if(![FoxTargetMouse]::ScreenToClient($h,[ref]$point)){throw 'Cannot convert target coordinate'}
 $lp=[IntPtr](($point.Y -shl 16) -bor ($point.X -band 65535))
 [FoxTargetMouse]::PostMessage($h,0x200,[IntPtr]0,$lp)|Out-Null
 [FoxTargetMouse]::PostMessage($h,0x201,[IntPtr]1,$lp)|Out-Null
 [FoxTargetMouse]::PostMessage($h,0x202,[IntPtr]0,$lp)|Out-Null
 Start-Sleep -Milliseconds 100
 [FoxTargetMouse]::PostMessage($h,0x201,[IntPtr]1,$lp)|Out-Null
 [FoxTargetMouse]::PostMessage($h,0x202,[IntPtr]0,$lp)|Out-Null
 @{posted=$true;hwnd=9899838;clientX=$point.X;clientY=$point.Y;scale=$sx}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 (Join-Path $dir 'target-mouse-result.json')
} finally {[FoxTargetMouse]::SetThreadDpiAwarenessContext($old)|Out-Null}
