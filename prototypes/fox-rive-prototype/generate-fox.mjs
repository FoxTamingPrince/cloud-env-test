// Original v5 fox artwork, authored as a script-free Rive raster mesh rig.
// This generates an isolated RML prototype, not a compiled Live2D model.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {tailKeyform,jawKeyform,eyelidKeyform,eyeApertureCurves}
  from '../fox-layered-rig/rig-math.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const project=path.join(here,'fox');
const source=path.join(here,'../fox-layered-rig/fox-v5-parts');
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
const parts=new Map(manifest.parts.map(p=>[p.name,p]));
const round=n=>Number(n.toFixed(5));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;');
let nextId=100;
const id=()=>`0:${nextId++}`;
const meshInfo=new Map(),maskInfo=new Map();
const bodyPivot=[584,1164],headPivot=[584,535];
const bodyId=id(),headId=id();
const idleId=id(),blinkId=id(),eyeClosedId=id(),mouthClosedId=id(),mouthOpenId=id();
const mouthTimelineId=id(),eyeTimelineId=id();
const assetIds=new Map(manifest.parts.map(p=>[p.name,id()]));
const converters=[];
const props={mouthOpen:'0:45',eyeOpen:'0:46',gazeX:'0:47',gazeY:'0:48'};

function tag(type,attributes={},children=[]){
  const attributesText=Object.entries(attributes).filter(([,v])=>v!==undefined)
    .map(([k,v])=>`${k}="${esc(typeof v==='number'?round(v):v)}"`).join(' ');
  const start=`<${type}${attributesText?' '+attributesText:''}`;
  return children.length?`${start}>\n${children.join('\n')}\n</${type}>`:`${start}/>`;
}
function varints(values){
  const bytes=[];
  for(let value of values){
    while(value>=128){bytes.push((value&127)|128);value>>>=7;}
    bytes.push(value);
  }
  return Buffer.from(bytes).toString('base64');
}

// Outer vertices come first, clockwise; interior vertices follow. Image
// positions are asset centres, so mesh coordinates use the same centre.
function gridMesh(part,columns,rows){
  const ordered=[],lookup=new Map();
  const add=(x,y)=>{const key=`${x},${y}`;if(lookup.has(key))return;
    lookup.set(key,ordered.length);ordered.push({x,y});};
  for(let x=0;x<=columns;x++)add(x,0);
  for(let y=1;y<=rows;y++)add(columns,y);
  for(let x=columns-1;x>=0;x--)add(x,rows);
  for(let y=rows-1;y>0;y--)add(0,y);
  const contours=ordered.length;
  for(let y=1;y<rows;y++)for(let x=1;x<columns;x++)add(x,y);
  const triangles=[];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const a=lookup.get(`${x},${y}`),b=lookup.get(`${x+1},${y}`);
    const c=lookup.get(`${x+1},${y+1}`),d=lookup.get(`${x},${y+1}`);
    triangles.push(a,b,c,a,c,d);
  }
  const centre=[part.left+part.width/2,part.top+part.height/2];
  const vertices=ordered.map((p,index)=>{
    const u=p.x/columns,v=p.y/rows,vertexId=id();
    const global=[part.left+u*part.width,part.top+v*part.height];
    return {id:vertexId,global,local:[global[0]-centre[0],global[1]-centre[1]],
      xml:tag(index<contours?'ContourMeshVertex':'MeshVertex',{
        id:vertexId,name:`${part.name}-vertex-${index}`,x:global[0]-centre[0],
        y:global[1]-centre[1],u,v})};
  });
  meshInfo.set(part.name,{centre,vertices});
  return tag('Mesh',{id:id(),name:`${part.name}-mesh`,
    triangleIndexBytes:varints(triangles)},vertices.map(v=>v.xml));
}

function bindGaze(base,axis){
  const converterId=id(),extent=axis==='gazeX'?4:3;
  converters.push(tag('DataConverterRangeMapper',{id:converterId,
    name:`${axis}-to-${base}`,minInput:-1,maxInput:1,minOutput:base-extent,
    maxOutput:base+extent,clampLower:true,clampUpper:true}));
  return tag('DataBindContext',{sourcePathIds:`0:40-${props[axis]}`,
    propertyKey:axis==='gazeX'?13:14,converterId});
}

