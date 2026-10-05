"""Fetch verified model weights with independently validated HTTP byte ranges."""
import concurrent.futures, hashlib, os, subprocess
from pathlib import Path

URL='https://modelscope.cn/models/Tencent-Hunyuan/Hunyuan3D-2/resolve/master/hunyuan3d-dit-v2-0/model.fp16.safetensors'
SIZE=4928151562
SHA='360bc281fc956d4acac0c3d36d5ec0ebf8cdddbf4b8892e894d12419388d479b'
ROOT=Path('/var/lib/zhangyanbo-local/fox3d-model/hunyuan3d-dit-v2-0')
PARTS=ROOT/'ranges'; PARTS.mkdir(parents=True,exist_ok=True)
N=12; chunk=(SIZE+N-1)//N

def fetch(i):
    start=i*chunk; end=min(SIZE,(i+1)*chunk)-1
    target=PARTS/str(i)
    if target.exists() and target.stat().st_size==end-start+1: return target
    temp=PARTS/(str(i)+'.partial')
    prefix=temp.stat().st_size if temp.exists() else 0
    if prefix>end-start+1: raise RuntimeError(f'Oversized partial range {i}')
    if prefix==end-start+1:
        temp.replace(target)
        return target
    remainder=PARTS/(str(i)+'.remainder')
    subprocess.run(['curl','-fsSL','--retry','4','--connect-timeout','20',
        '--speed-time','60','--speed-limit','1024',
        '--range',f'{start+prefix}-{end}',URL,'-o',str(remainder)],check=True)
    if remainder.stat().st_size!=end-start+1-prefix:
        raise RuntimeError(f'Wrong remaining byte count for range {i}')
    with temp.open('ab') as output, remainder.open('rb') as source:
        while data:=source.read(8*1024*1024): output.write(data)
    remainder.unlink()
    if temp.stat().st_size!=end-start+1: raise RuntimeError(f'Wrong byte count for range {i}')
    temp.replace(target); print(f'RANGE_DONE {i+1}/{N}',flush=True)
    return target

with concurrent.futures.ThreadPoolExecutor(max_workers=N) as pool:
    paths=list(pool.map(fetch,range(N)))
combined=ROOT/'model.verified.tmp'; digest=hashlib.sha256()
with combined.open('wb') as output:
    for path in paths:
        with path.open('rb') as source:
            while data:=source.read(8*1024*1024):
                output.write(data); digest.update(data)
if combined.stat().st_size!=SIZE or digest.hexdigest()!=SHA:
    raise RuntimeError('Official checkpoint checksum mismatch; destination not replaced')
os.replace(combined,ROOT/'model.fp16.safetensors')
print('CHECKPOINT_VERIFIED',flush=True)
