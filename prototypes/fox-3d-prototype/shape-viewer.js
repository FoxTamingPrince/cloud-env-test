import {LipTimeline} from './lip-timeline.js';
import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
const canvas=document.querySelector('canvas'),note=document.querySelector('#note');
const renderer=new T.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene();scene.background=new T.Color('#e8e1d7');
const camera=new T.PerspectiveCamera(34,1,.01,100);
scene.add(new T.HemisphereLight('#fff7ea','#766e61',1.3));
for(const [pos,color,power] of [[[3,6,4],'#fff4df',3],[[-4,3,0],'#e8f1ff',1.3],[[1,4,-4],'#fff0d0',2]]){
 const light=new T.DirectionalLight(color,power);light.position.set(...pos);
 if(power===3){light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-4,right:4,top:5,bottom:-4});light.shadow.normalBias=.025;}
 scene.add(light);
}
const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#d8d0c4',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.012;ground.receiveShadow=true;scene.add(ground);
let modelSpan=3.2;
let mouthMesh,voice,voiceSource,timeline;
let yaw=0,pitch=.08,distance=8.2,auto=false,target=new T.Vector3(0,1.6,0);
new GLTFLoader().load('./reference-fox-mouth.glb?v=1',g=>{
 const model=g.scene;const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
 const scale=3.2/size.y;modelSpan=Math.max(size.x,size.z)*scale;model.scale.multiplyScalar(scale);model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
 model.traverse(o=>{if(o.isMesh){if(o.morphTargetDictionary?.JawOpen!==undefined)mouthMesh=o;if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals();o.castShadow=true;o.receiveShadow=true;}});
 scene.add(model);note.textContent='口型初版 · 外观与实时语音接入仍在制作';
 distance=Math.max(8.2,Math.max(size.x,size.z)*scale/(2*Math.tan(T.MathUtils.degToRad(17)))/camera.aspect*1.15);
},undefined,()=>note.textContent='模型加载失败，请刷新');
let drag=false,px=0,py=0;
canvas.onpointerdown=e=>{drag=true;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!drag)return;yaw-=(e.clientX-px)*.009;pitch=Math.max(-.2,Math.min(.65,pitch+(e.clientY-py)*.005));px=e.clientX;py=e.clientY;};
canvas.onpointerup=canvas.onpointercancel=()=>drag=false;
canvas.onwheel=e=>{e.preventDefault();distance=Math.max(4,Math.min(15,distance+e.deltaY*.008));};
document.querySelector('#front').onclick=()=>{yaw=0;auto=false;};
document.querySelector('#side').onclick=()=>{yaw=Math.PI/2;auto=false;};
document.querySelector('#back').onclick=()=>{yaw=Math.PI;auto=false;};
document.querySelector('#rotate').onclick=e=>{auto=!auto;e.target.textContent=auto?'停止旋转':'自动旋转';};
let last=0;
function render(ms){const t=ms/1000,dt=Math.min(.05,t-last);last=t;if(auto&&!drag)yaw+=dt*.25;camera.position.set(Math.sin(yaw)*distance,target.y+Math.sin(pitch)*distance,Math.cos(yaw)*distance);camera.lookAt(target);renderer.render(scene,camera);requestAnimationFrame(render);}
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();distance=Math.max(8.2,modelSpan/(2*Math.tan(T.MathUtils.degToRad(17)))/camera.aspect*1.15);}
addEventListener('resize',resize);resize();requestAnimationFrame(render);

const map={A:'closed',B:'wide',C:'open',D:'open',E:'round',F:'round',G:'labiodental',H:'open',X:'rest'};
function applyMouth(w){if(!mouthMesh)return;const d=mouthMesh.morphTargetDictionary,a=mouthMesh.morphTargetInfluences;a[d.JawOpen]=(w.open||0)*.8+(w.labiodental||0)*.15;a[d.MouthWide]=(w.wide||0)*.65;a[d.MouthRound]=(w.round||0)*.75;}
function stopVoice(){if(voiceSource){voiceSource.onended=null;voiceSource.stop();voiceSource=null;}timeline?.stop();}
document.querySelector('#stop').onclick=stopVoice;
document.querySelector('#speak').onclick=async()=>{try{stopVoice();voice??=new AudioContext();await voice.resume();const [wav,cues]=await Promise.all([fetch('./sample.wav').then(r=>r.arrayBuffer()),fetch('./sample-mouth-cues.json').then(r=>r.json())]);const audio=await voice.decodeAudioData(wav);voiceSource=voice.createBufferSource();voiceSource.buffer=audio;voiceSource.connect(voice.destination);timeline=new LipTimeline(voice,applyMouth);const start=voice.currentTime+.05;timeline.start(cues.mouthCues.map(c=>({...c,shape:map[c.value]})),start);voiceSource.onended=()=>{timeline.stop();voiceSource=null;};voiceSource.start(start);}catch(e){note.textContent='试听失败：'+e.message;}};
