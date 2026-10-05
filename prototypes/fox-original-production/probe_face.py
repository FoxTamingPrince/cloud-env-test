import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'reference-fox-colored.blend'))
obj=bpy.data.objects['ReferenceFox']; mesh=obj.data
report=json.loads((root/'coloration-report.json').read_text()); lo,hi=report['bounds']; x0,y0,x1,y1=report['image_alpha_bounds']
bvh=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
result={}
for name,px,py in [('eye_left',336,424),('eye_right',462,468),('nose',367,519),('mouth',374,556)]:
 x=lo[0]+(px-x0)/(x1-x0)*(hi[0]-lo[0]); z=lo[2]+(1305-py-y0)/(y1-y0)*(hi[2]-lo[2])
 hit,normal,index,distance=bvh.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
 result[name]={'surface':list(hit) if hit else None,'normal':list(normal) if normal else None}
(root/'face-landmarks.json').write_text(json.dumps(result,indent=2)); print(json.dumps(result))
