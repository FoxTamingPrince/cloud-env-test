"""Finish this single image-to-shape job after its existing download completes."""
import os, subprocess, time
from pathlib import Path

ROOT=Path('/home/zhangyanbo/fox-original-3d')
CHECKPOINT=Path('/var/lib/zhangyanbo-local/fox3d-model/hunyuan3d-dit-v2-0/model.fp16.safetensors')
PYTHON='/home/zhangyanbo/owner/xiaowangzi/projects/fox-engineering/projects/model-service/.venvs/vibevoice/bin/python'
deadline=time.monotonic()+3600
while not CHECKPOINT.exists() or CHECKPOINT.stat().st_size!=4928151562:
    if time.monotonic()>deadline: raise RuntimeError('Download wait expired; inference not started')
    print('WAITING_FOR_VERIFIED_DOWNLOAD',flush=True)
    time.sleep(30)
rows=subprocess.check_output(['nvidia-smi','--query-gpu=index,memory.free','--format=csv,noheader,nounits'],text=True)
devices=[tuple(map(int,row.split(','))) for row in rows.strip().splitlines()]
device,free=max(devices,key=lambda row:row[1])
if free<12000: raise RuntimeError('No GPU has 12GB free; existing workloads left untouched')
env=os.environ.copy()
env['CUDA_VISIBLE_DEVICES']=str(device)
env['PYTHONPATH']=str(ROOT/'extras')+':'+str(ROOT/'Hunyuan3D-2')
env['HF_HUB_OFFLINE']='1'
print(f'STARTING_SHAPE GPU={device} FREE_MIB={free}',flush=True)
subprocess.run([PYTHON,'-u',str(ROOT/'generate_reference_shape.py')],cwd=ROOT/'Hunyuan3D-2',env=env,check=True)
print('SHAPE_JOB_COMPLETE',flush=True)