const divisions={tail:[12,14],body:[8,14],'head-base':[10,12],
  'jaw-lower':[16,12],'muzzle-upper':[12,4],'mouth-interior':[8,6],tongue:[6,4],
  'eyelid-upper-left':[16,6],'eyelid-upper-right':[16,6],
  'eyelid-lower-left':[14,4],'eyelid-lower-right':[14,4],
  'eye-white-left':[6,4],'eye-white-right':[6,4],'iris-left':[4,4],'iris-right':[4,4]};
const imageIds=new Map();
function imagePart(name,parentPivot,clipId){
  const part=parts.get(name),imageId=id();imageIds.set(name,imageId);
  const centre=[part.left+part.width/2,part.top+part.height/2];
  const children=[gridMesh(part,...divisions[name])];
  if(clipId)children.push(tag('ClippingShape',{sourceId:clipId,
    fillRule:name==='head-base'?'evenOdd':'nonZero',name:`${name}-clip`}));
  if(name.startsWith('iris-')){
    children.push(bindGaze(centre[0]-parentPivot[0],'gazeX'));
    children.push(bindGaze(centre[1]-parentPivot[1],'gazeY'));
  }
  // Hidden PSD mouth materials remain exported, but their neutral opacity
  // and collapsed opening are keyed. hidden=true would remove them entirely.
  return tag('Image',{id:imageId,name,assetId:assetIds.get(name),
    x:centre[0]-parentPivot[0],y:centre[1]-parentPivot[1],originX:.5,originY:.5,
    opacity:part.hidden?0:1,samplerFilter:'bilinear'},children);
}

function cubic(curve,t){
  const s=1-t;
  return [0,1].map(axis=>s*s*s*curve[0][axis]+3*s*s*t*curve[1][axis]
    +3*s*t*t*curve[2][axis]+t*t*t*curve[3][axis]);
}
function aperturePoints(open,side){
  const curves=eyeApertureCurves(open,side),points=[];
  for(let i=0;i<=12;i++)points.push(cubic(curves.upper,i/12));
  for(let i=1;i<12;i++)points.push(cubic(curves.lower,i/12));
  return points;
}
function mouthPoints(open){
  const upper=[[548,522],[568,525],[600,525],[620,522]];
  const lower=[[620,522],[600,525+24*open],[568,525+24*open],[548,522]];
  const points=[];
  for(let i=0;i<=12;i++)points.push(cubic(upper,i/12));
  for(let i=1;i<12;i++)points.push(cubic(lower,i/12));
  return points;
}
function vectorMask(name,points){
  const shapeId=id(),vertices=points.map((global,i)=>({id:id(),global}));
  maskInfo.set(name,{id:shapeId,vertices});
  return tag('Shape',{id:shapeId,name},[
    tag('PointsPath',{name:`${name}-path`,isClosed:true,isClockwise:true},
      vertices.map((v,i)=>tag('StraightVertex',{id:v.id,name:`${name}-edge-${i}`,
        x:v.global[0]-headPivot[0],y:v.global[1]-headPivot[1]})))
  ]);
}

const eyeMasks=['left','right'].map(side=>vectorMask(`eye-mask-${side}`,aperturePoints(1,side)));
const mouthMask=vectorMask('mouth-mask',mouthPoints(0));
// A concave clipping path removes only the bottom-centre of the original
// head. No bitmap is altered; the separately painted jaw fills this region.
const headMask=vectorMask('head-without-baked-chin',[
  [0,0],[1205,0],[1205,1306],[638,1306],[638,522],[530,522],[530,1306],[0,1306]
]);
const faceChildren=[...eyeMasks,mouthMask,headMask];
// Rive siblings draw FIRST on top, opposite to canvas / the PSD manifest.
for(const part of [...manifest.parts].reverse()){
  if(part.name==='tail'||part.name==='body')continue;
  let clipId;
  if(part.name.startsWith('iris-')||part.name.startsWith('eye-white-'))
    clipId=maskInfo.get(`eye-mask-${part.name.endsWith('left')?'left':'right'}`).id;
  if(part.name==='mouth-interior'||part.name==='tongue')clipId=maskInfo.get('mouth-mask').id;
  if(part.name==='head-base')clipId=maskInfo.get('head-without-baked-chin').id;
  faceChildren.push(imagePart(part.name,headPivot,clipId));
}
const headNode=tag('Node',{id:headId,name:'HeadPivot',x:0,y:headPivot[1]-bodyPivot[1]},faceChildren);
const bodyNode=tag('Node',{id:bodyId,name:'BodyPivot',x:bodyPivot[0],y:bodyPivot[1]},[
  headNode,imagePart('body',bodyPivot),imagePart('tail',bodyPivot)
]);

