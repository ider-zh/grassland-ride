import * as T from 'three';
import {meadowWind} from '../world/route.js';

const dockSegments=2, freeSegments=10, rings=dockSegments+freeSegments+1, sides=6;
const tau=Math.PI*2, vec=()=>new T.Vector3(), vectors=n=>Array.from({length:n},vec);
const smooth=T.MathUtils.smoothstep;

// Coordinates across/behind the dock, free length, breadth and wind exposure.
// The heavier centre stays cohesive. The longer guard hairs leave from either flank.
const grooming=[
  [-.19,-.10,.76,.052,.13],[.24,-.14,.80,.046,.18],[.02,.39,.83,.039,.30],
  [-.88,-.34,1.02,.035,.91],[-.84,.48,.94,.045,.78],[-.42,.91,1.00,.032,.98],
  [.32,.94,.89,.036,.83],[.92,.39,1.035,.035,1.00],[.83,-.43,.96,.037,.87],
  [.11,-.88,.90,.033,.64]
];

function createGuide([x,z,length,breadth,exposure],i){
  const nodes=vectors(rings),frameX=vectors(rings),frameZ=vectors(rings);
  return {x,z,length,breadth,exposure,nodes,frameX,frameZ,
    seed:i*2.39996,stiffness:(236-102*exposure)/length,
    yaw:new Float32Array(freeSegments),yawRate:new Float32Array(freeSegments),
    pitch:new Float32Array(freeSegments),pitchRate:new Float32Array(freeSegments)};
}

function groomMesh(body,guides){
  const fibres=[],indices=[],tints=[];
  const palette=['#392820','#473025','#3e2b23','#5a4030','#694e39','#533a2b'];
  for(const [i,g] of guides.entries()){
    // One flat lock, three smaller tapered ribbons and two escaping wisps per guide.
    for(let k=0;k<6;k++){
      const angle=k*2.39996+i*.67,outer=k>3;
      const f={g,k,x:k===0?0:Math.cos(angle),z:k===0?0:Math.sin(angle),
        width:g.breadth*[1,.49,.37,.32,.15,.115][k],phase:angle,
        trim:[.97,1.025,.93,.89,1.07,1.115][k]};
      const off=fibres.length*rings*sides;
      fibres.push(f);
      const color=new T.Color(palette[k===0?i%3:(i+k)%palette.length]);
      for(let j=0;j<rings;j++)for(let m=0;m<sides;m++){
        const a=tau*m/sides,q=j/(rings-1),sheen=.83+.23*Math.cos(a-.6)+.09*q+(outer?.08:0);
        tints.push(color.r*sheen,color.g*sheen,color.b*sheen);
        if(j<rings-1){const v=off+j*sides+m,n=off+j*sides+(m+1)%sides;
          indices.push(v,n,n+sides,v,n+sides,v+sides);}
      }
    }
  }
  const geom=new T.BufferGeometry(),count=fibres.length*rings*sides*3;
  const pos=new T.BufferAttribute(new Float32Array(count),3).setUsage(T.DynamicDrawUsage);
  const normal=new T.BufferAttribute(new Float32Array(count),3).setUsage(T.DynamicDrawUsage);
  geom.setIndex(indices);geom.setAttribute('position',pos);geom.setAttribute('normal',normal);
  geom.setAttribute('color',new T.Float32BufferAttribute(tints,3));
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.70,side:T.DoubleSide});
  const mesh=new T.Mesh(geom,mat);mesh.position.set(0,1.692,.956);mesh.frustumCulled=false;body.add(mesh);
  const cs=[],sn=[];for(let i=0;i<sides;i++){cs.push(Math.cos(tau*i/sides));sn.push(Math.sin(tau*i/sides));}
  const tangent=vec(),u=vec(),v=vec(),center=vec();
  return (t,run)=>{
    for(const g of guides)for(let j=0;j<rings;j++){
      tangent.subVectors(g.nodes[Math.min(j+1,rings-1)],g.nodes[Math.max(0,j-1)]).normalize();
      g.frameX[j].set(1,0,0).addScaledVector(tangent,-tangent.x).normalize();
      g.frameZ[j].crossVectors(tangent,g.frameX[j]).normalize();
    }
    let index=0;
    for(const f of fibres){
      const g=f.g;
      for(let j=0;j<rings;j++){
        const q=j/(rings-1),free=Math.max(0,(j-dockSegments)/freeSegments),tip=free*free;
        const roll=.28*Math.sin(g.seed+q*3)+q*.26*Math.sin(t*2.6+g.seed-q*5)*run;
        u.copy(g.frameX[j]).multiplyScalar(Math.cos(roll)).addScaledVector(g.frameZ[j],Math.sin(roll));
        v.copy(g.frameZ[j]).multiplyScalar(Math.cos(roll)).addScaledVector(g.frameX[j],-Math.sin(roll));
        const fan=g.breadth*(.54+.86*Math.sin(Math.PI*q)+tip*(f.k>3?1.45:.6));
        center.copy(g.nodes[j]).addScaledVector(u,f.x*fan).addScaledVector(v,f.z*fan*.63);
        center.addScaledVector(g.nodes[j],(f.trim-1)*tip);
        if(f.k>3){
          const fringe=tip*(.012+.039*run)*Math.sin(g.seed+t*(3.7+.2*f.k)-q*4.4+f.phase);
          center.addScaledVector(u,fringe).addScaledVector(v,tip*run*.020*Math.cos(t*4.1+f.phase));
        }
        const taper=(1-.965*q*q)*(.80+.60*Math.sin(Math.PI*q));
        const width=f.width*taper,thickness=width*(.55-.19*free);
        for(let i=0;i<sides;i++){
          const dx=width*cs[i],dz=thickness*sn[i],nx=cs[i]*(thickness/width),nz=sn[i],inv=1/Math.hypot(nx,nz);
          pos.setXYZ(index,center.x+dx*u.x+dz*v.x,center.y+dx*u.y+dz*v.y,center.z+dx*u.z+dz*v.z);
          normal.setXYZ(index++,(nx*u.x+nz*v.x)*inv,(nx*u.y+nz*v.y)*inv,(nx*u.z+nz*v.z)*inv);
        }
      }
    }
    pos.needsUpdate=normal.needsUpdate=true;
  };
}

