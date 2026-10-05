$model='C:\Users\zhangyanbo\.fox-live2d\model-v5-20261004-101410\fox-live2d\fox-live2d-v5.cmo3'
if(!(Test-Path $model)){throw 'Fox model missing'}
Start-Process -FilePath $model