function tracks(){return new Map();}
function key(track,objectId,propertyKey,frame,value){
  const k=`${objectId}/${propertyKey}`;
  if(!track.has(k))track.set(k,{objectId,propertyKey,frames:[]});
  track.get(k).frames.push({frame,value});
}
function meshPose(track,name,frame,transform){
  const mesh=meshInfo.get(name);
  const transformed=transform(mesh.vertices.map(v=>v.global));
  mesh.vertices.forEach((vertex,i)=>{
    key(track,vertex.id,24,frame,transformed[i][0]-mesh.centre[0]);
    key(track,vertex.id,25,frame,transformed[i][1]-mesh.centre[1]);
  });
}
function maskPose(track,name,frame,points){
  maskInfo.get(name).vertices.forEach((vertex,i)=>{
    key(track,vertex.id,24,frame,points[i][0]-headPivot[0]);
    key(track,vertex.id,25,frame,points[i][1]-headPivot[1]);
  });
}
function eyePose(track,frame,open,side){
  maskPose(track,`eye-mask-${side}`,frame,aperturePoints(open,side));
  for(const lid of ['upper','lower'])
    meshPose(track,`eyelid-${lid}-${side}`,frame,p=>eyelidKeyform(p,open,side,lid));
}
function mouthPose(track,frame,open){
  maskPose(track,'mouth-mask',frame,mouthPoints(open));
  meshPose(track,'jaw-lower',frame,p=>jawKeyform(p,open));
  meshPose(track,'mouth-interior',frame,p=>p.map(([x,y])=>[x,522+(y-504)/34*24*open]));
  meshPose(track,'tongue',frame,p=>p.map(([x,y])=>[x,522+14*open+(y-523)*.45*open]));
  key(track,imageIds.get('mouth-interior'),18,frame,open===0?0:1);
  key(track,imageIds.get('tongue'),18,frame,open*.45);
}
function animation(animationId,name,duration,track,loop='loop'){
  const objects=new Map();
  for(const entry of track.values()){
    if(!objects.has(entry.objectId))objects.set(entry.objectId,[]);
    objects.get(entry.objectId).push(tag('KeyedProperty',{propertyKey:entry.propertyKey},
      entry.frames.map(k=>tag('KeyFrameDouble',{frame:k.frame,value:k.value,interpolationType:'linear'}))));
  }
  return tag('LinearAnimation',{id:animationId,name,duration,fps:60,loopValue:loop},
    [...objects].map(([objectId,children])=>tag('KeyedObject',{objectId},children)));
}
const idle=tracks();
for(const [frame,scaleY,angle] of [[0,1,0],[120,1.003,.009],[240,1,0],[360,1.003,-.008],[480,1,0]]){
  key(idle,bodyId,17,frame,scaleY);key(idle,headId,15,frame,angle);
}
for(const [frame,value] of [[0,0],[100,.55],[190,0],[270,-.45],[380,.5],[480,0]])
  meshPose(idle,'tail',frame,p=>tailKeyform(p,value,manifest.tail.pivot));
