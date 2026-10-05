const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/zyb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {writePsdBuffer, readPsd} = require('./tools/node_modules/ag-psd');

// Serialize the original atlas pixels into separate PSD layers, without repainting.
// Coordinates stay in atlas space. This is the material-separation document,
// not an assembled or rigged fox.
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'facial-parts-bounds.json')));
  const {data, info} = await sharp(path.join(__dirname,manifest.source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const children = manifest.parts.map(({name, region:{left,top,width,height}}) => {
    const pixels = new Uint8ClampedArray(width*height*4);
    for (let y=0;y<height;y++) {
      const start=((top+y)*info.width+left)*4;
      pixels.set(data.subarray(start,start+width*4),y*width*4);
    }
    return {name,left,top,right:left+width,bottom:top+height,
      blendMode:'normal',opacity:1,imageData:{width,height,data:pixels}};
  });
  const psd={width:info.width,height:info.height,children,
    imageData:{width:info.width,height:info.height,data:new Uint8ClampedArray(data)}};
  const output=path.join(__dirname,'fox-face-material-separation-v1.psd');
  fs.writeFileSync(output,writePsdBuffer(psd,{generateThumbnail:false}));
  const readback=readPsd(fs.readFileSync(output),{skipLayerImageData:true,skipCompositeImageData:true,skipThumbnail:true});
  const report={file:path.basename(output),width:readback.width,height:readback.height,
    layers:readback.children.map(l=>({name:l.name,left:l.left,top:l.top,right:l.right,bottom:l.bottom})),
    assembled:false,cubismImportVerified:false};
  fs.writeFileSync(path.join(__dirname,'face-psd-readback.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({file:output,bytes:fs.statSync(output).size,layers:report.layers.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
