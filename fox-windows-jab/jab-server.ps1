param(
    [string]$DllPath = 'C:\Program Files\Live2D Cubism 5.3\app\jre\bin\windowsaccessbridge-64.dll'
)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -Path (Join-Path $PSScriptRoot 'JabController.cs')
$controller = New-Object -TypeName FoxJab.Controller -ArgumentList $DllPath

function Get-Hwnd($value) {
    if ($value -is [string] -and $value.StartsWith('0x')) {
        return [Convert]::ToInt64($value.Substring(2), 16)
    }
    return [long]$value
}
function Get-Expectation($request) {
    if ($null -eq $request.expect -or
        $request.expect.PSObject.Properties.Name -notcontains 'name' -or
        $request.expect.PSObject.Properties.Name -notcontains 'role') {
        throw 'Mutation requires expect.name and expect.role from the latest tree snapshot.'
    }
    $rect = $null
    if ($null -ne $request.expect.rect) { $rect = [int[]]$request.expect.rect }
    return @{ name=[string]$request.expect.name; role=[string]$request.expect.role; rect=$rect }
}
try {
    [Console]::WriteLine((@{ok=$true;ready=$true;api='OpenJDK17-public-JAB-x64'} | ConvertTo-Json -Compress))
    while ($null -ne ($line = [Console]::ReadLine())) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $request = $null
        try {
            $request = $line | ConvertFrom-Json
            $hwnd = Get-Hwnd $request.hwnd
            $pidValue = [uint32]$request.pid
            $path = [string]$request.path
            switch ([string]$request.op) {
                'windows' { $result = $controller.Windows($pidValue) }
                'tree' {
                    $depth = 16; $nodes = 1500
                    if ($null -ne $request.maxDepth) { $depth = [int]$request.maxDepth }
                    if ($null -ne $request.maxNodes) { $nodes = [int]$request.maxNodes }
                    $result = $controller.Tree($hwnd,$pidValue,$path,[bool]$request.text,$depth,$nodes)
                }
                'node' { $result = $controller.Tree($hwnd,$pidValue,$path,[bool]$request.text,0,1) }
                'setText' {
                    if ($request.PSObject.Properties.Name -notcontains 'text') { throw 'setText requires an explicit text property.' }
                    $expect = Get-Expectation $request
                    $result = $controller.SetText($hwnd,$pidValue,$path,$expect.name,$expect.role,$expect.rect,[string]$request.text)
                }
                'action' {
                    $expect = Get-Expectation $request
                    $result = $controller.Action($hwnd,$pidValue,$path,$expect.name,$expect.role,$expect.rect,[string]$request.action)
                }
                'select' {
                    if ($request.PSObject.Properties.Name -notcontains 'index') { throw 'select requires an explicit child index.' }
                    $expect = Get-Expectation $request
                    $result = $controller.Select($hwnd,$pidValue,$path,$expect.name,$expect.role,$expect.rect,[int]$request.index,[bool]$request.clear)
                }
                'quit' { break }
                default { throw 'Unknown op. Use windows, tree, node, setText, action, select, or quit.' }
            }
            if ($request.op -eq 'quit') { break }
            [Console]::WriteLine((@{ok=$true;id=$request.id;result=$result} | ConvertTo-Json -Depth 12 -Compress))
        } catch {
            [Console]::WriteLine((@{ok=$false;id=$request.id;error=$_.Exception.GetBaseException().Message} | ConvertTo-Json -Compress))
        }
    }
} finally { $controller.Close() }
