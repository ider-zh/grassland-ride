import * as T from 'three';
import {makeSet,cutWall} from './ridge.js';

const rgb=s=>new T.Color(s);
const canyon=['#677071','#545d61','#6f7165','#858376','#554e48'].map(rgb);
const limestone=['#918777','#84796a','#6e6b61','#a59781','#9e8d72'].map(rgb);
const steppe=['#a18b54','#b5a170','#8f824a','#898254','#ac995e'].map(rgb);
const on=(s,ctx)=>s>=ctx.start&&s<ctx.end;
const rand=(r,palette)=>palette[Math.floor(r()*palette.length)];

// Tall attached strata, modeled as one connected fin. Wide, bevelled
// cross sections keep the rock heavy at the bottom and let it break off in
// asymmetrical teeth higher on the valley wall.
const finMaterial=new T.MeshLambertMaterial({vertexColors:true,flatShading:true});
const finGeom=()=>{
  const p=[],col=[],faces=[],radial=9,levels=16;
  for(let l=0;l<=levels;l++){
    const h=l/levels;
    const width=.35+.64*(1-h)**.87+.055*Math.sin(l*2.4);
    const cx=.22*h+.045*Math.sin(h*9)*h;
    const cz=-.12*h+.062*Math.sin(h*8);
    for(let i=0;i<radial;i++){
      const a=i/radial*Math.PI*2,jitter=.83+.16*Math.sin(i*8.5+l*.27)+.045*Math.sin(i*9.2-l*1.4);
      p.push(cx+.57*Math.cos(a)*width*jitter,h-.18+.038*Math.sin(i*3.3+h*4)+.025*Math.cos(i*7-l*.8),cz+.64*Math.sin(a)*width*jitter);
      const shade=.87+.06*Math.sin(l*.98+i*.77)+.053*Math.cos(l*2.8+i*.5);
      const c=canyon[Math.floor(l/4)%3];
      col.push(c.r*shade,c.g*shade,c.b*shade);
      if(l<levels){
        const k=l*radial+i,j=l*radial+(i+1)%radial;
        faces.push(k,k+radial,j,j,k+radial,j+radial);
      }
    }
  }
  for(let i=1;i+1<radial;i++)faces.push(levels*radial,levels*radial+i+1,levels*radial+i);
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('color',new T.Float32BufferAttribute(col,3));
  g.setIndex(faces);g.computeVertexNormals();return g;
};
const finGeometry=finGeom();
function placeFin(ctx,s,side,height,width,depth){
  if(!on(s,ctx))return;
  const p=ctx.at(s,side*5.45);
  const mesh=new T.Mesh(finGeometry,finMaterial);
  mesh.name='Fractured entrance fin';
  mesh.position.set(p.x,p.y,p.z);
  mesh.rotation.set(.06,p.yaw+side*.42,side*.08,'YXZ');
  mesh.scale.set(width,height,depth);
  mesh.castShadow=mesh.receiveShadow=true;
  ctx.group.add(mesh);
}

