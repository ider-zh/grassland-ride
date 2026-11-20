import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),tau=Math.PI*2;

// The base of each panel follows the belt over the thigh. The free hem opens aft and
// sideways. Left and right share wind and saddle inputs, but have different fold phases.
export function coatPanel(parent,material,side){
  const rows=15,cols=16,uv=[],idx=[],p=new T.BufferAttribute(new Float32Array((rows+1)*(cols+1)*3),3).setUsage(T.DynamicDrawUsage);
  const swing=new Float32Array((rows+1)*(cols+1)),rate=new Float32Array(swing.length);
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    uv.push(i/cols,1-j/rows);const n=j*(cols+1)+i;
    if(i<cols&&j<rows)idx.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',p);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
  const panel=new T.Mesh(g,material);panel.frustumCulled=false;parent.add(panel);
  return (t,dt,air,gust,seatRate,roll)=>{
    for(let i=0;i<=cols;i++){
      const u=i/cols,edge=Math.pow(Math.abs(2*u-1),2),phase=side*.65+u*4;
      // A shallow vent shortens the cloth between two shaped hem points.
      const length=.655+.098*u-.075*Math.exp(-Math.pow((u-.40)/.12,2));
      let y=2.055,z=-.146+.294*u;
      for(let j=0;j<=rows;j++){
        const n=j*(cols+1)+i,q=j/rows,free=q*q;
        const breeze=gust*side*.10,flutter=Math.sin(t*(5.4+.33*side)-q*6+phase);
        const load=.12+.22*u+air*(.82+.19*u)+breeze-.45*seatRate
          +(.05+.09*air)*flutter*(.30+edge);
        if(j){
          const parent=swing[n-cols-1];
          const goal=j===1?load:.67*parent+.33*load;
          const stiff=134-38*q+18*(1-edge);
          rate[n]+=((goal-swing[n])*stiff-rate[n]*(15-3.5*q))*dt;
          swing[n]+=rate[n]*dt;
          const angle=T.MathUtils.clamp(swing[n]*Math.sin(q*1.56),-.32,1.55);
          const segment=length/rows;
          y-=segment*Math.cos(angle);z+=segment*Math.sin(angle);
        }
        const fold=Math.cos(u*15-.65+q*(1.65+air)+free*.55*flutter);
        const drape=Math.sin(Math.min(1,q*1.56)*Math.PI*.5);
        const fan=free*(.055+.13*air+.058*edge*air+.042*gust*side+.060*fold);
        const x=side*(.163+.251*drape+fan+.014*q*fold)+roll*.08*free;
        p.setXYZ(n,x,y+free*(.022*fold+.023*flutter*air),z+.033*q*fold+.048*u*q);
      }
    }
    p.needsUpdate=true;g.computeVertexNormals();
  };
}
// Angle springs transport bends down a strip of constant-length cloth. The knot
// holds its heading while the narrowing free edge can roll over or sag between gusts.
export function scarf(parent,material){
  const rows=16,cols=4,idx=[],colors=[],points=new T.BufferAttribute(new Float32Array((rows+1)*(cols+1)*3),3).setUsage(T.DynamicDrawUsage);
  const chain=Array.from({length:rows},()=>({pitch:-.24,yaw:.10,twist:0,vp:0,vy:0,vt:0}));
  for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){
    const n=j*(cols+1)+k;
    if(j<rows&&k<cols)idx.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);
    const trim=k===0||k===cols;
    colors.push(trim?1.25:1,trim?1.5:.95,trim?1.26:1);
  }
  const g=new T.BufferGeometry();g.setIndex(idx);g.setAttribute('position',points);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const strip=new T.Mesh(g,material);parent.add(strip);strip.frustumCulled=false;
  const tip=V(),axis=V(),across=V(),normal=V();
  return (dt,time,air,gust,seatRate,turn)=>{
    const steps=Math.max(1,Math.ceil(dt*90)),h=dt/steps;
    for(let k=0;k<steps;k++)for(let j=0;j<rows;j++){
      const q=(j+.5)/rows,n=chain[j],last=chain[Math.max(0,j-1)],t=time-dt+(k+1)*h;
      const flutter=Math.sin(t*(5.3+air)-q*7.4+.53*Math.sin(t*1.82));
      const weight=.25+.29*q,gain=.14+.86*q;
      const pitch=-.79+.72*air+.30*gust-.57*seatRate + gain*(.23+.31*air+.24*gust)*flutter;
      const yaw=.14+.46*gust+.20*Math.sin(t*2.1-q*4.6)*gain-.26*turn;
      const twist=.67+gain*((.39+.59*gust)*Math.sin(t*4.6-q*6.7)+.59*flutter);
      const targetP=j?(1-weight)*last.pitch+weight*pitch:-.12+.16*air-.20*seatRate;
      const targetY=j?(1-weight)*last.yaw+weight*yaw:.20;
      const targetT=j?.63*last.twist+.37*twist:.31;
      const spring=205-100*q,damp=17-7*q;
      n.vp+=((targetP-n.pitch)*spring-damp*n.vp)*h;n.pitch+=h*n.vp;
      n.vy+=((targetY-n.yaw)*spring-damp*n.vy)*h;n.yaw+=h*n.vy;
      n.vt+=((targetT-n.twist)*spring-damp*n.vt)*h;n.twist+=h*n.vt;
    }
    tip.set(.093,.036,.049);
    for(let j=0;j<=rows;j++){
      const q=j/rows,n=chain[Math.max(0,j-1)],c=Math.cos(n.pitch);
      axis.set(Math.sin(n.yaw)*c,Math.sin(n.pitch),Math.cos(n.yaw)*c);
      if(j)tip.addScaledVector(axis,.82/rows);
      across.set(1,0,0).addScaledVector(axis,-axis.x).normalize().applyAxisAngle(axis,n.twist);
      normal.crossVectors(axis,across);
      for(let k=0;k<=cols;k++){
        const u=k/cols-.5,w=u*(.066+.039*Math.sin(q*2.1));
        const ridge=.013*(1-4*u*u)*(.5+q),notch=j===rows?.025*(1-2*Math.abs(u)):0;
        points.setXYZ(j*(cols+1)+k,tip.x+across.x*w+normal.x*ridge-axis.x*notch,tip.y+across.y*w+normal.y*ridge-axis.y*notch,tip.z+across.z*w+normal.z*ridge-axis.z*notch);
      }
    }
    points.needsUpdate=true;g.computeVertexNormals();
  };
}
export function dressedLimb(parent,mat,rx,rz){
  const g=new T.SphereGeometry(1,12,11),m=new T.Mesh(g,mat),v=V(),up=V(0,1,0);m.frustumCulled=false;parent.add(m);
  return (a,b)=>{v.subVectors(b,a);m.position.copy(a).addScaledVector(v,.5);m.scale.set(rx,v.length()*.61,rz);m.quaternion.setFromUnitVectors(up,v.normalize());};
}
// A fixed length of leather is paid out for each seat position. Fit its arc
// between the grip and the bit, with clearance round the horse's cheek.
export function rein(parent,mat,side){
  const rows=25,sides=8,g=new T.BufferGeometry(),idx=[],colors=[];
  const p=new T.BufferAttribute(new Float32Array(rows*sides*3),3).setUsage(T.DynamicDrawUsage);
  const delta=V(),tangent=V(),width=V(),edge=V(),center=V();
  const arch=Array.from({length:rows},(_,i)=>Math.sin(Math.PI*i/(rows-1)));
  const slope=Array.from({length:rows},(_,i)=>Math.PI*Math.cos(Math.PI*i/(rows-1)));
  for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){
    const k=j*sides+i,h=j*sides+(i+1)%sides;
    if(j)idx.push(k-sides,h-sides,k,k,h-sides,h);
    const piping=i%4===0;
    colors.push(1,piping?.75:.98,piping?.51:.96);
  }
  g.setIndex(idx);g.setAttribute('position',p);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const mesh=new T.Mesh(g,mat);mesh.frustumCulled=false;parent.add(mesh);
  let sag=.12;
  return (hand,bit,paid,dt)=>{
    delta.subVectors(bit,hand);
    const bow=side*.12;
    function arc(depth){
      let length=0;
      for(let j=2;j<rows;j+=2){
        const h=2/(rows-1),bend=arch[j]-arch[j-2];
        length+=Math.hypot(delta.x*h+bow*bend,delta.y*h-depth*bend,delta.z*h);
      }
      return length;
    }
    let lo=.012,hi=.33;
    for(let k=0;k<9;k++){
      const mid=(lo+hi)*.5;
      if(arc(mid)<paid)lo=mid;else hi=mid;
    }
    const target=(lo+hi)*.5;
    sag=T.MathUtils.lerp(sag,target,1-Math.exp(-dt*(target<sag?36:17)));
    for(let j=0;j<rows;j++){
      center.copy(hand).addScaledVector(delta,j/(rows-1));center.x+=bow*arch[j];center.y-=sag*arch[j];
      tangent.copy(delta);tangent.x+=bow*slope[j];tangent.y-=sag*slope[j];tangent.normalize();
      width.set(0,1,0).addScaledVector(tangent,-tangent.y).normalize();edge.crossVectors(tangent,width);
      for(let i=0;i<sides;i++){
        const a=.012*Math.cos(i*tau/sides),b=.005*Math.sin(i*tau/sides);
        p.setXYZ(j*sides+i,center.x+width.x*a+edge.x*b,center.y+width.y*a+edge.y*b,center.z+width.z*a+edge.z*b);
      }
    }
    p.needsUpdate=true;g.computeVertexNormals();return sag;
  };
}

