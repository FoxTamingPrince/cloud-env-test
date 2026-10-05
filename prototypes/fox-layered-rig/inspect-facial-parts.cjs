const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/zyb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

// Read only pixel inspection: retain the source artwork unchanged.
const regions = [
  ['eye-white-left', 0, 0, 400, 390],
  ['eye-white-right', 400, 0, 400, 390],
  ['iris-left', 800, 0, 350, 390],
  ['iris-right', 1150, 0, 298, 390],
  ['eyelid-upper-left', 0, 390, 400, 320],
  ['eyelid-upper-right', 400, 390, 400, 320],
  ['eyelid-lower-left', 800, 390, 350, 320],
  ['eyelid-lower-right', 1150, 390, 298, 320],
  ['muzzle-upper', 0, 710, 630, 376],
  ['jaw-lower', 630, 710, 300, 376],
  ['mouth-interior', 930, 710, 270, 376],
  ['tongue', 1200, 710, 248, 376]
];

(async () => {
  const source = path.join(__dirname, 'fox-facial-parts-v1.png');
  const {data, info} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const parts = regions.map(([name, left, top, width, height]) => {
    let x0=info.width, y0=info.height, x1=-1, y1=-1, pixels=0;
    for (let y=top; y<top+height; y++) for(let x=left; x<left+width; x++) {
      if (data[(y*info.width+x)*4+3] <= 16) continue;
      pixels++; x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y);
    }
    return {name, region:{left,top,width,height}, alphaBounds:pixels?{left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}:null, pixels};
  });
  const result = {source:path.basename(source), width:info.width,height:info.height, threshold:16,
    note:'Bounds include any residue above the threshold; alignment and seam checks are still required.',parts};
  fs.writeFileSync(path.join(__dirname,'facial-parts-bounds.json'),JSON.stringify(result,null,2)+'\n');
  console.log(parts.map(p=>`${p.name}: ${JSON.stringify(p.alphaBounds)}`).join('\n'));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
