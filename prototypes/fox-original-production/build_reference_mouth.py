"""Editable volumetric oral cavity and jaw/viseme shape keys on original fox."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'reference-fox-colored.blend'))
fox=bpy.data.objects['ReferenceFox']; bpy.context.view_layer.objects.active=fox
# Carve a shallow physical slit at the original reference's mouth position.
center=Vector((-.369,-.772,.149))
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=center)
cutter=bpy.context.object; cutter.name='Mouth cavity cutter'; cutter.scale=(.047,.046,.009)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.context.view_layer.objects.active=fox
mod=fox.modifiers.new('Physical mouth opening','BOOLEAN'); mod.operation='DIFFERENCE'; mod.solver='EXACT'; mod.object=cutter
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
fox.shape_key_add(name='Basis')
for name,amount,width in [('JawOpen',.034,1),('MouthWide',.012,1.16),('MouthRound',.025,.82)]:
 key=fox.shape_key_add(name=name)
 for v in fox.data.vertices:
  p=v.co; dx=(p.x-center.x)/.077; dz=(p.z-(center.z-.014))/.049; dy=(p.y-center.y)/.10
  weight=math.exp(-2*(dx*dx+dz*dz+dy*dy))
  # Upper lip stays anchored while the lower muzzle moves down.
  lower=max(0,min(1,(center.z+.002-p.z)/.018))
  key.data[v.index].co.z-=amount*weight*lower
  key.data[v.index].co.x+=(p.x-center.x)*(width-1)*weight
# Interior is recessed behind the carved opening, with actual depth.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(center.x,center.y+.030,center.z-.004))
interior=bpy.context.object; interior.name='OralInterior'; interior.scale=(.038,.012,.012)
mat=bpy.data.materials.new('Mouth interior'); mat.diffuse_color=(.027,.009,.009,1); mat.use_nodes=True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.027,.009,.009,1)
mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
interior.data.materials.append(mat)
for f in interior.data.polygons:f.use_smooth=True
bpy.ops.wm.save_as_mainfile(filepath=str(root/'reference-fox-mouth.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'reference-fox-mouth.glb'),export_format='GLB',export_normals=True,export_morph=True)
print('VOLUMETRIC_MOUTH_EXPORTED',flush=True)
