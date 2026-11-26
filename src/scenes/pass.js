import * as T from 'three';

const rock=new T.IcosahedronGeometry(1,1), post=new T.CylinderGeometry(.08,.115,1,5), beam=new T.BoxGeometry(1,1,1);
const material=new T.MeshLambertMaterial({color:0xffffff,flatShading:true});
const colors=['#6b777b','#56636b','#8b8b7b','#b1a995','#64734a'].map(c=>new T.Color(c));
function stonework(ctx,plateau){
  const {at,group,start,end,random:r}=ctx,stamp=new T.Object3D();
  const rocks=new T.InstancedMesh(rock,material,plateau?27:51);
  const wood=new T.InstancedMesh(post,material,8),rails=new T.InstancedMesh(beam,material,5);
  for(let i=0;i<rocks.count;i++){
    const s=start+r()*(end-start), side=r()<.5?-1:1,d=3.3+(r()**1.42)*(plateau?78:42);
    const p=at(s,side*d),size=.19+r()**3*(d<7?1:3.25);
    stamp.position.set(p.x,p.y+size*.08,p.z);
    stamp.rotation.set(.22*(r()-.5),r()*6,.3*(r()-.5));stamp.scale.set(size*(1+r()*.7),size*(.6+r()*.45),size);
    stamp.updateMatrix();rocks.setMatrixAt(i,stamp.matrix);rocks.setColorAt(i,colors[(i+Math.floor(r()*3))%4]);
  }
  const side=ctx.index%2?1:-1;
  // Repeated clusters, not a fence across the road: stone waymarkers and occasional lookout rails.
  let wn=0,rn=0;
  if(ctx.index%4===0){
    const x=plateau?5.6:4.2;
    for(let i=0;i<6;i++){
      const p=at(start+5+i*2.6,side*x);
      stamp.position.set(p.x,p.y+.43,p.z);stamp.rotation.set(.04,0,.03);stamp.scale.set(1,1.02,1);
      stamp.updateMatrix();wood.setMatrixAt(wn,stamp.matrix);wood.setColorAt(wn++,colors[3]);
      if(i<5){
        const q=at(start+5+(i+1)*2.6,side*x);
        stamp.position.set((p.x+q.x)/2,(p.y+q.y)/2+.76,(p.z+q.z)/2);
        stamp.rotation.set(Math.atan2(q.y-p.y,2.6),p.yaw,0,'YXZ');stamp.scale.set(.13,.13,2.69);
        stamp.updateMatrix();rails.setMatrixAt(rn,stamp.matrix);rails.setColorAt(rn++,colors[3]);
      }
    }
  }
  for(const o of [rocks,wood,rails]){
    if(o===wood)o.count=wn;if(o===rails)o.count=rn;
    if(!o.count){o.dispose();continue;}
    o.computeBoundingSphere();o.receiveShadow=true;group.add(o);
  }
}
export const buildValley=ctx=>stonework(ctx,false);
export const buildPlateau=ctx=>stonework(ctx,true);
