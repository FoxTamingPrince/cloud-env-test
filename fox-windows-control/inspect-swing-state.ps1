[Console]::OutputEncoding=[Text.Encoding]::UTF8
$d=Join-Path $env:USERPROFILE '.fox-live2d'
$r=@{}
foreach($n in @('swing-bootstrap.json','swing-control\ready.json','swing-control\result.json')){ $p=Join-Path $d $n;if(Test-Path $p){$r[$n]=Get-Content -Raw -Encoding UTF8 $p}}
$p=Join-Path $d 'swing-build.log';if(Test-Path $p){$r['log']=Get-Content -Tail 20 -Encoding UTF8 $p}
$p=Join-Path $d 'model-v5-20261004-101410\fox-live2d\fox-live2d-v5.cmo3';$f=Get-Item $p;$r['model']=@{bytes=$f.Length;modified=$f.LastWriteTimeUtc}
$r|ConvertTo-Json -Depth 8 -Compress
