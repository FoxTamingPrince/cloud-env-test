import bpy, math, random, os
from mathutils import Vector
random.seed(23)
ROOT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,rough=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
rust=mat('Ochre coat',(.48,.16,.035));cream=mat('Ivory fur',(.72,.64,.48));black=mat('Soft charcoal',(.027,.019,.014));nose=mat('Nose',(.016,.012,.009),.33);amber=mat('Amber iris',(.22,.085,.014),.28);shine=mat('Eye glint',(.9,.87,.75),.12);inside=mat('Mouth interior',(.038,.009,.007));tongue=mat('Tongue',(.33,.10,.09))
def empty(name,pos=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos;o.parent=parent;return o
root=empty('OriginalFox');head=empty('Head',(0,-.25,2.05),root);jaw=empty('Jaw',(0,-.16,-.085),head);tail=empty('Tail',(0,.72,1.03),root)
def ell(name,pos,scale,material,parent=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=pos);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 o.parent=parent;return o
# Blender uses Z-up, forward -Y. Original anatomical masses fuse into a continuous sculpt.
parts=[]
for p,s in [((0,.23,1.35),(.35,.68,.53)),((0,-.22,1.69),(.29,.34,.52)),((0,-.25,1.94),(.29,.27,.32))]:parts.append(ell('Sculpt mass',p,s,rust))
for side in [-1,1]:
 x=side*.265
 for p,s in [((x,.61,1.01),(.20,.24,.35)),((x,.68,.65),(.09,.10,.29)),((x,.58,.29),(.067,.075,.22)),((x,.49,.09),(.10,.17,.075)),((x,-.25,1.02),(.09,.095,.42)),((x,-.28,.58),(.066,.073,.30)),((x,-.34,.22),(.063,.075,.18)),((x,-.41,.075),(.095,.17,.075))]:parts.append(ell('Sculpt mass',p,s,rust))
def fuse(items,name,voxel=.032,parent=None):
 bpy.ops.object.select_all(action='DESELECT')
 for o in items:o.select_set(True)
 bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 mod=o.modifiers.new('Continuous anatomy','REMESH');mod.mode='VOXEL';mod.voxel_size=voxel;bpy.ops.object.modifier_apply(modifier=mod.name)
 sm=o.modifiers.new('Sculpt smoothing','SMOOTH');sm.factor=1.1;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
 for p in o.data.polygons:p.use_smooth=True
 o.parent=parent;return o
body=fuse(parts,'Body',.026,root)
faceparts=[]
for p,s in [((0,.025,.12),(.34,.28,.30)),((0,-.22,-.025),(.22,.29,.145)),((0,-.43,-.065),(.125,.22,.095)),((-.27,-.04,-.025),(.17,.20,.13)),((.27,-.04,-.025),(.17,.20,.13))]:faceparts.append(ell('Face mass',p,s,rust))
face=fuse(faceparts,'Face',.018,head)
# Paint transitions in vertex colors, without seams or pasted white cheek geometry.
def coat_color(co,kind):
 x,y,z=co
 base=Vector((.50,.185,.041));iv=Vector((.77,.70,.55));dk=Vector((.033,.023,.018))
 if kind=='body':
  chest=max(0,min(1,(-y-.33)*13))*max(0,1-abs(x)/.24)*max(0,min(1,(z-.68)*4))
  base=base.lerp(iv,chest);base=base.lerp(dk,max(0,min(1,(.49-z)*6)))
 elif kind=='face':
  threshold=.015+abs(x)*.16
  white=max(0,min(1,(threshold-z)*28))*max(0,min(1,(-y+.10)*8));base=base.lerp(iv,white)
 return tuple(base)
def paint(obj,kind):
 a=obj.data.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='CORNER')
 for poly in obj.data.polygons:
  for li in poly.loop_indices:
   co=obj.data.vertices[obj.data.loops[li].vertex_index].co;a.data[li].color=(*coat_color(co,kind),1)
 m=mat(kind+' painted coat',(1,1,1));n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Coat';m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);obj.data.materials.clear();obj.data.materials.append(m)
