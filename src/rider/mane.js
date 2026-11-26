import * as T from 'three';

// Each station is a cross-section of the neck: height, centre aft, width, depth.
export const neckProfile=[[-.24,.018,.314,.341],[.012,-.055,.337,.437],[.24,-.155,.303,.401],
  [.42,-.249,.257,.339],[.58,-.342,.215,.280],[.735,-.427,.163,.203],[.83,-.45,.102,.119]];

export function createMane(neck){
  const rings=9,sides=6,locks=[],indices=[],colors=[];
  const palette=['#3c2c28','#50392e','#5e4130','#6b4b37','#49342c'];
  // The undercoat hugs the neck. Stagger the cover locks and small guard hairs
  // so the crest still has a continuous dark silhouette between moving tips.
  for(let layer=0;layer<3;layer++){
    const count=[24,19,27][layer];
    for(let i=0;i<count;i++){
      const at=(i+.25+.25*Math.sin(i*4.3+layer))/count;
      const seed=i*2.399+layer*.88,exposure=[.19,.77,1][layer];
      const length=[.23,.34,.37][layer]*(.83+.22*Math.sin(at*Math.PI)+.13*Math.cos(seed))*(1-.26*at*at);
      const lock={y:.822-.615*at,length,seed,exposure,at,
        width:[.053,.048,.013][layer]*(.87+.13*Math.cos(seed)),angle:new Float32Array(rings),rate:new Float32Array(rings)};
      const base=locks.length*rings*sides;locks.push(lock);
      const color=new T.Color(palette[(i*3+layer)%palette.length]);
      for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){
        const shade=.83+.24*Math.cos(k*Math.PI/3)+.05*j/rings;
        colors.push(color.r*shade,color.g*shade,color.b*shade);
        if(j<rings-1){
          const a=base+j*sides+k,b=base+j*sides+(k+1)%sides;
          indices.push(a,b,a+sides,b,b+sides,a+sides);
        }
      }
    }
  }
  const geom=new T.BufferGeometry(),pos=new T.BufferAttribute(new Float32Array(colors.length),3).setUsage(T.DynamicDrawUsage);
  geom.setIndex(indices);geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));geom.setAttribute('position',pos);
  const mesh=new T.Mesh(geom,new T.MeshStandardMaterial({vertexColors:true,roughness:.83,side:T.DoubleSide}));
  mesh.frustumCulled=false;neck.add(mesh);
  const centre=new T.Vector3(),prev=new T.Vector3(),tangent=new T.Vector3(),width=new T.Vector3(),thick=new T.Vector3();
  const path=Array.from({length:rings},()=>new T.Vector3());
  return (t,dt,air,gust,nodRate)=>{
    let vertex=0;
    for(const lock of locks){
      const {seed,at,exposure:e}=lock;
      for(let j=0;j<rings;j++){
        const q=j/(rings-1),free=q*q;
        const ripple=Math.sin(t*(4.6+e)+seed*.38-4*q-4*at);
        const drive=air*(.36+.64*e)+gust*.15*e+.11*nodRate*(1-at)+(.025+.09*air)*e*ripple;
        const target=j?.58*lock.angle[j-1]+.42*drive:drive;
        const stiffness=135-35*q-26*e;
        lock.rate[j]+=((target-lock.angle[j])*stiffness-lock.rate[j]*(15-4*e))*dt;
        lock.angle[j]+=lock.rate[j]*dt;
        const lift=T.MathUtils.clamp(lock.angle[j],-.15,1.25);
        // The exposed middle catches the air first; weight rounds the last third back down.
        const sail=q*q*(2.1-1.1*q),tipWeight=T.MathUtils.smoothstep(q,.60,1);
        const y=lock.y-lock.length*q+lock.length*lift*(sail*(.74+.34*e)-.17*tipWeight);
        let k=1;while(k<neckProfile.length-1&&neckProfile[k][0]<y)k++;
        const lo=neckProfile[k-1],hi=neckProfile[k],w=T.MathUtils.clamp((y-lo[0])/(hi[0]-lo[0]),0,1);
        const z=T.MathUtils.lerp(lo[1],hi[1],w),rx=T.MathUtils.lerp(lo[2],hi[2],w),rz=T.MathUtils.lerp(lo[3],hi[3],w);
        const wrap=(1.80+.16*Math.sin(seed))*(1-Math.exp(-2.3*q))*(1-.49*lift);
        const gap=.007+.025*e*q+free*e*(.022*ripple+.035*gust+.065*air);
        path[j].set(-(rx+gap)*Math.sin(wrap)-.019*q,y,z+(rz+gap)*Math.cos(wrap)+free*lift*(.15+.17*e)*(1-.50*at*at));
      }
      for(let j=0;j<rings;j++){
        const q=j/(rings-1);
        centre.copy(path[j]);prev.copy(path[Math.max(0,j-1)]);
        tangent.subVectors(path[Math.min(rings-1,j+1)],prev).normalize();
        width.set(0,1,-.7).addScaledVector(tangent,-(tangent.y-.7*tangent.z)).normalize();
        thick.crossVectors(tangent,width);
        const radius=lock.width*(.65+.60*Math.sin(q*Math.PI))*(1-.985*q);
        for(let k=0;k<sides;k++){
          const a=radius*Math.cos(k*Math.PI/3),b=radius*.38*Math.sin(k*Math.PI/3);
          pos.setXYZ(vertex++,centre.x+a*width.x+b*thick.x,centre.y+a*width.y+b*thick.y,centre.z+a*width.z+b*thick.z);
        }
      }
    }
    pos.needsUpdate=true;geom.computeVertexNormals();
  };
}