// Solve a bent two-link arm to a spring-following wrist; rotate the closed
// hand between the sleeve direction and the line of pull through the grip.
export function ridingArm(side,upper,forearm,cuff,palm,strap){
  const wrist=V(),velocity=V(),goal=V(),direction=V(),pole=V(),elbow=V(),grip=V(),fore=V(),pull=V();
  const handAxis=V(0,0,-1),rotation=new T.Quaternion(),gripLocal=V(-side*.014,-.010,-.079);
  const upperLength=.293,foreLength=.262;
  let ready=false,sag=0;
  return {
    inspect:()=>({wrist:wrist.toArray(),elbow:elbow.toArray(),grip:grip.toArray(),sag}),
    update(shoulder,bit,run,turn,dt){
      // Measure actual bit displacement relative to the mean neck angle in each gait.
      const nod=bit.y-(2.066-.19*run),reach=bit.z-(-1.442-.09*run);
      goal.set(side*(.231+.025*run)+.026*turn+.23*(shoulder.x-side*.174),
        2.141-.023*run+.84*nod+.24*(shoulder.y-(2.43-.12*run)),
        -.391-.177*run+.64*reach+.56*nod+.25*(shoulder.z-(-.063-.30*run)));
      if(!ready){wrist.copy(goal);ready=true;}
      const spring=145+run*43;
      velocity.addScaledVector(direction.subVectors(goal,wrist),spring*dt).multiplyScalar(Math.exp(-12*dt));
      wrist.addScaledVector(velocity,dt);
      // Once the leather straightens, contact carries the wrist forward on the
      // same frame. Reserve the arc round the cheek when measuring available reach.
      const paid=1.048-.083*run+side*turn*.012;
      grip.copy(gripLocal).applyQuaternion(palm.quaternion).add(wrist);
      pull.subVectors(bit,grip);
      const takeUp=Math.max(0,pull.length()+.037-paid);
      pull.normalize();wrist.addScaledVector(pull,takeUp);
      if(takeUp>0)velocity.addScaledVector(pull,-Math.min(0,velocity.dot(pull)));
      direction.subVectors(wrist,shoulder);
      const span=T.MathUtils.clamp(direction.length(),.15,upperLength+foreLength-.009);
      direction.normalize();wrist.copy(shoulder).addScaledVector(direction,span);
      pole.set(side*.34,-.93,.76);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
      const along=(upperLength**2-foreLength**2+span**2)/(2*span);
      elbow.copy(shoulder).addScaledVector(direction,along).addScaledVector(pole,Math.sqrt(Math.max(0,upperLength**2-along**2)));
      upper(shoulder,elbow);forearm(elbow,wrist);
      fore.subVectors(wrist,elbow).normalize();pull.subVectors(bit,wrist).normalize();
      fore.lerp(pull,.45).normalize();rotation.setFromUnitVectors(handAxis,fore);
      palm.position.copy(wrist);palm.quaternion.slerp(rotation,dt?1-Math.exp(-17*dt):1);
      cuff.position.lerpVectors(elbow,wrist,.91);cuff.quaternion.copy(rotation);
      grip.copy(gripLocal).applyQuaternion(palm.quaternion).add(wrist);
      sag=strap(grip,bit,paid,dt);
    }
  };
}
