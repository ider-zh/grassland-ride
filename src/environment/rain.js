import * as T from 'three';
import {random} from '../world/route.js';

export function createRain(scene){
  const n=370,r=random(761035);
  const values=Array.from({length:n},()=>[r(),r(),r(),r()]);
  const geometry=new T.BufferGeometry(),positions=new T.BufferAttribute(new Float32Array(n*6),3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position',positions);
  const mat=new T.LineBasicMaterial({color:'#c1d9e1',transparent:true,depthWrite:false,opacity:0});
  const drops=new T.LineSegments(geometry,mat);drops.frustumCulled=false;drops.renderOrder=3;scene.add(drops);
  return (t,eye,amount)=>{
    drops.visible=amount>.012;if(!drops.visible)return;
    mat.opacity=.40*amount;
    drops.position.copy(eye);
    for(let i=0;i<n;i++){
      const [a,b,c,d]=values[i],phase=(b+t*(.71+d*.25))%1;
      const x=(a-.5)*24+phase*2.1,y=9-phase*18,z=(c-.5)*24,length=.14+d*.49;
      positions.setXYZ(i*2,x,y,z);
      positions.setXYZ(i*2+1,x+length*.14,y-length,z);
    }
    positions.needsUpdate=true;geometry.setDrawRange(0,Math.floor(n*amount)*2);
  };
}