paint(body,'body');paint(face,'face')
ell('Nose',(0,-.626,-.055),(.074,.049,.043),nose,head)
ell('LowerJaw',(0,-.245,-.042),(.145,.285,.047),cream,jaw);ell('OralCavity',(0,-.26,-.006),(.122,.255,.016),inside,jaw);ell('Tongue',(0,-.35,.006),(.077,.112,.012),tongue,jaw)
# Ears taper with a cupped interior, not extruded flat triangles.
def ear(side):
 verts=[];faces=[];rows=18;cols=18
 for j in range(rows+1):
  u=j/rows;z=.28+.69*u;cx=side*(.245+.18*u);w=.18*(1-u)**.7+.003
  for i in range(cols+1):
   v=i/cols*2-1;verts.append((cx+w*v,.025-.085*(1-v*v)*math.sin(math.pi*u),z))
 for j in range(rows):
  for i in range(cols):
   a=j*(cols+1)+i;faces.append((a,a+1,a+cols+2,a+cols+1))
 me=bpy.data.meshes.new('Ear surface');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Ear.L' if side<0 else 'Ear.R',me);bpy.context.collection.objects.link(o);o.parent=head;o.data.materials.append(rust)
 a=me.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='CORNER')
 for li,loop in enumerate(me.loops):
  j,i=divmod(loop.vertex_index,cols+1);u=j/rows;v=i/cols*2-1
  c=(.72,.64,.48) if abs(v)<.67 and .13<u<.91 else (.48,.16,.035)
  a.data[li].color=(*c,1)
 m=mat('Ear painted',(1,1,1));n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Coat';m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);me.materials.clear();me.materials.append(m)
 sol=o.modifiers.new('Ear thickness','SOLIDIFY');sol.thickness=.027
 sub=o.modifiers.new('Ear smooth','SUBSURF');sub.levels=2
 for p in me.polygons:p.use_smooth=True
 return o
ears=[]
for side in [-1,1]:
 ears.append(ear(side))
 # Dark almond sockets with warm eyes; pupil lies just in front of cornea.
 eye=ell('Eye.L' if side<0 else 'Eye.R',(side*.205,-.227,.14),(.073,.018,.044),black,head)
 ell('Iris',(side*.205,-.244,.14),(.034,.009,.037),amber,head)
 ell('Pupil',(side*.205,-.252,.14),(.020,.007,.033),black,head)
 ell('Catchlight',(side*.19,-.258,.154),(.010,.007,.011),shine,head)
