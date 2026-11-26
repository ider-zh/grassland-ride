// The only coordinate and seam contract used by terrain, scenery, rider and QA.
export const CHUNK=32, LENGTH=576, SEGMENT=LENGTH/3, COUNT=LENGTH/CHUNK, ROAD_HALF=2.4;
export const TAU=Math.PI*2;
export const wrap=s=>((s%LENGTH)+LENGTH)%LENGTH;
export const smooth=(a,b,n)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);};
export const segmentAt=s=>Math.min(2,Math.floor(wrap(s)/SEGMENT));
export function random(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
const radial=a=>1+.105*Math.cos(2*a+.3)+.065*Math.sin(3*a-.6)+.027*Math.sin(5*a+.8);
const edge=a=>[radial(a)*Math.sin(a),radial(a)*Math.cos(a)];
const resolution=2048,cum=new Float64Array(resolution+1);
let previous=edge(0);
for(let i=1;i<=resolution;i++){const p=edge(i/resolution*TAU);cum[i]=cum[i-1]+Math.hypot(p[0]-previous[0],p[1]-previous[1]);previous=p;}
const radius=LENGTH/cum[resolution];

function angleAt(s){
  const d=wrap(s)/radius;
  let lo=0,hi=resolution;
  while(lo+1<hi){const m=(lo+hi)>>1;if(cum[m]<=d)lo=m;else hi=m;}
  return (lo+(d-cum[lo])/(cum[hi]-cum[lo]))/resolution*TAU;
}
function roadFrame(s){
  const a=angleAt(s),p=edge(a);
  const left=edge(a-.0003),right=edge(a+.0003);
  const dx=right[0]-left[0],dz=right[1]-left[1],len=Math.hypot(dx,dz);
  const fx=dx/len,fz=dz/len;
  return {x:p[0]*radius,z:p[1]*radius,fx,fz,rx:-fz,rz:fx,yaw:Math.atan2(-fx,-fz)};
}
export function ground(x,z){
  const a=Math.atan2(x,z),r=Math.hypot(x,z),d=r-radial(a)*radius;
  // Smooth analytic world surface: no per-tile height recipes or scene-dependent edges.
  const ridge=Math.exp(-Math.pow((Math.cos(a+.82)-1)/.47,2));
  const town=Math.exp(-Math.pow((Math.cos(a-.94)-1)/.33,2));
  const local=.56*Math.sin(x*.085+z*.065)+.43*Math.sin(x*.11-z*.08)+.24*Math.cos(z*.18);
  const hill=13.8*ridge* Math.exp(-Math.pow((d+8)/38,2));
  const apron=2.1*Math.sin(x*.027-z*.013)+1.1*Math.cos(z*.041+x*.02);
  return .88+apron*(1-.67*town)+hill+local*(1-.79*town);
}
export function at(s,lateral=0){
  const f=roadFrame(s),x=f.x+f.rx*lateral,z=f.z+f.rz*lateral;
  return {x,z,y:ground(x,z),yaw:f.yaw,fx:f.fx,fz:f.fz,rx:f.rx,rz:f.rz};
}
export function trailWidth(s){return ROAD_HALF+.21*Math.sin(wrap(s)*TAU/32)+.10*Math.cos(wrap(s)*TAU/18);}
export function blendAt(s){
  const base=segmentAt(s),pos=wrap(s)%SEGMENT,range=15;
  if(pos<range)return [(base+2)%3,base,smooth(-range,range,pos)];
  if(pos>SEGMENT-range)return [base,(base+1)%3,smooth(-range,range,pos-SEGMENT)];
  return [base,base,0];
}
export function windTravel(t){return 2.05*t+1.75*Math.sin(t*.50)+.58*Math.sin(t*1.12);}
export function meadowWind(x,s,t){
  const phase=x*.17+s*.092-windTravel(t)*.67+.82*Math.sin(s*.081+t*.25);
  const front=smooth(-.27,.89,Math.sin(phase)+.28*Math.sin(phase*1.9+s*.10));
  return .08+front*(.93+.20*Math.sin(x*.46-s*.28-t*3.4));
}
