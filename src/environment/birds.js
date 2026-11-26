import * as T from 'three';
import {smooth} from '../world/route.js';

const between=(a,b)=>a+(b-a)*Math.random();

export function createBirds(scene){
  const flock=new T.Group(),members=[];
  const wingGeo=new T.BufferGeometry();
  wingGeo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,.45,.11,.07,1.11,.025,.30,.58,.095,.28,0,0,.16],3));
  wingGeo.setIndex([0,1,3,1,2,3,0,3,4]);
  const material=new T.MeshBasicMaterial({color:0x374448,side:T.DoubleSide});
  for(let i=0;i<7;i++){
    const body=new T.Group();
    const right=new T.Mesh(wingGeo,material),left=new T.Mesh(wingGeo,material);left.scale.x=-1;
    body.add(left,right);flock.add(body);members.push({body,left,right});
  }
  flock.visible=false;scene.add(flock);
  const center=new T.Vector3(),velocity=new T.Vector3(),local=new T.Vector3(),from=new T.Vector3(),
    forward=new T.Vector3(),side=new T.Vector3(),screen=new T.Vector3(),ray=new T.Raycaster();
  let next=NaN,flight=null,id=0,lastSightTime=-Infinity,lastSightFrame=null,clear=false;
  function reset(){
    next=NaN;flight=null;clear=false;lastSightTime=-Infinity;
    flock.visible=false;
  }
  function update(t,hour,rain,camera,subject,frame){
    if(!Number.isFinite(next))next=t+between(6,20);
    const favorable=smooth(5.5,7.5,hour)*(1-smooth(18.2,20,hour))*(1-.95*rain);
    if(t>=next&&!flight){
      if(favorable>.20&&Math.random()<.30+.65*favorable){
        const direction=Math.random()<.5?-1:1;
        camera.getWorldDirection(forward);forward.y=0;forward.normalize();
        side.crossVectors(forward,camera.up).normalize();
        const halfWidth=between(30,50);
        center.copy(subject).addScaledVector(forward,between(47,88));
        center.y+=between(8,17);center.addScaledVector(side,-direction*halfWidth);
        velocity.copy(side).multiplyScalar(direction*between(7.8,11.6)).addScaledVector(forward,between(1.2,3.1));
        from.copy(center).applyMatrix4(frame.toPlanet);
        velocity.transformDirection(frame.toPlanet).multiplyScalar(between(8.1,11.7));
        flight={id:++id,at:t,until:t+between(7.4,11.9),position:from.clone(),velocity:velocity.clone(),count:Math.floor(between(3,8))};
        for(const [i,m] of members.entries()){
          m.body.visible=i<flight.count;m.dx=between(-3.5,3.5);m.dy=between(-1.3,1.3);m.dz=between(-4.3,4.3);
          m.phase=between(0,Math.PI*2);m.body.scale.setScalar(between(.37,.62));
        }
      }
      // Broad, uneven gaps. Some daylight opportunities pass without a flock.
      next=t+12+(-Math.log(Math.max(.0001,Math.random()))*18)+between(3,14)+(1-favorable)*9;
    }
    if(flight&&(t>flight.until||favorable<.075))flight=null;
    flock.visible=Boolean(flight);
    if(!flight){clear=false;lastSightTime=-Infinity;return;}
    const age=t-flight.at;
    local.copy(flight.position).addScaledVector(flight.velocity,age).applyMatrix4(frame.fromPlanet);
    forward.copy(flight.velocity).transformDirection(frame.fromPlanet);
    const yaw=Math.atan2(forward.x,forward.z);
    for(const [i,m] of members.entries()){
      if(i>=flight.count)break;
      m.body.position.copy(local).addScaledVector(forward,m.dz);
      m.body.position.x+=m.dx;
      m.body.position.y+=m.dy+Math.sin(age*1.25+m.phase)*.52;
      m.body.rotation.y=yaw;
      const beat=(.12+.38*Math.sin(age*6+m.phase))*(.65+.35*Math.cos(age*.91+m.phase));
      m.left.rotation.z=-beat;m.right.rotation.z=beat;
    }
  }
  function visible(t,camera,blocks){
    if(!flock.visible||!flight)return null;
    let candidate=null,best=Infinity;
    for(let i=0;i<flight.count;i++){
      const point=members[i].body.position;
      screen.copy(point).project(camera);
      if(Math.abs(screen.x)>=.96||Math.abs(screen.y)>=.94||screen.z<=-1||screen.z>=1)continue;
      const score=screen.x**2+screen.y**2;
      if(score<best){best=score;candidate=point;}
    }
    if(!candidate){clear=false;lastSightTime=-Infinity;return null;}
    if(t-lastSightTime>.065||lastSightFrame!==candidate){
      ray.ray.origin.copy(camera.position);ray.ray.direction.subVectors(candidate,camera.position);
      ray.far=ray.ray.direction.length()-.4;ray.near=.1;ray.ray.direction.normalize();
      clear=!blocks(ray);
      lastSightTime=t;lastSightFrame=candidate;
    }
    return clear?{id:flight.id,point:candidate}:null;
  }
  return {update,visible,reset,inspect:()=>({flight:flight?.id??null,visible:flock.visible})};
}
