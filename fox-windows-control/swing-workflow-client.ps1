[Console]::OutputEncoding=[Text.Encoding]::UTF8
$ProgressPreference='SilentlyContinue'
$ErrorActionPreference='Stop'
$d=Join-Path $env:USERPROFILE '.fox-live2d\swing9-control'
$ready=Get-Content -Raw -Encoding UTF8 (Join-Path $d 'ready.json')|ConvertFrom-Json
if(!$ready.active -or $ready.pid -ne 40676 -or !(Get-Process -Id 40676 -ErrorAction SilentlyContinue)){throw 'Cubism agent guard differs'}
$plan=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PLAN__'))|ConvertFrom-Json
$cache=@{};$results=New-Object Collections.Generic.List[object]
function Read-Shared($p){$f=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete));$r=New-Object IO.StreamReader($f,[Text.Encoding]::UTF8);try{$r.ReadToEnd()}finally{$r.Dispose()}}
function Invoke-Agent($request,$pending){
 $request.id=[guid]::NewGuid().ToString();$request.pid=40676;$request.runId=$ready.runId
 $raw=$request|ConvertTo-Json -Depth 30 -Compress;$p=Join-Path $d 'request.json';$tmp=Join-Path $d ($request.id+'.tmp')
 [IO.File]::WriteAllText($tmp,$raw,(New-Object Text.UTF8Encoding($false)))
 if([IO.File]::Exists($p)){[IO.File]::Replace($tmp,$p,($p+'.previous'))}else{[IO.File]::Move($tmp,$p)}
 $out=Join-Path $d ('receipts\'+$request.id+'.json');$until=(Get-Date).AddSeconds(20)
 while((Get-Date)-lt $until){if(Test-Path $out){$receipt=(Read-Shared $out)|ConvertFrom-Json;if($receipt.id -eq $request.id){
  if($receipt.state -eq 'completed'){return $receipt.response}
  if($pending -and $receipt.state -in @('claimed','executing')){return $receipt.response}
  if($receipt.state -eq 'canceled'){throw ('Request canceled '+$request.id)}
 }};Start-Sleep -Milliseconds 120}
 throw ('Unconfirmed UUID '+$request.id+'; no replay')
}
try {
 foreach($step in $plan){
  $req=@{op=$step.op};$summary=@{op=$step.op}
  if($step.op -eq 'windows'){}
  elseif($step.op -eq 'tree'){
   $wins=Invoke-Agent @{op='windows'} $false
   if(!$wins.ok){throw 'Windows inventory failed'}
   $win=@($wins.result|Where-Object {$_.windowTitle -eq $step.windowTitle -and $_.showing -and ($null -eq $step.modal -or $_.modal -eq $step.modal)})
   if($win.Count -ne 1){throw 'Showing window title is absent or ambiguous'}
   $req.windowId=$win[0].windowId;$req.windowTitle=$step.windowTitle;$req.path=[string]$step.path
   $req.maxDepth=if($step.maxDepth){$step.maxDepth}else{45};$req.maxNodes=if($step.maxNodes){$step.maxNodes}else{5000}
  } elseif($step.from){
   $snap=$cache[$step.from];if(!$snap){throw 'Missing snapshot'}
   $nodes=@($snap.nodes|Where-Object {
    (!$step.selector.path -or $_.path -eq $step.selector.path) -and
    (!$step.selector.nodeId -or $_.nodeId -eq $step.selector.nodeId) -and
    ($null -eq $step.selector.name -or $_.name -eq $step.selector.name) -and
    (!$step.selector.role -or $_.role -eq $step.selector.role) -and
    (!$step.selector.description -or $_.description -eq $step.selector.description)
   })
   if($nodes.Count -ne 1){throw ('Selector absent/ambiguous: '+($step.selector|ConvertTo-Json -Compress))}
   $n=$nodes[0]
   if($step.op -eq 'assert'){
    if($n.text -ne $step.text){throw ('UI assertion differs: '+$n.text+' expected '+$step.text)}
    $results.Add(@{op='assert';text=$n.text;passed=$true});continue
   }
   $req.windowId=$snap.windowId;$req.windowTitle=$snap.windowTitle;$req.path=$n.path
   $req.expect=@{nodeId=$n.nodeId;name=$n.name;role=$n.role;bounds=$n.bounds}
   $summary.name=$n.name;$summary.path=$n.path
   if($step.ensureValue -ne $null -and $n.value -eq $step.ensureValue){$summary.skipped='Already desired value';$results.Add($summary);continue}
   foreach($k in @('text','action','value','expectCurrent','x','y','clickCount','points','modifiers','row','all')){
    if($step.PSObject.Properties.Name -contains $k){$req[$k]=$step.$k}
   }
  } else {throw 'Unsupported workflow step'}
  if($step.op -eq 'number'){
   $ids=New-Object Collections.Generic.List[string]
   $numeric=0.0;if(![double]::TryParse([string]$step.text,[Globalization.NumberStyles]::Float,[Globalization.CultureInfo]::InvariantCulture,[ref]$numeric) -or [double]::IsInfinity($numeric) -or [double]::IsNaN($numeric)){throw 'Explicit finite number required'}
   $req.op='click';$req.Remove('text');$clicked=Invoke-Agent $req $false;$ids.Add($clicked.id);if(!$clicked.ok){throw ($clicked|ConvertTo-Json -Compress -Depth 8)}
   Start-Sleep -Milliseconds 160
   $parent=$n.path.Substring(0,$n.path.LastIndexOf('/'))
   $read=@{op='tree';windowId=$snap.windowId;windowTitle=$snap.windowTitle;path=$parent;maxDepth=3;maxNodes=40}
   $editor=Invoke-Agent $read $false;$ids.Add($editor.id)
   $fields=@($editor.result.nodes|Where-Object {$_.role -eq 'text' -and $_.showing})
   if($fields.Count -ne 1){throw 'Numeric editor did not expose exactly one public text field'}
   $f=$fields[0];$before=$f.text
   $fieldRequest=@{op='setText';windowId=$snap.windowId;windowTitle=$snap.windowTitle;path=$f.path;expect=@{nodeId=$f.nodeId;name=$f.name;role=$f.role;bounds=$f.bounds};text=[string]$step.text}
   $set=Invoke-Agent $fieldRequest $false;$ids.Add($set.id);if(!$set.ok){throw ($set|ConvertTo-Json -Compress -Depth 8)}
   $verify=Invoke-Agent $read $false;$ids.Add($verify.id);$f=@($verify.result.nodes|Where-Object {$_.role -eq 'text' -and $_.showing})[0]
   if($f.text -ne [string]$step.text){throw 'Numeric editor text differs before Enter'}
   $commit=@{op='asyncAction';windowId=$snap.windowId;windowTitle=$snap.windowTitle;path=$f.path;expect=@{nodeId=$f.nodeId;name=$f.name;role=$f.role;bounds=$f.bounds};action='notify-field-accept'}
   $done=Invoke-Agent $commit $false;$ids.Add($done.id);if(!$done.ok){throw ($done|ConvertTo-Json -Compress -Depth 8)}
   Start-Sleep -Milliseconds 160
   $final=Invoke-Agent $read $false;$ids.Add($final.id)
   if(@($final.result.nodes|Where-Object {$_.role -eq 'text' -and $_.showing}).Count){throw 'Numeric editor remained open after Enter'}
   $labels=@($final.result.nodes|Where-Object {$_.role -eq 'label' -and $_.showing})
   if($labels.Count -ne 1 -or [double]::Parse($labels[0].name,[Globalization.CultureInfo]::InvariantCulture) -ne $numeric){throw 'Committed numeric label differs'}
   $summary.result=@{before=$before;requested=[string]$step.text;labelAfter=$labels[0].name;operationIds=$ids};$results.Add($summary);continue
  }
  if($step.op -eq 'setValue' -and !$req.ContainsKey('expectCurrent')){$req.expectCurrent=$n.value}
  $response=Invoke-Agent $req ([bool]$step.pendingOk)
  if(!$response.ok){throw ($response|ConvertTo-Json -Depth 12 -Compress)}
  if($step.save){$cache[$step.save]=$response.result}
  if($step.op -eq 'tree'){$summary.nodes=$response.result.nodes.Count;$summary.nodeDetails=$response.result.nodes;
    $summary.numeric=@($response.result.nodes|Where-Object {$_.role -eq 'label' -and $_.showing -and $_.name -match '^[0-9.+-]+$'}|ForEach-Object {@{nodeId=$_.nodeId;name=$_.name;enabled=$_.enabled;screenBounds=$_.screenBounds}});$summary.interesting=@($response.result.nodes|Where-Object {$_.role -eq 'text' -and $_.showing -and $_.bounds[2] -gt 1 -or $_.description -eq '顶点信息'}|ForEach-Object {@{nodeId=$_.nodeId;path=$_.path;role=$_.role;name=$_.name;text=$_.text}})
  } elseif($step.op -eq 'windows'){$summary.result=$response.result}
  else{$summary.result=$response.result}
  if($step.settleMs){if($step.settleMs -gt 1500){throw 'Settle bound'};Start-Sleep -Milliseconds $step.settleMs};$summary.id=$response.id;$summary.status=$response.status;$results.Add($summary)
 }
 @{ok=$true;steps=$results}|ConvertTo-Json -Depth 20 -Compress|ForEach-Object {[Console]::WriteLine($_)}
 exit 0
} catch {
 @{ok=$false;error=$_.Exception.Message;steps=$results}|ConvertTo-Json -Depth 20 -Compress|ForEach-Object {[Console]::WriteLine($_)}
 exit 1
}
