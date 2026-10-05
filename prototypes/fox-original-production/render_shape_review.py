"""Render untextured geometry from three axes for anatomical review.

Blender --background --python render_shape_review.py -- model.glb output_dir
The angles are labelled by axis until the imported fox orientation is inspected.
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]).resolve()
out=Path(args[1]).resolve(); out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
if not meshes: raise RuntimeError('No mesh imported')
corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector(tuple(min(p[i] for p in corners) for i in range(3)))
hi=Vector(tuple(max(p[i] for p in corners) for i in range(3)))
center=(lo+hi)/2; extent=max(hi-lo)
material=bpy.data.materials.new('Neutral clay'); material.diffuse_color=(.44,.36,.29,1)
for obj in meshes:
    obj.data.materials.clear(); obj.data.materials.append(material)
    for poly in obj.data.polygons: poly.use_smooth=True
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=48
scene.render.resolution_x=1100; scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.world.color=(.24,.24,.24)
scene.view_settings.view_transform='AgX'
for name,offset,power,size in [('Key',(-2,-3,4),900,3),('Fill',(3,-1,2),500,4),('Rim',(1,3,3),1100,2)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=power*extent*extent; data.shape='DISK'; data.size=size*extent
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj)
    obj.location=center+Vector(offset)*extent
    obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Review'); camera=bpy.data.objects.new('Review',data)
scene.collection.objects.link(camera); scene.camera=camera
data.type='ORTHO'; data.ortho_scale=extent*1.18
for label,axis in [('negative_y',(0,-1,.08)),('positive_x',(1,0,.08)),('positive_y',(0,1,.08))]:
    camera.location=center+Vector(axis)*extent*3
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(label+'.png'))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'review.blend'))
