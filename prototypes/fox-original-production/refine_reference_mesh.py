"""Original reference coloration and editable smoothing of generated geometry."""
import bpy, math, json
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'fox-reference-shape.glb'
REFERENCE=ROOT.parent.parent/'work/little-prince-illustration-run/decoded/base.png'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
fox=next(o for o in bpy.context.scene.objects if o.type=='MESH')
fox.name='ReferenceFox'; bpy.context.view_layer.objects.active=fox
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Preserve the generated silhouette while reducing small surface ridges.
smooth=fox.modifiers.new('Surface refinement','SMOOTH'); smooth.factor=.55; smooth.iterations=18
bpy.ops.object.modifier_apply(modifier=smooth.name)
mesh=fox.data
points=np.array([v.co[:] for v in mesh.vertices],dtype=np.float32)
low=points.min(axis=0); high=points.max(axis=0)
image=bpy.data.images.load(str(REFERENCE),check_existing=True)
width,height=image.size
pixels=np.array(image.pixels[:],dtype=np.float32).reshape(height,width,4)
iy,ix=np.nonzero(pixels[:,:,3]>.25)
x0,x1=ix.min(),ix.max(); y0,y1=iy.min(),iy.max()
uv=np.column_stack(((points[:,0]-low[0])/(high[0]-low[0]),(points[:,2]-low[2])/(high[2]-low[2])))
sx=np.clip(np.rint(x0+uv[:,0]*(x1-x0)).astype(int),0,width-1)
sy=np.clip(np.rint(y0+uv[:,1]*(y1-y0)).astype(int),0,height-1)
sample=pixels[sy,sx].copy()
sample[:,:3]=np.where(sample[:,:3]<=.04045,sample[:,:3]/12.92,((sample[:,:3]+.055)/1.055)**2.4)
normals=np.array([v.normal[:] for v in mesh.vertices],dtype=np.float32)
front=np.clip((-normals[:,1]-.03)/.55,0,1)*sample[:,3]
# Back and lateral coat remain orange; reference features only paint front-facing surfaces.
base=np.tile(np.array([.50,.205,.052,1.],dtype=np.float32),(len(points),1))
feet=points[:,2]<low[2]+(high[2]-low[2])*.24
base[feet,:3]=[.058,.041,.026]
tip=(points[:,0]>low[0]+(high[0]-low[0])*.76)&(points[:,2]>low[2]+(high[2]-low[2])*.43)
base[tip,:3]=[.77,.69,.54]
col=base.copy(); col[:,:3]=base[:,:3]*(1-front[:,None])+sample[:,:3]*front[:,None]
attribute=mesh.color_attributes.new(name='OriginalCoat',type='FLOAT_COLOR',domain='POINT')
attribute.data.foreach_set('color',col.ravel())
material=bpy.data.materials.new('Original reference coat'); material.use_nodes=True
nodes=material.node_tree.nodes; shader=nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value=.88
color=nodes.new('ShaderNodeVertexColor'); color.layer_name='OriginalCoat'
material.node_tree.links.new(color.outputs['Color'],shader.inputs['Base Color'])
mesh.materials.clear(); mesh.materials.append(material)
for poly in mesh.polygons: poly.use_smooth=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'reference-fox-colored.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'reference-fox-colored.glb'),export_format='GLB',export_normals=True)
(ROOT/'coloration-report.json').write_text(json.dumps({'reference':str(REFERENCE),'bounds':[low.tolist(),high.tolist()],'image_alpha_bounds':[int(x0),int(y0),int(x1),int(y1)],'vertices':len(points),'rigged':False}))
print('REFERENCE_COLORATION_EXPORTED',flush=True)
