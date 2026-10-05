$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected host'}
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public class FoxConfirmSway {
 public delegate bool EnumFn(IntPtr h,IntPtr l);
 [StructLayout(LayoutKind.Sequential)]public struct RECT{public int l,t,r,b;}
 [DllImport("user32.dll")]public static extern bool EnumWindows(EnumFn f,IntPtr l);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr h,StringBuilder s,int count);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetClassName(IntPtr h,StringBuilder s,int count);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
}
'@
$found=New-Object System.Collections.Generic.List[long]
$cb=[FoxConfirmSway+EnumFn]{param($h,$l)
 $p=[uint32]0;[FoxConfirmSway]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null
 if($p -eq 40676 -and [FoxConfirmSway]::IsWindowVisible($h)){
  $t=New-Object Text.StringBuilder 512;$c=New-Object Text.StringBuilder 128;$r=New-Object FoxConfirmSway+RECT
  [FoxConfirmSway]::GetWindowText($h,$t,512)|Out-Null;[FoxConfirmSway]::GetClassName($h,$c,128)|Out-Null;[FoxConfirmSway]::GetWindowRect($h,[ref]$r)|Out-Null
  if($t.ToString() -eq '摇摆运动的自动生成' -and $c.ToString() -eq 'SunAwtDialog' -and ($r.r-$r.l) -lt 800 -and ($r.b-$r.t) -lt 400){$found.Add($h.ToInt64())}
 };return $true
}
[FoxConfirmSway]::EnumWindows($cb,[IntPtr]0)|Out-Null
if($found.Count -ne 1){throw 'Expected exactly one sway key confirmation; no key sent'}
$h=[IntPtr]$found[0]
$a=[FoxConfirmSway]::PostMessage($h,256,[IntPtr]13,[IntPtr]0x001c0001)
$b=[FoxConfirmSway]::PostMessage($h,257,[IntPtr]13,[IntPtr](-1071906815))
@{hwnd=$found[0];key='Return';downPosted=$a;upPosted=$b;queuedOnly=$true}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\confirm-sway-keys.json')
