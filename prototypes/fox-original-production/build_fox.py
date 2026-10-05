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
for p,s in [((0,.23,1.35),(.29,.73,.40)),((0,-.22,1.69),(.265,.30,.44)),((0,-.25,1.94),(.29,.27,.32))]:parts.append(ell('Sculpt mass',p,s,rust))
for side in [-1,1]:
 x=side*.265
 for p,s in [((x,.61,1.01),(.155,.22,.29)),((x,.68,.65),(.09,.10,.29)),((x,.58,.29),(.067,.075,.22)),((x,.49,.09),(.10,.17,.075)),((x,-.25,1.02),(.09,.095,.42)),((x,-.28,.58),(.066,.073,.30)),((x,-.34,.22),(.063,.075,.18)),((x,-.41,.075),(.095,.17,.075))]:parts.append(ell('Sculpt mass',p,s,rust))
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
# Original longitudinal sculpt: continuous brow, cheek, bridge and tapered muzzle.
# Each profile sets depth, lateral width, upper contour and lower contour.
profiles=[(-.635,.04,-.035,-.09),(-.55,.105,.015,-.135),(-.40,.16,.09,-.155),(-.27,.245,.23,-.19),(-.10,.365,.36,-.23),(.08,.325,.39,-.24),(.25,.20,.25,-.18),(.32,.012,.06,.015)]
verts=[];faces=[];radial=64;segments=70
def cat(a,b,c,d,t):return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
for j in range(segments+1):
 u=j/segments*(len(profiles)-1);k=min(len(profiles)-2,int(u));t=u-k
 pr=[cat(profiles[max(0,k-1)][q],profiles[k][q],profiles[k+1][q],profiles[min(len(profiles)-1,k+2)][q],t) for q in range(4)]
 y,w,top,bottom=pr;center=(top+bottom)/2;height=(top-bottom)/2
 for i in range(radial):
  theta=i/radial*math.pi*2;x=w*math.cos(theta);z=center+height*math.sin(theta)
  # Sculpt shallow eye sockets and flatten the transition at the brow.
  socket=math.exp(-((abs(x)-.215)/.075)**2-((z-.14)/.065)**2-((y+.23)/.13)**2)
  x*=1-.055*socket
  verts.append((x,y+.018*socket,z))
for j in range(segments):
 for i in range(radial):
  a=j*radial+i;b=j*radial+(i+1)%radial;faces.append((a+radial,b+radial,b,a))
faces.extend([tuple(range(radial-1,-1,-1)),tuple(segments*radial+i for i in range(radial))])
mesh=bpy.data.meshes.new('Original fox facial topology');mesh.from_pydata(verts,[],faces);mesh.update();face=bpy.data.objects.new('Face',mesh);bpy.context.collection.objects.link(face);face.parent=head
for poly in mesh.polygons:poly.use_smooth=True
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
  u=j/rows;z=.28+.60*u;cx=side*(.24+.20*u);w=.175*(1-u)**.7+.003
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
 sol=o.modifiers.new('Ear thickness','SOLIDIFY');sol.thickness=.06;me.materials.append(rust);sol.material_offset=1;sol.material_offset_rim=1
 sub=o.modifiers.new('Ear smooth','SUBSURF');sub.levels=2
 for p in me.polygons:p.use_smooth=True
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 for modifier in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
 return o
ears=[]
for side in [-1,1]:
 ears.append(ear(side))
 # Dark almond sockets with warm eyes; pupil lies just in front of cornea.
 eye=ell('Eye.L' if side<0 else 'Eye.R',(side*.205,-.29,.14),(.073,.018,.044),black,head)
 ell('Iris',(side*.205,-.307,.14),(.034,.009,.037),amber,head)
 ell('Pupil',(side*.205,-.315,.14),(.020,.007,.033),black,head)
 ell('Catchlight',(side*.19,-.321,.154),(.010,.007,.011),shine,head)
# Original eyelid rims and fine whiskers integrate the eye and muzzle volumes.
def curve(name,points,radius,material,parent):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=radius;c.bevel_resolution=2
 sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,p in zip(sp.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.parent=parent;c.materials.append(material);return o
for side in [-1,1]:
 x=side*.205
 curve('Upper eyelid',[(x-.07,-.29,.135),(x,-.305,.18),(x+.067,-.29,.15)],.009,rust,head)
 curve('Lower eyelid',[(x-.065,-.29,.135),(x,-.304,.10),(x+.063,-.29,.145)],.005,black,head)
 for i in range(4):
  curve('Whisker',[(side*.13,-.47,-.04-i*.014),(side*.32,-.48-i*.015,-.015-i*.023),(side*(.46+i*.025),-.40-i*.035,.02-i*.037)],.0012,cream,head)
# Sculpted tail rings with carefully tapered radius and curved centerline.
verts=[];faces=[];N=64;K=32
def tail_center(u):return Vector((1.15*math.sin(u*1.3),.75*u,-.12*math.sin(math.pi*u)+.65*u*u))
for j in range(N+1):
 u=j/N;center=tail_center(u);tangent=(tail_center(min(1,u+.001))-tail_center(max(0,u-.001))).normalized()
 normal=tangent.cross(Vector((0,0,1))).normalized();binormal=tangent.cross(normal).normalized()
 radius=.025+.30*math.sin(math.pi*u)**.75
 if j==N:radius=.001
 for i in range(K):
  angle=i/K*2*math.pi;v=center+radius*(normal*math.cos(angle)+binormal*math.sin(angle));verts.append(tuple(v))
for j in range(N):
 for i in range(K):
  a=j*K+i;b=j*K+(i+1)%K;faces.append((a,b,b+K,a+K))
faces.extend([tuple(range(K-1,-1,-1)),tuple(N*K+i for i in range(K))])
me=bpy.data.meshes.new('Tail mesh');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('TailCoat',me);bpy.context.collection.objects.link(o);o.parent=tail;o.data.materials.append(rust);o.data.materials.append(cream)
# Recalculate the closed tail's outward normals before grooming.
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
for p in me.polygons:p.use_smooth=True;p.material_index=1 if p.center.y>.50 else 0
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
