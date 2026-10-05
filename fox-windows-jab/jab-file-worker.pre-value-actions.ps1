param(
    [string]$DllPath = 'C:\Program Files\Live2D Cubism 5.3\app\jre\bin\windowsaccessbridge-64.dll',
    [string]$ControlDirectory = (Join-Path $env:USERPROFILE '.fox-live2d\jab-control')
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$requestPath = Join-Path $ControlDirectory 'request.json'
$resultPath = Join-Path $ControlDirectory 'result.json'
$readyPath = Join-Path $ControlDirectory 'ready.json'
$receiptDirectory = Join-Path $ControlDirectory 'receipts'
$controller = $null
$mutex = $null
$ownsMutex = $false
$stopReason = 'idle'
$startedUtc = [DateTime]::UtcNow

function Write-AtomicJson([string]$Path, $Value) {
    $temporary = $Path + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    try {
        $json = $Value | ConvertTo-Json -Depth 16 -Compress
        [IO.File]::WriteAllText($temporary, $json, $utf8)
        if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporary, $Path, $Path + '.previous') }
        else { [IO.File]::Move($temporary, $Path) }
    } finally {
        if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    }
}
function Get-Hash([string]$Text) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($utf8.GetBytes($Text))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
}
function Get-Hwnd($value) {
    if ($value -is [string] -and $value.StartsWith('0x')) { return [Convert]::ToInt64($value.Substring(2), 16) }
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
    return @{name=[string]$request.expect.name;role=[string]$request.expect.role;rect=$rect}
}
function Invoke-JabRequest($request) {
    $hwnd = Get-Hwnd $request.hwnd
    $pidValue = [uint32]$request.pid
    $path = [string]$request.path
    switch ([string]$request.op) {
        'windows' { return ,($controller.Windows($pidValue)) }
        'tree' {
            $depth = 16; $nodes = 1500
            if ($null -ne $request.maxDepth) { $depth = [int]$request.maxDepth }
            if ($null -ne $request.maxNodes) { $nodes = [int]$request.maxNodes }
            return $controller.Tree($hwnd,$pidValue,$path,[bool]$request.text,$depth,$nodes)
        }
        'node' { return $controller.Tree($hwnd,$pidValue,$path,[bool]$request.text,0,1) }
        'setText' {
            if ($request.PSObject.Properties.Name -notcontains 'text') { throw 'setText requires an explicit text property.' }
            $expect = Get-Expectation $request
            return $controller.SetText($hwnd,$pidValue,$path,$expect.name,$expect.role,$expect.rect,[string]$request.text)
        }
        'action' {
            $expect = Get-Expectation $request
            return $controller.Action($hwnd,$pidValue,$path,$expect.name,$expect.role,$expect.rect,[string]$request.action)
        }
        'select' {
            if ($request.PSObject.Properties.Name -notcontains 'index') { throw 'select requires an explicit child index.' }
            $expect = Get-Expectation $request
            return $controller.Select($hwnd,$pidValue,$path,$expect.name,$expect.role,$expect.rect,[int]$request.index,[bool]$request.clear)
        }
        'selectCombo' {
            if ($request.PSObject.Properties.Name -notcontains 'index' -or
                $request.PSObject.Properties.Name -notcontains 'choiceName') { throw 'selectCombo requires explicit index and choiceName properties.' }
            $expect = Get-Expectation $request
            return $controller.SelectCombo($hwnd,$pidValue,$path,$expect.name,$expect.role,$expect.rect,[int]$request.index,[string]$request.choiceName)
        }
        'quit' { return @{accepted=$true;quitting=$true} }
        default { throw 'Unknown op. Use windows, tree, node, setText, action, select, selectCombo, or quit.' }
    }
}

