import * as T from 'three';

const tau=2*Math.PI, sine=Math.sin, mix=T.MathUtils.lerp;
const unit=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=unit(v);return v*v*(3-2*v);};
const frac=v=>v-Math.floor(v);
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);

// Centreline sections from the shoulder or hip to the coronet. Two widths define the
// transverse and sagittal profile, so the forearm, gaskin and cannon read differently.
const foreProfile=[
  [0,0,.094,.14],[0,.24,.142,.20],[0,.56,.130,.166],[0,.84,.110,.128],
  [1,0,.088,.100],[1,.22,.091,.108],[1,.53,.071,.083],[1,.84,.054,.060],
  [2,0,.058,.069],[2,.16,.045,.049],[2,.52,.038,.043],[2,.82,.042,.046],
  [3,0,.053,.058],[3,.42,.042,.043],[3,1,.050,.058]
];
const hindProfile=[
  [0,0,.12,.16],[0,.18,.181,.237],[0,.45,.178,.218],[0,.74,.143,.163],
  [1,0,.103,.123],[1,.22,.111,.125],[1,.51,.084,.098],[1,.80,.056,.066],
  [2,0,.067,.084],[2,.18,.048,.054],[2,.51,.038,.045],[2,.82,.042,.050],
  [3,0,.054,.061],[3,.45,.043,.047],[3,1,.050,.060]
];
function limb(root,fore,sock){
  const rows=fore?foreProfile:hindProfile.filter(row=>row[0]>=2),n=14,idx=[],colors=[];
  const pos=new T.BufferAttribute(new Float32Array(rows.length*n*3),3).setUsage(T.DynamicDrawUsage);
  const norm=new T.BufferAttribute(new Float32Array(pos.array.length),3).setUsage(T.DynamicDrawUsage);
  const cos=[],sin=[],bay=new T.Color('#985735'),brown=new T.Color('#6b402b'),dark=new T.Color('#352f2b'),white=new T.Color('#c6b395');
  const centers=rows.map(()=>V()),smoothCenters=rows.map(()=>V());
  rows.forEach(([bone,f],i)=>{
    for(let j=0;j<n;j++){
      const a=j/n*tau;if(!i){cos.push(Math.cos(a));sin.push(sine(a));}
      const depth=(bone+f)/4;
      const color=bay.clone().lerp(brown,smooth((depth-.16)/.33)).lerp(dark,smooth((depth-.39)/.28));
      if(sock)color.lerp(white,smooth((depth-.65-.035*sine(a*2))/.10));
      colors.push(color.r,color.g,color.b);
      if(i){const k=i*n+j,h=i*n+(j+1)%n;idx.push(k-n,h-n,k,h-n,h,k);}
    }
  });
  const g=new T.BufferGeometry();g.setIndex(idx);g.setAttribute('position',pos);g.setAttribute('normal',norm);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const mesh=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.82,side:T.DoubleSide}));
  mesh.frustumCulled=false;root.add(mesh);
  return (joints,compression,side)=>{
    for(let i=0;i<rows.length;i++){const [b,f]=rows[i];centers[i].lerpVectors(joints[b],joints[b+1],f);
      if(b===0){
        const belly=sine(Math.PI*f);
        centers[i].x+=side*belly*(fore?.020:.008);
        centers[i].z+=(fore?-.18:.095)*belly;
      }
    }
    for(let i=0;i<rows.length;i++){
      smoothCenters[i].copy(centers[i]).multiplyScalar(.6)
        .addScaledVector(centers[Math.max(0,i-1)],.2).addScaledVector(centers[Math.min(rows.length-1,i+1)],.2);
    }
    smoothCenters[0].copy(centers[0]);smoothCenters[rows.length-1].copy(centers[rows.length-1]);
    for(let i=0;i<rows.length;i++){
      const a=smoothCenters[Math.max(0,i-1)],b=smoothCenters[Math.min(i+1,rows.length-1)],c=smoothCenters[i];
      const len=Math.hypot(b.y-a.y,b.z-a.z)||1,ny=(b.z-a.z)/len,nz=(a.y-b.y)/len;
      const [bone,along,baseWidth,baseDepth]=rows[i];
      // Broad at the rump and shoulder, narrowing into the long tendons below the hock.
      const belly=bone===0?sine(Math.PI*(.12+.76*along)):bone===1?.54*(1-along):0;
      const muscle=belly*((fore?.24:.31)+compression*(fore?.08:.15));
      const rx=baseWidth*(1+muscle*.60),rz=baseDepth*(1+muscle*1.2);
      for(let j=0;j<n;j++){
        const k=i*n+j;pos.setXYZ(k,c.x+rx*cos[j],c.y+rz*sin[j]*ny,c.z+rz*sin[j]*nz);
      }
    }
    pos.needsUpdate=true;g.computeVertexNormals();
  };
}
// One continuous pressure pulse per hind contact. The two hind legs arrive a fraction
// of a cycle apart, so the pelvis transfers load across the croup.
function hindPressure(phase,duty){
  const u=frac(phase)/duty;
  return u<1?sine(Math.PI*u)**2:0;
}
function makeHoof(root){
  const pos=[],idx=[],n=16;
  for(const [y,w,l,offset] of [[.004,.064,.093,-.018],[.021,.068,.094,-.016],[.089,.050,.064,0]]){
    for(let i=0;i<n;i++){
      const a=i*tau/n;pos.push(w*Math.cos(a),y,l*sine(a)+offset);
    }
  }
  for(let i=0;i<n;i++){const j=(i+1)%n;for(let r=0;r<2;r++){
    const k=r*n;idx.push(k+i,k+n+i,k+j,k+j,k+n+i,k+n+j);
  }if(i>0&&i<n-1)idx.push(0,i,i+1,2*n,2*n+i+1,2*n+i);}
  const g=new T.BufferGeometry();g.setIndex(idx);g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  const shoe=new T.Mesh(g,new T.MeshStandardMaterial({color:0x443d34,roughness:.65,side:T.DoubleSide}));root.add(shoe);return shoe;
}
export function createStride(root,floating=true){
  const feet=Array.from({length:4},(_,i)=>{
    const fore=i<2,side=i%2?1:-1;
    return {fore,side,x:side*(fore?.205:.235),z:fore?-.54:.57,
      draw:limb(root,fore,i===2),shoe:makeHoof(root),joints:Array.from({length:5},()=>V()),
      stance:null,anchor:V(),sole:V(),residual:V()};
  });
  let phase=0,lastDistance=NaN;
  const walk=[.25,.75,0,.5],trot=[.5,0,0,.5],gallop=[.29,.445,0,.145];
  const inverse=new T.Matrix4(),world=V(),local=V(),predicted=V();
  const pose={phase:0,run:0,trot:0,bob:0,pitch:0,roll:0,impacts:0};
  return {feet,pose,update(dt,speed,turn,distance,terrain,body){
    const fast=smooth((speed-3.75)/3.65),up=smooth((speed-1.85)/1.7);
    const hz=mix(mix(.96,1.40,up),1.67,fast),stride=speed/hz;
    phase=frac(phase+dt*hz);const rad=tau*phase;
    const foreDuty=mix(mix(.65,.419,up),.273,fast),hindDuty=foreDuty+.056*fast;
    const left=hindPressure(phase,hindDuty)*fast;
    const right=hindPressure(phase-gallop[3],hindDuty)*fast;
    const gather=(left+right)*.68;
    const drive=(hindPressure(phase-.107,hindDuty)+hindPressure(phase-gallop[3]-.107,hindDuty))*.68*fast;
    const bob=mix(mix(-.020*Math.cos(2*rad-.9),-.047*Math.cos(2*rad-1.7),up),.076*Math.cos(rad+.64)-.024*Math.cos(2*rad-1.4)-.061*gather+.055*drive,fast);
    const pitch=mix(.021*sine(2*rad+.4),.100*sine(rad+.54)+.075*gather-.050*drive,fast);
    const roll=(1-up)*.027*sine(rad)+fast*.021*sine(rad-.6)+.051*(left-right)-turn*.025;
    Object.assign(pose,{phase,run:fast,trot:up,bob,pitch,roll,gather,drive,left,right,impacts:0});
    // Rotate about the middle of the barrel rather than the ground below the horse.
    body.rotation.set(pitch,0,roll);body.position.set(.025*(left-right),1.45+bob,.040*gather-.065*drive).sub(local.set(0,1.45,0).applyEuler(body.rotation));
    root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();
    const reset=!Number.isFinite(lastDistance)||Math.abs(distance-lastDistance)>2;
    lastDistance=distance;
    for(let i=0;i<4;i++){
      const f=feet[i],strike=mix(mix(walk[i],trot[i]+(i===1?1:0),up),gallop[i]+(i===1?1:0),fast);
      const duty=f.fore?foreDuty:hindDuty;
      const q=frac(phase-strike),stance=q<duty,u=unit((q-duty)/(1-duty)),load=stance?sine(Math.PI*q/duty):0;
      // The swing has the same rearward velocity at release and touchdown as a planted hoof.
      const reach=stance?(q-duty*.5)*stride:stride*(duty*.5-smooth(u)*duty+(1-duty)*u*(1-u)*(1-2*u));
      const lift=(f.fore?.115:.095)+up*.105+fast*(f.fore?.19:.198);
      const arc=sine(Math.PI*u)**2*(1+.42*sine(tau*u));
      const lead=fast*(i===1?-.10:i===2?.075:0);
      predicted.set(f.x+f.side*.025*arc,0,f.z+lead+reach);
      world.copy(predicted).applyMatrix4(root.matrixWorld);world.z-=floating?distance:0;
      world.y=terrain(world.x,-world.z);
      if(stance){
        if(reset||!f.stance){f.anchor.copy(world);if(!reset)pose.impacts++;}
        world.copy(f.anchor);
      }else{
        if(!reset&&f.stance){
          // Release the actual planted hoof, including displacement accumulated while steering.
          f.residual.subVectors(f.anchor,world);
        }else if(reset)f.residual.set(0,0,0);
        world.addScaledVector(f.residual,1-smooth(u/.44));
        world.y=terrain(world.x,-world.z)+lift*arc;
      }
      f.stance=stance;f.sole.copy(world);world.z+=floating?distance:0;
      const sole=local.copy(world).applyMatrix4(inverse);
      // Toe-off rotates the heel forward about the toe. The heel clears the ground before lift.
      const breakover=.38+(f.fore?0:.23*fast);
      const hoofAngle=stance?-breakover*smooth((q/duty-.73)/.27):
        -breakover*(1-smooth(u/.26))-.69*sine(Math.PI*u)**2+.16*sine(tau*u);
      f.shoe.position.copy(sole);f.shoe.rotation.x=hoofAngle;
      f.shoe.position.y+=Math.max(0,-sine(hoofAngle)*.105);
      const [hip,prox,knee,fet,cor]=f.joints;
      cor.set(0,.077,.003).applyEuler(f.shoe.rotation).add(f.shoe.position);
      fet.set(f.x,cor.y+.105-.040*load,cor.z+.040+.055*load+.033*arc);
      const sweep=clampSweep(reach),liftK=arc*(.06+.09*fast);
      const compression=f.fore?load:(f.side<0?left:right);
      f.push=stance?load*smooth((q/duty-.22)/.48):0;
      const extension=f.fore?0:fast*(stance?smooth((q/duty-.39)/.55):1-smooth(u/.25));
      hip.set(f.x*(f.fore?.94:.92),1.595-(f.fore?0:.075*compression)+.055*extension,
        f.fore?-.395:.62-.044*extension).applyMatrix4(body.matrix);
      const a=f.fore?.565:.575,b=f.fore?.466:.48,proximal=f.fore?.55:.575,maxReach=a+b-.006;
      // Rotate the humerus/femur inside the reachable arc of the distal chain.
      // At full extension the shoulder can glide a little over the rib cage.
      let gy=fet.y-hip.y,gz=fet.z-hip.z,gap=Math.hypot(gy,gz);
      if(gap>proximal+maxReach){
        const travel=gap-proximal-maxReach;
        hip.y+=travel*gy/gap;hip.z+=travel*gz/gap;gy=fet.y-hip.y;gz=fet.z-hip.z;gap=Math.hypot(gy,gz);
      }
      const aim=Math.atan2(gz,-gy);
      const limit=Math.acos(Math.max(-1,Math.min(1,(gap*gap+proximal*proximal-maxReach*maxReach)/(2*gap*proximal))));
      const preferred=Math.atan2((f.fore?-.075:-.248-.14*compression-.254*extension)+sweep*(f.fore?.50:.57),.50-liftK);
      const angle=aim+Math.max(-limit,Math.min(limit,preferred-aim));
      prox.set(f.x,hip.y-proximal*Math.cos(angle),hip.z+proximal*Math.sin(angle));
      const dy=fet.y-prox.y,dz=fet.z-prox.z,len=Math.max(.001,Math.hypot(dy,dz));
      const along=(a*a-b*b+len*len)/(2*len);
      const bend=Math.sqrt(Math.max(.0003,a*a-along*along))*(f.fore?1:-1);
      knee.set((prox.x+fet.x)*.5,prox.y+dy/len*along-dz/len*bend,prox.z+dz/len*along+dy/len*bend);
      f.draw(f.joints,compression,f.side);
    }
    return pose;
  }};
}
function clampSweep(value){return Math.max(-.8,Math.min(.8,value));}