export function buildValley(ctx){
  const {start,end,random:r}=ctx,set=makeSet(ctx);
  for(const [a,b,side,h,id] of [
    [2328,2410,-1,13,1],[2368,2419,1,12,2],
    [2413,2478,-1,18,3],[2438,2492,1,15,4],
    [2520,2619,1,18,5],[2568,2652,-1,15,6],
    [2720,2790,-1,21,7],[2745,2835,1,16,8],
    [2836,2932,-1,14,9]
  ])cutWall(ctx,a,b,side,h,id);
  // A natural split gate at the breach, followed by a distinct pale scree fan.
  placeFin(ctx,2453,-1,8.2,4.35,6.1);
  placeFin(ctx,2461,1,7.0,4.0,5.4);
  placeFin(ctx,2466,-1,5.1,2.4,3.8);
  // Debris is attached to rock feet in fall lines rather than sprinkled
  // across the valley, alternating long quiet sections with dense bends.
  for(let s=2329;s<2936;s+=9.4){
    if(!on(s,ctx))continue;
    const cut=(s<2489||s>2520&&s<2652||s>2710);
    const side=Math.sin(s*.066)>.08?1:-1;
    const d=side*(5.4+2.2*r()),bright=(s>2480&&s<2504);
    const n=cut?9:4;
    for(let k=0;k<n;k++){
      const w=.17+r()**2*.64,d1=d+(r()-.5)*2.15;
      set.rock(s+(r()-.5)*5,d1,w,w*(.31+r()*.42),w*(.8+r()*.73),{
        hue:rand(r,bright?limestone:canyon),rot:r()*Math.PI,tilt:.11
      });
    }
  }
  for(const s of [2414,2475,2589,2704,2850])if(on(s,ctx))set.marker(s,s%2?3.9:-3.9,.76,limestone);
  const patches=[];
  for(let i=0;i<5;i++){
    const s=start+r()*(end-start),side=r()<.48?1:-1;
    patches.push([s,side*(3.8+r()*9.4)]);
  }
  set.scatter(patches,10,2.2,{height:.55,size:.52});
  set.finish('Canyon floor');
}

function terrace(set,s,d,span,tiers,side=1){
  for(let i=0;i<span;i+=.84){
    const q=s+i,offset=d+side*(.84*Math.sin(i/span*1.7)+(i/span)**2*1.44);
    for(let j=0;j<tiers;j++){
      const y=.14+.24*j;
      set.rock(q+.10*(j%2),offset+side*.087*j,1.20+.24*Math.sin(i*1.6+j),.32,.52,{
        hue:limestone[(Math.floor(i)+j)%limestone.length],rise:y,rot:.10*j,tilt:.025
      });
    }
  }
}

export function buildPlateau(ctx){
  const {start,end,random:r}=ctx,set=makeSet(ctx);
  const patches=[];
  for(let i=0;i<13;i++){
    const s=start+.3+r()*(end-start-.6);
    // Follow the dry side of the track near the glacial tarn. Open the
    // foreground there so viewers can see the entire shoreline.
    const open=s>4180&&s<4460,side=open?(r()<.77?1:-1):r()<.48?1:-1;
    const d=side*(4.2+r()**1.65*(open?5.6:29));
    patches.push([s,d]);
  }
  set.scatter(patches,15,4.0,{height:.64,palette:steppe,size:1.04});
  // Irregular pastoral terraces with long runs, right angles only in the
  // actual old shelter. They catch warm side light but never hide the water.
  for(const s of [3979,4045,4160,4203,4217,4252,4520,4718,4845]){
    if(!on(s,ctx))continue;
    const d=s>=4160&&s<=4252 ? 6.3 : 10.5;
    terrace(set,s,d,9+(s%4),s===4203||s===4217?3:2,1);
  }
  // Trail landmark on the approach to the overlook: a dry-stone enclosure
  // with a cairn. Its modest scale preserves the long basin sight line.
  if(on(4228,ctx)){
    const s=4228;
    for(let i=0;i<13;i++){
      const a=i/13*Math.PI*2;
      const along=s+2.3*Math.sin(a),d=5.3+2.2*Math.cos(a);
      if(i===5||i===6)continue;
      set.rock(along,d,.99,.46,.88,{hue:limestone[i%5],rise:.15,rot:a});
      if(i%4)set.rock(along,d,.91,.29,.79,{hue:limestone[(i+2)%5],rise:.43,rot:a});
    }
    set.marker(s,5.3,1.65,limestone);
  }
  for(const s of [4028,4192,4248,4468,4790])if(on(s,ctx))set.marker(s,-3.83,s===4192?1.18:.76,limestone);
  if(on(4239,ctx))set.flag(4239,5.05);
  set.finish('Tarn plateau');
}
