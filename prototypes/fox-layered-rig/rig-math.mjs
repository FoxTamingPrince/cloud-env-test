// Source-art pixel coordinates. These are reusable binding transforms,
// not a compiled Cubism model or a substitute for its editor export.
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export function tailKeyform(points,value,pivot=[684,914]){
  const angle=clamp(value,-1,1)*0.10;
  return points.map(([x,y])=>{
    // Keep the buried root stationary; bend progressively toward the tip.
    const distance=Math.hypot(x-pivot[0],y-pivot[1]);
    const weight=smooth((distance-48)/270);
    const a=angle*weight,dx=x-pivot[0],dy=y-pivot[1];
    return [pivot[0]+dx*Math.cos(a)-dy*Math.sin(a),
      pivot[1]+dx*Math.sin(a)+dy*Math.cos(a)];
  });
}
export function jawKeyform(points,open,pivot=[584,506]){
  const amount=clamp(open,0,1);
  // In the v5 artwork the mouth corners are [548,522] and [620,522].
  // Keep those corners and the upper attachment still, while the central
  // lower lip descends. Below the lip, blend into translation of the chin
  // instead of stretching only its bottom edge.
  const mouthY=pivot[1]+16;
  return points.map(([x,y])=>{
    const central=smooth(1-Math.abs(x-pivot[0])/36);
    const lipWeight=smooth((y-pivot[1])/16);
    const chinWeight=smooth((y-mouthY)/44);
    const weight=lipWeight*(central+(1-central)*chinWeight);
    return [x,y+18*amount*weight];
  });
}

// "left" and "right" refer to the canvas, not the fox's anatomical side.
// Coordinates describe the eye-white aperture in the assembled v5 source.
const eyeGeometry={
  left:{left:[471,390],right:[540,390],upperRise:24,lowerDrop:68/3,lowerFade:12},
  right:{left:[628,390],right:[699,390],upperRise:24,lowerDrop:24,lowerFade:11}
};
const mix=(a,b,t)=>a+(b-a)*t;
function getEyeGeometry(side){
  const geometry=eyeGeometry[side];
  if(!geometry)throw new RangeError('Eye side must be "left" or "right".');
  return geometry;
}

// Two cubic Bezier segments form a closed aperture: upper runs left to
// right, lower runs right to left. At open=0 they coincide, giving zero
// visible area. Use the resulting path to clip both eye white and iris.
export function eyeApertureCurves(open,side='left'){
  const geometry=getEyeGeometry(side),amount=clamp(open,0,1);
  const [leftX,cornerY]=geometry.left,[rightX]=geometry.right;
  const width=rightX-leftX,closedY=cornerY+3;
  const upperY=mix(closedY,cornerY-geometry.upperRise,amount);
  const lowerY=mix(closedY,cornerY+geometry.lowerDrop,amount);
  return {
    leftCorner:[leftX,cornerY],
    rightCorner:[rightX,cornerY],
    upper:[[leftX,cornerY],[leftX+width*.28,upperY],
      [leftX+width*.72,upperY],[rightX,cornerY]],
    lower:[[rightX,cornerY],[leftX+width*.72,lowerY],
      [leftX+width*.28,lowerY],[leftX,cornerY]]
  };
}

function cubicCoordinate(curve,t,axis){
  const s=1-t;
  return s*s*s*curve[0][axis]+3*s*s*t*curve[1][axis]
    +3*s*t*t*curve[2][axis]+t*t*t*curve[3][axis];
}
function curveHeightAtX(curve,x){
  // Both segment orientations are supported; control X values are monotone.
  const increasing=curve[3][0]>curve[0][0];
  const target=clamp(x,Math.min(curve[0][0],curve[3][0]),
    Math.max(curve[0][0],curve[3][0]));
  let low=0,high=1;
  for(let i=0;i<18;i++){
    const middle=(low+high)/2;
    if((cubicCoordinate(curve,middle,0)<target)===increasing)low=middle;
    else high=middle;
  }
  return cubicCoordinate(curve,(low+high)/2,1);
}

// Deform the painted upper/lower eyelid using the same curves as the mask.
// The eye corners and the outer fur attachment remain fixed; influence
// increases toward the moving lid edge. Points are global source pixels.
export function eyelidKeyform(points,open,side='left',lid='upper'){
  if(lid!=='upper'&&lid!=='lower')
    throw new RangeError('Eyelid must be "upper" or "lower".');
  const geometry=getEyeGeometry(side);
  const original=eyeApertureCurves(1,side)[lid];
  const current=eyeApertureCurves(open,side)[lid];
  return points.map(([x,y])=>{
    // Beyond the corners there is only cheek fur, not a moving eye edge.
    if(x<=geometry.left[0]||x>=geometry.right[0])return [x,y];
    const originalY=curveHeightAtX(original,x);
    const currentY=curveHeightAtX(current,x);
    const weight=lid==='upper'
      ?smooth((y-(originalY-35))/35)
      :smooth((originalY+geometry.lowerFade-y)/geometry.lowerFade);
    return [x,y+(currentY-originalY)*weight];
  });
}
export function gazeKeyform(points,x,y){
  return points.map(([px,py])=>[px+4*clamp(x,-1,1),py+3*clamp(y,-1,1)]);
}
export function breathKeyform(points,value,pivot=[584,1164]){
  const scale=1+0.006*clamp(value,0,1);
  return points.map(([x,y])=>[x,pivot[1]+(y-pivot[1])*scale]);
}
