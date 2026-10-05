if(-not ('FoxToken' -as [type])){
Add-Type @'
using System;using System.Runtime.InteropServices;
public class FoxToken{
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr OpenProcess(uint a,bool inherit,uint pid);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr p,uint a,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool GetTokenInformation(IntPtr token,int info,IntPtr buf,int size,out int required);
 [DllImport("advapi32.dll")]static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);
 [DllImport("advapi32.dll")]static extern IntPtr GetSidSubAuthority(IntPtr sid,uint index);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr h);
 public static int Integrity(uint pid){IntPtr p=OpenProcess(4096,false,pid);if(p==IntPtr.Zero)return -Marshal.GetLastWin32Error();IntPtr t;if(!OpenProcessToken(p,8,out t)){CloseHandle(p);return -Marshal.GetLastWin32Error();}int n;GetTokenInformation(t,25,IntPtr.Zero,0,out n);IntPtr b=Marshal.AllocHGlobal(n);try{if(!GetTokenInformation(t,25,b,n,out n))return -Marshal.GetLastWin32Error();IntPtr sid=Marshal.ReadIntPtr(b);byte c=Marshal.ReadByte(GetSidSubAuthorityCount(sid));return Marshal.ReadInt32(GetSidSubAuthority(sid,(uint)c-1));}finally{Marshal.FreeHGlobal(b);CloseHandle(t);CloseHandle(p);}}
}
'@
}
$cursor=New-Object FoxDpi+POINT;[FoxDpi]::GetCursorPos([ref]$cursor)|Out-Null
@{workerPid=$PID;workerIntegrity=[FoxToken]::Integrity($PID);editorIntegrity=[FoxToken]::Integrity(28164);foreground=([FoxInput]::GetForegroundWindow()).ToInt64();cursor=$cursor;cursorWindow=([FoxDpi]::WindowFromPoint($cursor)).ToInt64()}|ConvertTo-Json -Depth 3|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\input-integrity.json')