export function createTail(body){
  const guides=grooming.map(createGuide),draw=groomMesh(body,guides),dock=vectors(3);
  const baseYaw=[0,0],baseRate=[0,0],basePitch=[0,0],basePitchRate=[0,0];
  let initialized=false,lastSpeed=1.65,acceleration=0,lastBob=0,bobRate=0;
  return {points:guides[0].nodes,guides,update(dt,t,speed,turn,feet,distance,bob){
    const run=smooth(speed,1.65,7.4),left=feet[2].push,right=feet[3].push;
    const drive=(left-right)*(.42+.076*speed)-turn*.14,lift=(left+right)*.20;
    if(dt>0){
      const change=(speed-lastSpeed)/dt;
      acceleration+= (T.MathUtils.clamp(change,-8,8)-acceleration)*(1-Math.exp(-dt*6));
    }
    if(dt>0&&initialized)bobRate+=(T.MathUtils.clamp((bob-lastBob)/dt,-1.8,1.8)-bobRate)*(1-Math.exp(-dt*14));
    lastBob=bob;lastSpeed=speed;
    const root=body.parent,heading=root.rotation.y,worldX=root.position.x;
    const substeps=Math.max(1,Math.ceil(dt*120)),h=dt/substeps;
    for(let step=0;step<substeps;step++){
      const time=t-dt+(step+1)*h;
      // Sample the same travelling gusts as the verge grass; rotate the lateral wind into horse space.
      const gust=meadowWind(worldX,distance,time);
      const wind=(.03+.89*gust)*Math.cos(heading)-turn*.24;
      for(let i=0;i<dockSegments;i++){
        const target=i?.77*baseYaw[i-1]+.23*drive:drive;
        baseRate[i]+=(560*(target-baseYaw[i])-28*baseRate[i])*h;baseYaw[i]+=baseRate[i]*h;
        basePitchRate[i]+=(460*(lift-basePitch[i])-27*basePitchRate[i])*h;basePitch[i]+=basePitchRate[i]*h;
      }
      for(const g of guides){
        for(let j=0;j<freeSegments;j++){
          const q=(j+.5)/freeSegments,e=g.exposure,release=smooth(q,.03,.73);
          const prevY=j?g.yaw[j-1]:baseYaw[1],prevP=j?g.pitch[j-1]:.91+basePitch[1];
          const curl=Math.sin(q*5.6+g.seed+time*(2.3+.65*e));
          // Air flows around the short dense core. Long exposed locks lift, twist and
          // recover at different rates; the dock signal propagates from the joint above.
          const lateral=g.x*(.084+run*.42)*e+wind*(.18+.81*e)+curl*(.13+.34*run)*e;
          const recovery=(.15+.20*e)*smooth(q,.52,1);
          const aft=.16+run*.32+e*run*(.40+.18*g.z)+.14*g.z-recovery
            +e*.035*acceleration+(.14+.28*run)*e*Math.cos(q*6.2+g.seed-time*3.2)
            -bobRate*(.28+.21*e)*release;
          const open=.12+.34*release;
          // A heavier core transmits the dock turn. The exposed ends lag a
          // change of direction, then recover as their aerodynamic load eases.
          const carried=(.10+.28*(1-e))*(1-.73*q)*baseYaw[1];
          const inertia=-.063*baseRate[1]*e*release;
          const targetY=(1-open)*prevY+open*lateral+carried+inertia;
          const targetP=(1-open)*prevP+open*aft;
          const spring=g.stiffness*(1.40-.50*q),damping=(1.39-.39*q)*Math.sqrt(spring);
          if(!initialized){g.yaw[j]=targetY;g.pitch[j]=targetP;}
          g.yawRate[j]+=(spring*(targetY-g.yaw[j])-damping*g.yawRate[j])*h;g.yaw[j]+=g.yawRate[j]*h;
          g.pitchRate[j]+=(spring*(targetP-g.pitch[j])-damping*g.pitchRate[j])*h;g.pitch[j]+=g.pitchRate[j]*h;
        }
      }
      initialized=true;
    }
    for(let i=0;i<2;i++){
      const a=1.16-.22*i+.10*run+basePitch[i];
      dock[i+1].set(Math.sin(baseYaw[i]),-Math.cos(a)*Math.cos(baseYaw[i]),Math.sin(a)*Math.cos(baseYaw[i])).multiplyScalar(.101).add(dock[i]);
    }
    for(const g of guides){
      for(let j=0;j<=2;j++){g.nodes[j].copy(dock[j]);g.nodes[j].x+=g.x*(.046+.013*j);g.nodes[j].z+=g.z*.042;}
      for(let j=0;j<freeSegments;j++){
        const ay=g.yaw[j],ap=g.pitch[j];
        g.nodes[3+j].set(Math.sin(ay),-Math.cos(ap)*Math.cos(ay),Math.sin(ap)*Math.cos(ay))
          .multiplyScalar(g.length/freeSegments).add(g.nodes[2+j]);
      }
    }
    draw(t,run);
  }};
}
