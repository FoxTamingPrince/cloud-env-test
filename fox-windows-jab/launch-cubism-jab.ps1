param(
    [Parameter(Mandatory=$true)] [string]$LauncherPath,
    [string]$LauncherArguments = ''
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $LauncherPath -PathType Leaf)) { throw 'LauncherPath does not exist.' }
$launcher = (Resolve-Path -LiteralPath $LauncherPath).Path
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.UseShellExecute = $false
$psi.WorkingDirectory = Split-Path -LiteralPath $launcher
if ([IO.Path]::GetExtension($launcher) -in @('.bat','.cmd')) {
    $psi.FileName = $env:ComSpec
    $psi.Arguments = '/d /s /c ""' + $launcher + '" ' + $LauncherArguments + '"'
} else {
    $psi.FileName = $launcher
    $psi.Arguments = $LauncherArguments
}
$option = '-Djavax.accessibility.assistive_technologies=com.sun.java.accessibility.AccessBridge'
$psi.EnvironmentVariables['JAVA_TOOL_OPTIONS'] =
    (($psi.EnvironmentVariables['JAVA_TOOL_OPTIONS'] + ' ' + $option).Trim())
$process = [Diagnostics.Process]::Start($psi)
@{pid=$process.Id;launcher=$launcher;scope='new-process-and-children'} | ConvertTo-Json -Compress
