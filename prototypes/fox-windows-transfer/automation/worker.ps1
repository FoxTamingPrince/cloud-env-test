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
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type @'
using System;using System.Runtime.InteropServices;
public class FoxSnapshot{[DllImport("user32.dll")]public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);}
'@

$ErrorActionPreference='Stop'
$control=Join-Path $env:USERPROFILE '.fox-live2d\control'
[IO.Directory]::CreateDirectory($control)|Out-Null
@{pid=$PID;started=(Get-Date).ToString('o')}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $control 'worker.json')
$last=''
$until=(Get-Date).AddMinutes(15)
while((Get-Date) -lt $until){
 try{
  $requestPath=Join-Path $control 'request.json'
  if(Test-Path $requestPath){
   $req=Get-Content -Raw -Encoding UTF8 $requestPath|ConvertFrom-Json
   if($req.id -and $req.id -ne $last){
    $last=$req.id
    if($req.id -notmatch '^[a-zA-Z0-9-]+$'){throw 'Invalid request ID'}
    if($req.action -eq 'stop'){break}
    $started=(Get-Date).ToString('o')
    try{
     $body=Get-Content -Raw -Encoding UTF8 (Join-Path $control 'command.ps1')
     & ([ScriptBlock]::Create($body))|Out-Null
     $result=@{id=$req.id;ok=$true;started=$started;ended=(Get-Date).ToString('o')}
    }catch{$result=@{id=$req.id;ok=$false;error=$_.Exception.Message;started=$started;ended=(Get-Date).ToString('o')}}
    $result|ConvertTo-Json -Depth 4|Set-Content -Encoding UTF8 (Join-Path $control 'result.json')
    $until=(Get-Date).AddMinutes(15)
   }
  }
 }catch{}
 Start-Sleep -Milliseconds 200
}
