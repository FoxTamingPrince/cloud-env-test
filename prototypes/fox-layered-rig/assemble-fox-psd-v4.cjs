const fs = require('node:fs');
const path = require('node:path');
const {createCanvas,loadImage}=require('/Users/zyb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const {writePsdBuffer,readPsd}=require('./tools/node_modules/ag-psd');
const width=1205,height=1306;

// Place original painted components as independent layers for authoring.
// No animation or completed-model claim is implied by the assembled PSD.
(async()=>{
  const body=await loadImage(path.join(__dirname,'../fox-3d-prototype/fox-rig-parts.png'));
  const head=await loadImage(path.join(__dirname,'fox-head-base-v2.png'));
  const face=await loadImage(path.join(__dirname,'fox-facial-parts-v1.png'));
  const bounds=JSON.parse(fs.readFileSync(path.join(__dirname,'facial-parts-bounds.json')));
  const composite=createCanvas(width,height),ctx=composite.getContext('2d');
  const children=[];
  function part(name,image,source,destination,hidden=false){
    const [sx,sy,sw,sh]=source,[left,top,w,h]=destination;
    const canvas=createCanvas(w,h),c=canvas.getContext('2d');
    c.drawImage(image,sx,sy,sw,sh,0,0,w,h);
    if(!hidden)ctx.drawImage(canvas,left,top);
    children.push({name,left,top,right:left+w,bottom:top+h,hidden,
      blendMode:'normal',opacity:1,imageData:c.getImageData(0,0,w,h)});
  }
  part('tail',body,[65,638,555,602],[744,624,366,397]);
  part('body',body,[770,25,355,672],[384,445,410,730]);
  part('head-base',head,[122,20,1031,1215],[305,0,555,654]);
  const place={
    'mouth-interior':[548,504,72,34,true],
    'tongue':[567,523,34,22,true],
    'jaw-lower':[530,501,108,66,false],
    'muzzle-upper':[461,475,246,54,false],
    'eye-white-left':[471,372,69,36,false],
    'eye-white-right':[628,372,71,36,false],
    'iris-left':[487,372,37,37,false],
    'iris-right':[645,372,37,37,false],
    'eyelid-upper-left':[451,337,94,47,false],
    'eyelid-upper-right':[625,337,94,47,false],
    'eyelid-lower-left':[469,404,73,16,false],
    'eyelid-lower-right':[628,404,71,16,false]
  };
  for(const [name,[left,top,w,h,hidden]] of Object.entries(place)){
    const b=bounds.parts.find(p=>p.name===name).alphaBounds;
    part(name,face,[b.left,b.top,b.width,b.height],[left,top,w,h],hidden);
  }
  fs.writeFileSync(path.join(__dirname,'fox-assembled-v4.png'),composite.toBuffer('image/png'));
  const psd={width,height,children,imageData:ctx.getImageData(0,0,width,height)};
  const output=path.join(__dirname,'fox-import-draft-v4.psd');
  fs.writeFileSync(output,writePsdBuffer(psd,{generateThumbnail:false}));
  const back=readPsd(fs.readFileSync(output),{skipLayerImageData:true,skipCompositeImageData:true,skipThumbnail:true});
  fs.writeFileSync(path.join(__dirname,'assembled-psd-readback-v4.json'),JSON.stringify({width:back.width,height:back.height,layers:back.children.map(l=>({name:l.name,hidden:l.hidden})),status:'draft-needs-visual-alignment',cubismImportVerified:false},null,2)+'\n');
  console.log(JSON.stringify({file:output,layers:back.children.length,bytes:fs.statSync(output).size}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
