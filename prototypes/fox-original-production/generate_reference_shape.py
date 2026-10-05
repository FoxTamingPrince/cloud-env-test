"""Generate original geometry from the user's fox reference; no stock character meshes."""
import os,time,json,hashlib
from pathlib import Path
os.environ.setdefault('HF_HOME','/var/lib/zhangyanbo-local/fox3d-hf')
import torch
from PIL import Image
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
ROOT=Path('/home/zhangyanbo/fox-original-3d')
MODEL=Path('/var/lib/zhangyanbo-local/fox3d-model')
checkpoint=MODEL/'hunyuan3d-dit-v2-0/model.fp16.safetensors'
if not checkpoint.exists() or checkpoint.stat().st_size != 4928151562:
    raise RuntimeError('Model download is incomplete; do not start GPU inference')
with checkpoint.open('rb') as stream:
    digest=hashlib.file_digest(stream,'sha256').hexdigest()
if digest != '360bc281fc956d4acac0c3d36d5ec0ebf8cdddbf4b8892e894d12419388d479b':
    raise RuntimeError('Checkpoint checksum differs from official download metadata')
free,total=torch.cuda.mem_get_info()
if free < 8*1024**3: raise RuntimeError('Insufficient free GPU memory; existing workloads left untouched')
torch.cuda.set_per_process_memory_fraction(.45)
image=Image.open(ROOT/'fox-reference.png').convert('RGBA')
pipeline=Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(str(MODEL),subfolder='hunyuan3d-dit-v2-0',variant='fp16',use_safetensors=True)
start=time.monotonic()
mesh=pipeline(image=image,num_inference_steps=50,octree_resolution=384,num_chunks=10000,generator=torch.manual_seed(23),output_type='trimesh')[0]
mesh.export(ROOT/'fox-reference-shape.glb')
mesh.export(ROOT/'fox-reference-shape.ply')
(ROOT/'generation-report.json').write_text(json.dumps({'source':'fox-reference.png','seed':23,'vertices':len(mesh.vertices),'faces':len(mesh.faces),'generation_seconds':round(time.monotonic()-start,2),'textured':False,'rigged':False}))
print('FOX_SHAPE_GENERATED',flush=True)
