import assert from 'node:assert/strict';
import fs from 'node:fs';
const url=new URL('../src/world/route.js',import.meta.url);
const {surfacePoint,geographic,wrap,blendAt,segmentAt,LENGTH,CHUNK,COUNT,RADIUS,relief,trailWidth,TARN,tarnShape,roadLateral}=await import('data:text/javascript;base64,'+fs.readFileSync(url).toString('base64'));
const delta=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
assert.equal(COUNT,216);
assert.deepEqual([0,192,2304,2944,3840,4992,6720,6912].map(segmentAt),[0,1,2,3,4,5,6,0]);
assert.equal(wrap(-1),LENGTH-1);
let steep=0,maxStep=0,minStep=Infinity;
for(let s=0;s<LENGTH;s+=.5){
  const p=surfacePoint(s),q=surfacePoint(s+.5);
  const gp=geographic(p.x,p.y,p.z),gq=geographic(q.x,q.y,q.z);
  assert(Math.abs(gp.s-s)<1e-7);
  steep=Math.max(steep,Math.abs(gq.r-gp.r)/delta(p,q));
  maxStep=Math.max(maxStep,delta(p,q)*2);minStep=Math.min(minStep,delta(p,q)*2);
}
assert(steep<.48,'trail needs to stay rideable');
assert(maxStep<1.23&&minStep>.98,'route speed stays near actual travelled distance');
for(let seam=0;seam<=LENGTH;seam+=CHUNK){
  for(const side of [-335,-2.4,0,2.4,335]){
    assert(delta(surfacePoint(seam-.0001,side),surfacePoint(seam+.0001,side))<.003);
    assert(delta(surfacePoint(seam+LENGTH,side),surfacePoint(seam,side))<1e-8);
  }
  assert(Math.abs(trailWidth(seam-.0001)-trailWidth(seam+.0001))<.001);
}
for(const k of [0,192,2304,2944,3840,4992,6720,6912]){
  const a=blendAt(k-.0001),b=blendAt(k+.0001);
  assert.deepEqual(a.slice(0,2),b.slice(0,2));
  assert(Math.abs(a[2]-b[2])<.001);
}
const farPeak=relief(2730,-178),valley=relief(2510,-7),ridge=relief(3120,127);
assert(farPeak>150&&ridge>valley+28);
assert(tarnShape(TARN.s,TARN.l)<.02);
assert(relief(TARN.s,TARN.l)<TARN.level-2,'lake bowl is below the water surface');
for(let s=TARN.s-115;s<TARN.s+115;s+=.5){
  for(const side of [-2.7,0,2.7])assert(tarnShape(s,roadLateral(s)+side)>1.05,'lake cannot enter the riding lane');
}
const start=surfacePoint(0),opposite=surfacePoint(LENGTH/2),end=surfacePoint(LENGTH);
assert(delta(start,opposite)>2*RADIUS&&delta(start,end)<1e-8);
console.log(JSON.stringify({length:LENGTH,radius:RADIUS,chunkSeams:COUNT,steep,minStep,maxStep,farPeak,valley,ridge}));
