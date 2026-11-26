import assert from 'node:assert/strict';
import fs from 'node:fs';
const url=new URL('../src/world/route.js',import.meta.url);
const {at,wrap,blendAt,segmentAt,LENGTH,CHUNK,COUNT,ground,trailWidth}=await import('data:text/javascript;base64,'+fs.readFileSync(url).toString('base64'));
const delta=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
assert.equal(COUNT,18);
assert.deepEqual([0,192,384,576,768].map(segmentAt),[0,1,2,0,1]);
assert.equal(wrap(-1),LENGTH-1);
let maxSlope=0,stepError=0;
for(let s=0;s<LENGTH;s+=.5){
  const p=at(s),q=at(s+.5);
  maxSlope=Math.max(maxSlope,Math.abs(q.y-p.y)/.5);
  stepError=Math.max(stepError,Math.abs(Math.hypot(q.x-p.x,q.z-p.z)-.5));
  assert(Number.isFinite(ground(p.x,p.z)));
}
assert(maxSlope<.35,'trail needs to stay rideable');
assert(stepError<.05,'arc-length distance is stable');
for(let seam=0;seam<=LENGTH;seam+=CHUNK){
  for(const side of [-39,-2.4,0,2.4,39]){
    const p=at(seam-.0001,side),n=at(seam+.0001,side);
    assert(delta(p,n)<.002,'seam continuity');
    assert(delta(at(seam+LENGTH,side),at(seam,side))<1e-8,'wrap exact');
  }
  assert(Math.abs(trailWidth(seam-.0001)-trailWidth(seam+.0001))<.001);
}
for(const k of [0,192,384,576]){
  const a=blendAt(k-.0001),b=blendAt(k+.0001);
  assert.deepEqual(a.slice(0,2),b.slice(0,2));
  assert(Math.abs(a[2]-b[2])<.001);
}
console.log(JSON.stringify({chunkSeams:COUNT,maxSlope,stepError}));
