import * as T from 'three';
import {geographic,relief,RADIUS,surfacePoint} from './route.js';

const v=()=>new T.Vector3();
// A tangent coordinate system fixed to this longitude. Terrain, rigid
// props, collision and hoof anchors use the same transforms across rebases.
export function createFrame(s){
  const a=s/RADIUS,c=Math.cos(a),n=Math.sin(a);
  const up=new T.Vector3(n,0,c),right=new T.Vector3(0,-1,0),back=new T.Vector3(-c,0,n);
  const origin=up.clone().multiplyScalar(RADIUS);
  const toPlanet=new T.Matrix4().makeBasis(right,up,back).setPosition(origin);
  const fromPlanet=toPlanet.clone().invert();
  const a0=v(),a1=v(),a2=v(),ray=v();
  const project=(p,out=v())=>out.set(p.x,p.y,p.z).applyMatrix4(fromPlanet);
  function at(s,lateral=0){
    project(surfacePoint(s,lateral),a0);
    project(surfacePoint(s-.4,lateral),a1);project(surfacePoint(s+.4,lateral),a2);
    const fx=a2.x-a1.x,fz=a2.z-a1.z,norm=Math.hypot(fx,fz)||1;
    return {x:a0.x,y:a0.y,z:a0.z,yaw:Math.atan2(-fx,-fz),fx:fx/norm,fz:fz/norm,rx:-fz/norm,rz:fx/norm};
  }
  function ground(x,z){
    const radial=x*x+z*z;
    let dy=Math.sqrt(Math.max(1,RADIUS*RADIUS-radial))-RADIUS;
    // Solve for terrain under a local vertical ray. At local interaction
    // distances the radius/elevation coupling converges in two iterations.
    for(let i=0;i<3;i++){
      ray.set(x,dy,z).applyMatrix4(toPlanet);
      const {s,l}=geographic(ray.x,ray.y,ray.z),r=RADIUS+relief(s,l);
      dy=Math.sqrt(Math.max(1,r*r-radial))-RADIUS;
    }
    return dy;
  }
  return {at,ground,project,toPlanet,fromPlanet};
}