const blink=tracks(),eyeClosed=tracks();
for(const side of ['left','right']){
  const offset=side==='right'?1:0;
  for(const [frame,open] of [[0,1],[96+offset,1],[99+offset,0],[101+offset,0],
    [105+offset,1],[290+offset,1],[293+offset,0],[295+offset,0],[299+offset,1],[480,1]])
    eyePose(blink,frame,open,side);
  eyePose(eyeClosed,0,0,side);
}
const mouthClosed=tracks(),mouthOpen=tracks(),mouthTimeline=tracks(),eyeTimeline=tracks();
mouthPose(mouthClosed,0,0);mouthPose(mouthOpen,0,1);
for(const [frame,amount] of [[0,0],[15,.25],[30,.5],[45,.75],[60,1]])mouthPose(mouthTimeline,frame,amount);
for(const [frame,amount] of [[0,0],[15,.25],[30,.5],[45,.75],[60,1]])
  for(const side of ['left','right'])eyePose(eyeTimeline,frame,amount,side);

function layer(name,state){
  const stateId=id();
  return tag('StateMachineLayer',{id:id(),name},[
    tag('AnyState',{x:180,y:-120}),tag('ExitState',{x:380,y:-120}),
    tag('EntryState',{x:0,y:0},[tag('StateTransition',{stateToId:stateId})]),
    state(stateId)
  ]);
}
function blendState(stateId,property,closedAnimation,openAnimation){
  return tag('BlendState1DViewModel',{id:stateId,x:180,y:0},[
    tag('BindablePropertyNumber',{},[tag('DataBindContext',{
      sourcePathIds:`0:40-${props[property]}`,propertyKey:636})]),
    tag('BlendAnimation1D',{animationId:closedAnimation,value:0}),
    tag('BlendAnimation1D',{animationId:openAnimation,value:100})
  ]);
}
const machine=tag('StateMachine',{id:'0:7',name:'Fox'},[
  layer('Idle motion',stateId=>tag('AnimationState',{id:stateId,x:180,y:0,animationId:idleId})),
  layer('Speech',stateId=>blendState(stateId,'mouthOpen',mouthClosedId,mouthOpenId)),
  layer('Eyelids',stateId=>blendState(stateId,'eyeOpen',eyeClosedId,blinkId))
]);
const timelines=[animation(idleId,'Idle',480,idle),animation(blinkId,'BlinkIdle',480,blink),
  animation(eyeClosedId,'EyeClosed',480,eyeClosed),
  animation(mouthClosedId,'MouthClosed',60,mouthClosed),
  animation(mouthOpenId,'MouthOpen',60,mouthOpen),
  animation(mouthTimelineId,'Mouth',60,mouthTimeline,'oneShot'),
  animation(eyeTimelineId,'EyeOpen',60,eyeTimeline,'oneShot')];
const artboard=tag('Artboard',{id:'0:2',name:'Fox',width:manifest.width,height:manifest.height,
  originX:0,originY:0,viewModelId:'0:40',viewModelInstanceId:'0:41',defaultStateMachineId:'0:7'},
  [machine,bodyNode,...timelines]);
const vm=tag('ViewModel',{id:'0:40',name:'FoxControls',defaultInstanceId:'0:41'},[
  ...Object.entries(props).map(([name,propertyId])=>tag('ViewModelPropertyNumber',{id:propertyId,name})),
  tag('ViewModelInstance',{id:'0:41',name:'Default',exports:true},
    Object.entries(props).map(([name,propertyId])=>tag('ViewModelInstanceNumber',{
      viewModelPropertyId:propertyId,propertyValue:name==='eyeOpen'?100:0})))
]);
const assets=manifest.parts.map(p=>tag('ImageAsset',{id:assetIds.get(p.name),name:p.name,
  file:path.relative(project,path.join(source,p.file)).split(path.sep).join('/'),samplerFilter:'bilinear'}));
const rml=tag('Rive',{version:1,kind:'fragment'},[artboard,vm,...converters,...assets])+'\n';
fs.mkdirSync(project,{recursive:true});
fs.writeFileSync(path.join(project,'scene.rml'),rml);
console.log(JSON.stringify({scene:path.join(project,'scene.rml'),images:assets.length,
  meshes:meshInfo.size,vertices:[...meshInfo.values()].reduce((n,m)=>n+m.vertices.length,0),
  timelines:7,controls:{mouthOpen:'0..100',eyeOpen:'0..100 (100 retains natural blink)',
    gazeX:'-1..1',gazeY:'-1..1'},bytes:Buffer.byteLength(rml)}));