try {
    [IO.Directory]::CreateDirectory($ControlDirectory) | Out-Null
    [IO.Directory]::CreateDirectory($receiptDirectory) | Out-Null
    # One interactive worker per control directory and Windows session.
    $mutexName = 'Local\FoxJabFiles-' + (Get-Hash ([IO.Path]::GetFullPath($ControlDirectory).ToLowerInvariant()))
    $mutex = New-Object -TypeName System.Threading.Mutex -ArgumentList $false,$mutexName
    try { $ownsMutex = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { throw 'A JAB file worker is already running for this control directory.' }

    Add-Type -Path (Join-Path $env:USERPROFILE '.fox-live2d\jab\JabController.cs')
    $controller = New-Object -TypeName FoxJab.Controller -ArgumentList $DllPath
    Write-AtomicJson $readyPath @{
        ok=$true;ready=$true;pid=$PID;startedUtc=$startedUtc.ToString('o');
        api='OpenJDK17-public-JAB-x64';controlDirectory=$ControlDirectory;idleMinutes=20
    }

    $lastActivityUtc = [DateTime]::UtcNow
    $lastRequestHash = $null
    while (([DateTime]::UtcNow - $lastActivityUtc).TotalMinutes -lt 20) {
        if (-not [IO.File]::Exists($requestPath)) { Start-Sleep -Milliseconds 200; continue }
        $request = $null
        $requestId = $null
        $receiptPath = $null
        $claimed = $false
        try {
            $raw = [IO.File]::ReadAllText($requestPath, $utf8)
            $requestHash = Get-Hash $raw
            if ($requestHash -eq $lastRequestHash) { Start-Sleep -Milliseconds 200; continue }
            $lastRequestHash = $requestHash
            $request = $raw | ConvertFrom-Json
            $parsedId = [Guid]::Empty
            if (-not [Guid]::TryParse([string]$request.id, [ref]$parsedId)) { throw 'Each request requires id containing a UUID.' }
            $requestId = $parsedId.ToString('D')
            $receiptPath = Join-Path $receiptDirectory ($requestId + '.json')

            if ([IO.File]::Exists($receiptPath)) {
                # A claim from a crashed/timed-out worker is never executed again.
                try { $old = [IO.File]::ReadAllText($receiptPath, $utf8) | ConvertFrom-Json }
                catch { $old = $null }
                if ($null -ne $old -and $old.requestHash -ne $requestHash) {
                    $response = @{ok=$false;id=$requestId;error='UUID was already used with different request contents.';executed=$false}
                } elseif ($null -ne $old -and $old.state -eq 'completed') {
                    $response = $old.response
                } else {
                    $response = @{ok=$false;id=$requestId;outcome='unknown';executed=$false;error='UUID was already claimed; its outcome is unknown. Inspect before issuing a new request. No retry was attempted.'}
                }
                Write-AtomicJson $resultPath $response
                continue
            }

            # Durable create-before-execute gives at-most-once dispatch, including restart.
            $claim = @{id=$requestId;requestHash=$requestHash;state='claimed';claimedUtc=[DateTime]::UtcNow.ToString('o');workerPid=$PID}
            $bytes = $utf8.GetBytes(($claim | ConvertTo-Json -Compress))
            $stream = New-Object -TypeName System.IO.FileStream -ArgumentList $receiptPath,([IO.FileMode]::CreateNew),([IO.FileAccess]::Write),([IO.FileShare]::None)
            try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) }
            finally { $stream.Dispose() }
            $claimed = $true
            $lastActivityUtc = [DateTime]::UtcNow

            $faulted = $false
            try {
                $result = Invoke-JabRequest $request
                $response = @{ok=$true;id=$requestId;result=$result;completedUtc=[DateTime]::UtcNow.ToString('o')}
            } catch {
                $failure = $_.Exception.GetBaseException()
                $response = @{ok=$false;id=$requestId;error=$failure.Message;errorType=$failure.GetType().FullName;completedUtc=[DateTime]::UtcNow.ToString('o')}
                if ($failure -is [TimeoutException] -or $failure.Message -like '*Controller stopped or timed out*') {
                    $response.outcome = 'unknown'
                    $response.retryAttempted = $false
                    $faulted = $true
                }
            }
            # Persist the terminal response before publishing it to the caller.
            Write-AtomicJson $receiptPath @{
                id=$requestId;requestHash=$requestHash;state='completed';response=$response;workerPid=$PID
            }
            Write-AtomicJson $resultPath $response
            if ($faulted) { $stopReason='faulted'; break }
            if ($request.op -eq 'quit') { $stopReason='requested'; break }
        } catch {
            $failure = $_.Exception.GetBaseException()
            $response = @{ok=$false;id=$requestId;error=$failure.Message;errorType=$failure.GetType().FullName}
            if ($claimed) {
                $response.outcome='unknown'
                $response.retryAttempted=$false
                $stopReason='faulted'
            }
            Write-AtomicJson $resultPath $response
            if ($claimed) { break }
        }
    }
} catch {
    $failure = $_.Exception.GetBaseException()
    # A second worker must not overwrite the active worker's readiness file.
    if ($ownsMutex -or $null -eq $mutex) {
        Write-AtomicJson $readyPath @{ok=$false;ready=$false;pid=$PID;error=$failure.Message;errorType=$failure.GetType().FullName}
        Write-AtomicJson $resultPath @{ok=$false;id=$null;error=$failure.Message;errorType=$failure.GetType().FullName}
    }
    $stopReason='startup-error'
} finally {
    if ($null -ne $controller) { $controller.Close() }
    if ($ownsMutex) {
        if ($stopReason -ne 'startup-error') {
            Write-AtomicJson $readyPath @{ok=$true;ready=$false;stopped=$true;pid=$PID;reason=$stopReason;stoppedUtc=[DateTime]::UtcNow.ToString('o')}
        }
        $mutex.ReleaseMutex()
    }
    if ($null -ne $mutex) { $mutex.Dispose() }
}
