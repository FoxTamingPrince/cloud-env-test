import * as T from './vendor/three.module.js';
const canvas=document.querySelector('canvas');
const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.01,100);camera.position.set(0,0,9);
const paint=document.createElement('canvas');paint.width=1205;paint.height=1305;const ink=paint.getContext('2d');
const image=new Image();image.src='./fox-front.png';await image.decode();ink.drawImage(image,0,0);
const texture=new T.CanvasTexture(paint);texture.colorSpace=T.SRGBColorSpace;
const geometry=new T.PlaneGeometry(3.5,3.5*1305/1205,96,104),positions=geometry.attributes.position,uv=geometry.attributes.uv;
const original=new Float32Array(positions.array.length),depths=new Float32Array(positions.count);
function ellipse(u,v,x,y,rx,ry){return Math.exp(-2*((u-x)**2/rx**2+(v-y)**2/ry**2));}
for(let i=0;i<positions.count;i++){
 const u=uv.getX(i),v=1-uv.getY(i);
 const head=ellipse(u,v,.485,.30,.23,.24),body=ellipse(u,v,.485,.66,.23,.30),tail=ellipse(u,v,.76,.68,.26,.28);
 const depth=.04+head*.33+body*.21+tail*.18;
 positions.setZ(i,depth);depths[i]=depth;
}
original.set(positions.array);geometry.computeVertexNormals();
const fox=new T.Mesh(geometry,new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.05,side:T.DoubleSide,depthWrite:true}));scene.add(fox);
let targetAngle=0,turn=0,opening=0,jaw=0,talking=false,tailEnergy=0;
const atlas=new Image();atlas.src='./fox-front-visemes.png';await atlas.decode();
const patch=document.createElement('canvas');patch.width=168;patch.height=120;const patchInk=patch.getContext('2d');
const anchors=[[287,351],[766,351],[1246,351],[287,840],[766,840],[1246,840]];
function drawMuzzle(frame,alpha){const [x,y]=anchors[frame];patchInk.clearRect(0,0,168,120);patchInk.globalCompositeOperation='source-over';patchInk.drawImage(atlas,x-70,y+8,140,100,0,0,168,120);patchInk.globalCompositeOperation='destination-in';const fade=patchInk.createRadialGradient(84,48,28,84,48,85);fade.addColorStop(0,'#fff');fade.addColorStop(.63,'#fff');fade.addColorStop(1,'#fff0');patchInk.fillStyle=fade;patchInk.fillRect(0,0,168,120);ink.globalAlpha=alpha;ink.drawImage(patch,505,507,156,84);ink.globalAlpha=1;}
let paintedFrame=-1,lastPaint=0,blinkAmount=0,nextBlink=performance.now()+2200,blinkStarted=-1;
function drawEyes(time){
 // Small gaze shifts stay inside the existing eye contours.
 const gaze=Math.sin(time*.33)*1.8;
 for(const [cx,cy] of [[505,391],[663,391]]){ink.save();ink.beginPath();ink.ellipse(cx,cy,18,22,0,0,Math.PI*2);ink.clip();ink.drawImage(image,cx-24,cy-27,48,54,cx-24+gaze,cy-27,48,54);ink.restore();}
 if(blinkAmount>.01){const eyes=document.createElement('canvas');eyes.width=280;eyes.height=98;const e=eyes.getContext('2d');e.drawImage(atlas,1124,742,236,83,0,0,280,98);e.globalCompositeOperation='destination-in';const mask=e.createRadialGradient(140,49,85,140,49,146);mask.addColorStop(0,'#fff');mask.addColorStop(1,'#fff0');e.fillStyle=mask;e.fillRect(0,0,280,98);ink.globalAlpha=blinkAmount;ink.drawImage(eyes,444,354);ink.globalAlpha=1;}
}
function refreshFace(time){ink.clearRect(0,0,1205,1305);ink.drawImage(image,0,0);if(paintedFrame>0)drawMuzzle(paintedFrame,1);drawEyes(time);texture.needsUpdate=true;}
function pose(w){opening=(w.open||0)*18+(w.wide||0)*9+(w.round||0)*13+(w.labiodental||0)*4;
 const entries=[[1,(w.labiodental||0)+(w.open||0)*.7],[2,(w.open||0)*.3],[3,w.wide||0],[4,w.round||0]];
 const [frame,weight]=entries.reduce((best,item)=>item[1]>best[1]?item:best,[0,0]);const selected=weight>.22?frame:0;const now=performance.now();if(selected===paintedFrame||now-lastPaint<45)return;paintedFrame=selected;lastPaint=now;refreshFace(now/1000);
}

addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='fox-mouth')return;const level=Math.max(0,Math.min(1,Number(event.data.level)||0));const active=event.data.speaking===true;talking=active;if(!active||level<.025){pose({rest:1});return;}pose({open:Math.min(1,level*1.8),wide:0,round:0});});
let drag=false,px=0;canvas.onpointerdown=e=>{drag=true;px=e.clientX;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag){targetAngle=T.MathUtils.clamp(targetAngle+(e.clientX-px)*.003,-.28,.28);px=e.clientX;}};canvas.onpointerup=canvas.onpointercancel=()=>drag=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;canvas.dataset.reducedMotion=String(reduced);
let tipIndex=0,bestDistance=Infinity;for(let i=0;i<uv.count;i++){const distance=(uv.getX(i)-.675)**2+(1-uv.getY(i)-.455)**2;if(distance<bestDistance){bestDistance=distance;tipIndex=i;}}const motionSamples=[];
function render(ms){const time=ms/1000;
 if(ms>=nextBlink&&blinkStarted<0){blinkStarted=ms;nextBlink=ms+3600+Math.random()*2200;}
 if(blinkStarted>=0){const elapsed=ms-blinkStarted;blinkAmount=elapsed<85?elapsed/85:elapsed<145?1:Math.max(0,1-(elapsed-145)/130);if(elapsed>=275){blinkStarted=-1;blinkAmount=0;}}
 if(ms-lastPaint>65||blinkAmount>.01){lastPaint=ms;refreshFace(time);}canvas.dataset.blink=blinkAmount.toFixed(2);
jaw+=(opening/18-jaw)*.22;tailEnergy+=((talking?1:0)-tailEnergy)*.035;turn+=(targetAngle-turn)*.08;fox.rotation.y=turn;
 if(!reduced){for(let i=0;i<positions.count;i++){
 const u=uv.getX(i),v=1-uv.getY(i),j=i*3;let x=original[j],y=original[j+1],z=original[j+2];
 const head=ellipse(u,v,.485,.28,.23,.22);const tail=T.MathUtils.smoothstep(u,.59,.74)*T.MathUtils.smoothstep(v,.39,.49);
 const tailDelay=T.MathUtils.smoothstep(u,.60,.89)*.38;const tailWave=Math.sin(time*.85-tailDelay);const tailAmplitude=.007+tailEnergy*.018;
 const body=ellipse(u,v,.485,.61,.23,.27);
 const headTilt=Math.sin(time*.65)*.015*head,dx=x+.052,dy=y-.67;
 x+=-dy*headTilt+tailWave*tailAmplitude*tail;y+=dx*headTilt+Math.sin(time*.85-tailDelay+.18)*tailAmplitude*.40*tail+Math.sin(time*1.2)*.009*body;z+=Math.sin(time*.85-tailDelay+.32)*tailAmplitude*.7*tail+Math.sin(time*1.2)*.012*body;
 const chin=ellipse(u,v,.484,.419,.05,.035)*T.MathUtils.smoothstep(v,.403,.424);y-=jaw*.042*chin;z+=jaw*.012*chin;
 const rootX=.56,rootY=-.57;const angle=Math.sin(time*.85-tailDelay)*(.016+tailEnergy*.12)*tail;const tx=x-rootX,ty=y-rootY;const rx=tx*Math.cos(angle)-ty*Math.sin(angle),ry=tx*Math.sin(angle)+ty*Math.cos(angle);x=rootX+rx;y=rootY+ry;
 positions.setXYZ(i,x,y,z);
 }positions.needsUpdate=true;}
 fox.updateMatrixWorld();const tip=new T.Vector3().fromBufferAttribute(positions,tipIndex).applyMatrix4(fox.matrixWorld).project(camera);const rect=canvas.getBoundingClientRect();if(ms-(motionSamples.at(-1)?.ms||0)>100){motionSamples.push({ms:Math.round(ms),x:Number(((tip.x+1)*rect.width/2).toFixed(2)),y:Number(((1-tip.y)*rect.height/2).toFixed(2)),talking,tailEnergy:Number(tailEnergy.toFixed(3)),mouth:paintedFrame});if(motionSamples.length>100)motionSamples.shift();canvas.dataset.motion=JSON.stringify(motionSamples);}
 renderer.render(scene,camera);requestAnimationFrame(render);}
function resize(){const rect=canvas.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.position.z=Math.max(8,3.6/(2*Math.tan(T.MathUtils.degToRad(16)))/camera.aspect);camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();requestAnimationFrame(render);