# Original eyelid rims and fine whiskers integrate the eye and muzzle volumes.
def curve(name,points,radius,material,parent):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=radius;c.bevel_resolution=2
 sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,p in zip(sp.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.parent=parent;c.materials.append(material);return o
for side in [-1,1]:
 x=side*.205
 curve('Upper eyelid',[(x-.07,-.233,.135),(x,-.245,.18),(x+.067,-.233,.15)],.009,rust,head)
 curve('Lower eyelid',[(x-.065,-.233,.135),(x,-.244,.10),(x+.063,-.233,.145)],.005,black,head)
 for i in range(4):
  curve('Whisker',[(side*.13,-.47,-.04-i*.014),(side*.32,-.48-i*.015,-.015-i*.023),(side*(.46+i*.025),-.40-i*.035,.02-i*.037)],.0012,cream,head)
# Sculpted tail rings with carefully tapered radius and curved centerline.
verts=[];faces=[];N=48;K=24
for j in range(N+1):
 u=j/N;cx=.12*u+1.0*math.sin(u*1.5);cy=.82*u;cz=-.26*math.sin(u*math.pi)+.45*u*u;r=.045+.27*math.sin(math.pi*u)**.7
 for i in range(K):
  a=i/K*2*math.pi;verts.append((cx+r*math.cos(a),cy,cz+r*math.sin(a)))
for j in range(N):
 for i in range(K):a=j*K+i;b=j*K+(i+1)%K;faces.append((a+K,b+K,b,a))
me=bpy.data.meshes.new('Tail mesh');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('TailCoat',me);bpy.context.collection.objects.link(o);o.parent=tail;o.data.materials.append(rust);o.data.materials.append(cream)
for p in me.polygons:p.use_smooth=True;p.material_index=1 if p.center.y>.55 else 0
# Original geometry fur: tapered ribbons, deterministic, exported as real meshes.
def fur(obj,kind,count,length):
 obj.data.calc_loop_triangles();tris=list(obj.data.loop_triangles);weights=[max(t.area,.000001) for t in tris];vs=[];fs=[];cs=[]
 for tri in random.choices(tris,weights=weights,k=count):
  a,b,c=[obj.data.vertices[i].co for i in tri.vertices];u=random.random();v=random.random()
  if u+v>1:u=1-u;v=1-v
  p=a+(b-a)*u+(c-a)*v;n=tri.normal.normalized();L=length*random.uniform(.55,1.35)
  if kind=='body' and p.z<.55:L*=.35
  if kind=='face' and p.y<-.27:L*=.25
  flow=Vector((p.x*.15,.15,-.75)) if kind!='tail' else Vector((.45,.7,.35));d=(n*.7+flow*.55).normalized();cross=n.cross(d)
  if cross.length<.01:cross=n.cross(Vector((1,0,0)))
  cross.normalize();w=L*.035;start=len(vs);vs.extend([p-cross*w,p+cross*w,p+d*L]);fs.append((start,start+1,start+2))
  color=coat_color(p,kind) if kind!='tail' else ((.77,.70,.55) if p.y>.53 else (.5,.185,.041));factor=random.uniform(.72,1.2);cs.extend([tuple(min(1,x*factor) for x in color)]*3)
 mesh=bpy.data.meshes.new(kind+' groom');mesh.from_pydata(vs,[],fs);mesh.update();f=bpy.data.objects.new(kind+' directional fur',mesh);bpy.context.collection.objects.link(f);f.parent=obj.parent;f.location=obj.location
 colors=mesh.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='CORNER')
 for i,loop in enumerate(mesh.loops):colors.data[i].color=(*cs[loop.vertex_index],1)
 m=mat(kind+' fur material',(1,1,1));m.use_backface_culling=False;n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Coat';m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);mesh.materials.append(m)
fur(body,'body',40000,.045);fur(face,'face',22000,.035);fur(o,'tail',20000,.075)
# Distinct mouth expressions retained in editable source and GLB morph targets.
for obj in [face]:
 obj.shape_key_add(name='Basis')
 for name in ['MouthWide','MouthRound']:
  key=obj.shape_key_add(name=name)
  for v in key.data:
   influence=max(0,min(1,(-v.co.y-.25)*5))*max(0,1-abs(v.co.z+.06)/.20)
   v.co.x*=1+(.15 if name=='MouthWide' else -.12)*influence
   if name=='MouthRound':v.co.y-=.025*influence
# Preview camera and lighting saved separately from exported character.
bpy.ops.object.camera_add(location=(4,-7,3));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.5))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=4.6;bpy.context.scene.camera=camera
for loc,power,size in [((3,-4,6),700,5),((-3,-1,4),450,4),((1,4,5),850,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.world.color=(.3,.3,.3)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'original-fox.blend'))
bpy.ops.object.select_all(action='DESELECT')
def select_tree(o):
 o.select_set(True)
 for c in o.children:select_tree(c)
select_tree(root)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'original-fox.glb'),use_selection=True,export_format='GLB',export_yup=True,export_apply=False,export_morph=True)
print('ORIGINAL_FOX_EXPORTED')
