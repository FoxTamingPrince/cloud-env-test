<#
Build Java 17 public-API sources with a supplied JDK. This script only compiles
and packages files; it does not attach to or launch the target application.

Usage:
  .\build-agent.ps1 -JavaHome 'C:\absolute\path\to\jdk-17'

Generated output:
  build\agent\...             Agent classes
  build\launcher\FoxAttach.class
  fox-swing-agent-v9.jar          Agent-Class: fox.agent.FoxSwingAgentV9

The generated class directories are recreated on each build. To submit a
request afterwards, invoke the launcher explicitly with five arguments:
  & "$JavaHome\bin\java.exe" --add-modules jdk.attach -cp .\build\launcher `
      FoxAttach <expectedPid> <expectedJavaHome> <expectedProcessCommand> `
      <absoluteAgentJar> <absoluteConfigPath>

"request submitted" is the launcher's bootstrap acknowledgement. Read the
agent result receipt for operation completion. All example placeholders must
be replaced with real values; config is an absolute JSON file path.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $JavaHome
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not [System.IO.Path]::IsPathRooted($JavaHome)) {
    throw 'JavaHome must be an absolute JDK directory path.'
}
$jdkDirectory = [System.IO.Path]::GetFullPath($JavaHome)
$javacPath = Join-Path $jdkDirectory 'bin\javac.exe'
$jarPath = Join-Path $jdkDirectory 'bin\jar.exe'
foreach ($toolPath in @($javacPath, $jarPath)) {
    if (-not (Test-Path -LiteralPath $toolPath -PathType Leaf)) {
        throw 'The supplied JavaHome must contain javac.exe and jar.exe.'
    }
}

$agentSource = Join-Path $PSScriptRoot 'src\fox\agent\FoxSwingAgentV9.java'
$launcherSource = Join-Path $PSScriptRoot 'FoxAttach.java'
foreach ($sourcePath in @($agentSource, $launcherSource)) {
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw 'Required agent or launcher source is missing.'
    }
}

$buildDirectory = Join-Path $PSScriptRoot 'build'
$agentClasses = Join-Path $buildDirectory 'agent'
$launcherClasses = Join-Path $buildDirectory 'launcher'
$manifestPath = Join-Path $buildDirectory 'agent-manifest.mf'
$agentJarPath = Join-Path $PSScriptRoot 'fox-swing-agent-v9.jar'
$stagedJarPath = Join-Path $buildDirectory 'fox-swing-agent-v9.jar'
foreach ($classDirectory in @($agentClasses, $launcherClasses)) {
    if (Test-Path -LiteralPath $classDirectory) {
        Remove-Item -LiteralPath $classDirectory -Recurse -Force
    }
    New-Item -ItemType Directory -Path $classDirectory -Force | Out-Null
}

& $javacPath --release 17 -encoding UTF-8 -d $agentClasses $agentSource
if ($LASTEXITCODE -ne 0) { throw 'Agent compilation failed.' }
& $javacPath --release 17 --add-modules jdk.attach -encoding UTF-8 -d $launcherClasses $launcherSource
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }

# Agent needs java.desktop and java.instrument, both standard JDK modules.
# Explicitly deny transformation capabilities; no Premain-Class is declared.
$manifest = "Manifest-Version: 1.0`r`nAgent-Class: fox.agent.FoxSwingAgentV9`r`nCan-Redefine-Classes: false`r`nCan-Retransform-Classes: false`r`nCan-Set-Native-Method-Prefix: false`r`n`r`n"
[System.IO.File]::WriteAllText($manifestPath, $manifest, [System.Text.Encoding]::ASCII)
& $jarPath --create --file $stagedJarPath --manifest $manifestPath -C $agentClasses .
if ($LASTEXITCODE -ne 0) { throw 'Agent JAR packaging failed.' }
Move-Item -LiteralPath $stagedJarPath -Destination $agentJarPath -Force
Write-Output "Agent JAR: $agentJarPath"
Write-Output "Launcher classpath: $launcherClasses"
