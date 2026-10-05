if(-not ('FoxNativeWindows' -as [type])){
Add-Type @'
using System;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;
public class FoxNativeWindows{
 public delegate bool Callback(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb,IntPtr p);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int count);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder s,int count);
 public static List<IntPtr> Windows(){var a=new List<IntPtr>();EnumWindows((h,p)=>{a.Add(h);return true;},IntPtr.Zero);return a;}
}
'@
}
$dir=Join-Path $env:USERPROFILE '.fox-live2d'
$result=@()
foreach($h in [FoxNativeWindows]::Windows()){
 $ownerPid=[uint32]0;[FoxNativeWindows]::GetWindowThreadProcessId($h,[ref]$ownerPid)|Out-Null
 if($ownerPid -notin @(28164,34384) -or ![FoxNativeWindows]::IsWindowVisible($h)){continue}
 $r=New-Object FoxInput+RECT;[FoxInput]::GetWindowRect($h,[ref]$r)|Out-Null
 $width=$r.Right-$r.Left;$height=$r.Bottom-$r.Top
 if($width -le 0 -or $height -le 0 -or $width -gt 8000 -or $height -gt 8000){continue}
 $title=New-Object Text.StringBuilder 512;[FoxNativeWindows]::GetWindowText($h,$title,512)|Out-Null
 $class=New-Object Text.StringBuilder 128;[FoxNativeWindows]::GetClassName($h,$class,128)|Out-Null
 $im=New-Object Drawing.Bitmap($width,$height);$g=[Drawing.Graphics]::FromImage($im);$dc=$g.GetHdc()
 $ok=[FoxSnapshot]::PrintWindow($h,$dc,2);$g.ReleaseHdc($dc)
 $file="cubism-$($h.ToInt64()).png";$im.Save((Join-Path $dir $file));$g.Dispose();$im.Dispose()
 $result+=@{title=$title.ToString();class=$class.ToString();pid=$ownerPid;hwnd=$h.ToInt64();x=$r.Left;y=$r.Top;width=$width;height=$height;file=$file;captured=$ok}
}
ConvertTo-Json -InputObject $result -Depth 4|Set-Content -Encoding UTF8 (Join-Path $dir 'cubism-windows.json')
