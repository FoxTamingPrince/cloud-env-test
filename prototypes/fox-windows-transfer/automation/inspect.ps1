Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type @'
using System;using System.Runtime.InteropServices;
public class FoxSnapshot{[DllImport("user32.dll")]public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);}
'@
$dir=Join-Path $env:USERPROFILE '.fox-live2d'
$root=[System.Windows.Automation.AutomationElement]::RootElement
$windows=$root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$result=@()
foreach($w in $windows){
 if($w.Current.ProcessId -notin @(34384,28164)){continue}
 $r=$w.Current.BoundingRectangle
 if($r.Width -le 0 -or $r.Height -le 0){continue}
 $h=$w.Current.NativeWindowHandle
 $im=New-Object Drawing.Bitmap([int]$r.Width,[int]$r.Height)
 $g=[Drawing.Graphics]::FromImage($im);$dc=$g.GetHdc()
 $ok=[FoxSnapshot]::PrintWindow([IntPtr]$h,$dc,2)
 $g.ReleaseHdc($dc);$file="cubism-$h.png"
 $im.Save((Join-Path $dir $file));$g.Dispose();$im.Dispose()
 $result+=@{title=$w.Current.Name;pid=$w.Current.ProcessId;hwnd=$h;x=$r.X;y=$r.Y;width=$r.Width;height=$r.Height;file=$file;captured=$ok}
}
ConvertTo-Json -InputObject $result -Depth 4|Set-Content -Encoding UTF8 (Join-Path $dir 'cubism-windows.json')
