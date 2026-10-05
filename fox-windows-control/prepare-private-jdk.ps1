try {
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -ne 'MOBILE-COMPUTER'){throw 'Unexpected host'}
$d=Join-Path $env:USERPROFILE '.fox-live2d\tools\jdk17'
New-Item -ItemType Directory -Path $d -Force|Out-Null
$j=Get-ChildItem -LiteralPath $d -Filter javac.exe -Recurse -ErrorAction SilentlyContinue|Select-Object -First 1
if(!$j){
 $zip=Join-Path $d 'corretto17.zip'
 if(!(Test-Path -LiteralPath $zip)){Invoke-WebRequest -Uri 'https://corretto.aws/downloads/latest/amazon-corretto-17-x64-windows-jdk.zip' -OutFile ($zip+'.partial') -UseBasicParsing;Move-Item -LiteralPath ($zip+'.partial') -Destination $zip}
 $v=(Invoke-WebRequest -Uri 'https://corretto.aws/downloads/latest_sha256/amazon-corretto-17-x64-windows-jdk.zip' -UseBasicParsing).Content;if($v -is [byte[]]){$v=[Text.Encoding]::UTF8.GetString($v)};$expected=[regex]::Match([string]$v,'(?i)[0-9a-f]{64}').Value;if($expected.Length -ne 64){throw 'Official checksum response is missing SHA256'};$actual=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
 if($actual -ne $expected){throw 'Official JDK checksum mismatch; no extraction'}
 Expand-Archive -LiteralPath $zip -DestinationPath $d -Force
 $j=Get-ChildItem -LiteralPath $d -Filter javac.exe -Recurse|Select-Object -First 1
}
if(!$j){throw 'javac missing after extraction'}
@{ready=$true;javac=$j.FullName;java=(Join-Path $j.DirectoryName 'java.exe');jar=(Join-Path $j.DirectoryName 'jar.exe')}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\tools\jdk17-ready.json')

} catch { @{ready=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 (Join-Path $env:USERPROFILE '.fox-live2d\tools\jdk17-error.json');throw }
