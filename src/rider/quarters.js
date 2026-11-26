import * as T from 'three';

const smooth=T.MathUtils.smoothstep, V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const hip=V(.216,1.595,.62),stifle=V(.235,1.065,.399),hock=V(.235,.59,.72);
// z, centre height, width, depth above and below the centreline.
// A sloping sacrum and tucked-up underside leave room for the paired hamstrings.
const sections=[
  [-1.04,1.42,.01,.03,.03],[-.9,1.46,.24,.34,.35],[-.68,1.48,.392,.485,.485],
  [-.47,1.49,.414,.522,.522],[-.23,1.44,.352,.437,.437],[.10,1.42,.344,.398,.398],
  [.32,1.49,.38,.424,.395],[.46,1.54,.426,.418,.34],[.60,1.55,.425,.416,.31],
  [.74,1.55,.397,.379,.273],[.88,1.55,.338,.303,.238],[.99,1.56,.235,.208,.181],
  [1.064,1.56,.085,.091,.085],[1.078,1.56,.006,.02,.02]
];
export function barrelSection(z){
  let i=0;while(i<sections.length-2&&z>sections[i+1][0])i++;
  const a=sections[i],b=sections[i+1],p=sections[Math.max(0,i-1)],n=sections[Math.min(i+2,sections.length-1)];
  const span=b[0]-a[0],q=T.MathUtils.clamp((z-a[0])/span,0,1);
  return a.slice(1).map((v,j)=>{
    const k=j+1,m0=(b[k]-p[k])/(b[0]-p[0])*span,m1=(n[k]-a[k])/(n[0]-a[0])*span;
    return v*(1-3*q*q+2*q*q*q)+b[k]*(3*q*q-2*q*q*q)+m0*q*(1-q)**2+m1*q*q*(q-1);
  });
}
function blend(a,b,k){const h=Math.max(0,k-Math.abs(a-b))/k;return Math.min(a,b)-k*h*h*.25;}
function muscle(x,y,z,cx,cy,cz,dy,dz,width,depth,length){
  const h=y-cy,l=z-cz,along=h*dy+l*dz,across=-h*dz+l*dy;
  return (Math.hypot((x-cx)/width,across/depth,along/length)-1)*Math.min(width,depth);
}
function field(x,y,z,ring){
  const [yc,w,top,bottom]=ring,ax=Math.abs(x);
  const saddle=smooth(z,.24,.57);
  const cleft=saddle*Math.exp(-x*x/.006)*.046;
  const ry=y>yc?Math.max(top*.55,top-cleft):bottom;
  let d=(Math.pow(Math.pow(ax/w,2.32)+Math.pow(Math.abs((y-yc)/ry),2.32),1/2.32)-1)*Math.min(w,ry);
  d=Math.max(d,-1.04-z,z-1.078);
  if(z<-.20){
    // The shoulder blade rises toward the withers; the forward mass narrows
    // into two pectorals where the humerus leaves the rib cage.
    d=blend(d,muscle(ax,y,z,.284,1.54,-.57,.88,.48,.151,.177,.435),.10);
    d=blend(d,muscle(ax,y,z,.195,1.34,-.716,.97,.22,.170,.174,.309),.082);
    const scapula=z+.60-.43*(y-1.50);
    d+=.020*Math.exp(-scapula*scapula/.004-((y-1.54)**2)/.10)*smooth(ax,.22,.38);
  }
  if(z>.08){
    // Gluteus medius, lateral thigh and the narrower caudal muscle column.
    d=blend(d,muscle(ax,y,z,.252,1.58,.592,.91,.415,.194,.245,.397),.091);
    d=blend(d,muscle(ax,y,z,.247,1.337,.591,.764,.645,.168,.187,.491),.079);
    d=blend(d,muscle(ax,y,z,.194,1.334,.737,.851,.525,.132,.136,.435),.069);
    d=blend(d,muscle(ax,y,z,.231,1.073,.443,.95,-.312,.105,.107,.187),.074);
    // Taper the gaskin along the rest tibia into the point of the hock.
    const vy=hock.y-stifle.y,vz=hock.z-stifle.z;
    const q=T.MathUtils.clamp(((y-stifle.y)*vy+(z-stifle.z)*vz)/(vy*vy+vz*vz),0,1);
    const belly=Math.sin(q*Math.PI),rx=.099-.050*q+.025*belly,rz=.11-.049*q+.033*belly;
    const calf=(Math.hypot((ax-stifle.x)/rx,(y-stifle.y-q*vy)/rz,(z-stifle.z-q*vz)/rz)-1)*rx;
    d=blend(d,calf,.057);
    // Shallow oblique division between biceps femoris and the long caudal muscles.
    const band=z-(.585+.53*(y-1.2));
    d+=.021*Math.exp(-band*band/.0018-((y-1.47)**2)/.095)*smooth(ax,.22,.36);
  }
  return d;
}
// Place the breastcollar on the same implicit chest that is polygonized below.
export function chestFront(x,y){
  let front=-1.10;
  for(let z=front+.012;z<-.24;z+=.012){
    if(field(x,y,z,barrelSection(z))<=0){
      let back=z;
      for(let i=0;i<8;i++){
        const mid=(front+back)*.5;
        if(field(x,y,mid,barrelSection(mid))>0)front=mid;else back=mid;
      }
      return front;
    }
    front=z;
  }
  return front;
}

// Weld the zero crossings of adjacent tetrahedra. The gluteals and proximal thighs
// become one indexed skin with shared normals even where the joints flex.
function surface(){
  const step=.035,nx=35,ny=50,nz=65,layer=nx*ny,count=layer*nz;
  const values=new Float32Array(count),coords=new Float32Array(count*3);
  for(let k=0;k<nz;k++){
    const z=-1.094+k*step,ring=barrelSection(z);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const v=k*layer+j*nx+i,x=(i-(nx-1)/2)*step,y=.485+j*step;
      coords[3*v]=x;coords[3*v+1]=y;coords[3*v+2]=z;values[v]=field(x,y,z,ring);
    }
  }
  const positions=[],indices=[],edges=new Map(),tetra=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
  function edge(a,b){
    const key=Math.min(a,b)*count+Math.max(a,b);
    if(edges.has(key))return edges.get(key);
    const t=values[a]/(values[a]-values[b]),id=positions.length/3;
    for(let c=0;c<3;c++)positions.push(T.MathUtils.lerp(coords[3*a+c],coords[3*b+c],t));
    edges.set(key,id);return id;
  }
  const pa=V(),ab=V(),ac=V(),outward=V();
  function tri(a,b,c,inside,out){
    pa.fromArray(positions,3*a);ab.fromArray(positions,3*b).sub(pa);ac.fromArray(positions,3*c).sub(pa);
    outward.set(coords[3*out]-coords[3*inside],coords[3*out+1]-coords[3*inside+1],coords[3*out+2]-coords[3*inside+2]);
    if(ab.cross(ac).dot(outward)>0)indices.push(a,b,c);else indices.push(a,c,b);
  }
  const delta=[0,1,nx,nx+1,layer,layer+1,layer+nx,layer+nx+1];
  for(let k=0;k<nz-1;k++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
    const base=k*layer+j*nx+i,sign=values[base]<0;
    if(delta.every(v=>(values[base+v]<0)===sign))continue;
    for(const tet of tetra){
      const neg=[],pos=[];for(const n of tet){const v=base+delta[n];(values[v]<0?neg:pos).push(v);}
      if(!neg.length||!pos.length)continue;
      if(neg.length===2){const [a,b]=neg,[c,d]=pos,u=edge(a,c),v=edge(a,d),w=edge(b,c),x=edge(b,d);tri(u,v,w,a,c);tri(v,x,w,a,c);}
      else{const [single]=neg.length===1?neg:pos,triple=neg.length===1?pos:neg;
        tri(edge(single,triple[0]),edge(single,triple[1]),edge(single,triple[2]),neg[0],pos[0]);}
    }
  }
  const g=new T.BufferGeometry();g.setIndex(indices);g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
export function createQuarters(body,hide){
  const g=surface(),pos=g.attributes.position,ids=[],weights=[],tints=[],bones=[new T.Bone()],drivers=[];
  for(const sign of [-1,1]){
    const mirror=p=>V(sign*p.x,p.y,p.z),a=mirror(hip),b=mirror(stifle),c=mirror(hock);
    for(const [from,to] of [[a,b],[b,c]]){
      const bone=new T.Bone();bone.position.copy(from);bones.push(bone);
      drivers.push({bone,axis:to.clone().sub(from).normalize()});
    }
  }
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),side=x<0?1:3;
    const rear=smooth(z,.07,.32),leg=rear*(1-smooth(y,1.09,1.77)),calf=(1-smooth(y,.92,1.17))*leg;
    const lateral=smooth(Math.abs(x),.022,.155),w=leg*lateral;
    // Follow the coat into the dark points above the hock. The colour boundary
    // shares the bend of the gaskin rather than ending at a horizontal seam.
    const point=rear*(1-smooth(y+.065*(z-.6),.61,1.24));
    const groove=Math.exp(-((z-.59-.53*(y-1.2))**2)/.0031-((y-1.46)**2)/.10)*smooth(Math.abs(x),.20,.35);
    const sheen=1+.057*Math.exp(-((z-.52)**2)/.04-((y-1.62)**2)/.06)-.085*groove;
    tints.push(sheen*(1-.68*point),sheen*(1-.57*point),sheen*(1-.42*point));
    ids.push(0,side,side+1,0);weights.push(1-w,w-calf*lateral,calf*lateral,0);
  }
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  g.setAttribute('color',new T.Float32BufferAttribute(tints,3));
  const coat=hide.clone();coat.vertexColors=true;coat.onBeforeCompile=hide.onBeforeCompile;
  const mesh=new T.SkinnedMesh(g,coat);for(const bone of bones)mesh.add(bone);body.add(mesh);mesh.bind(new T.Skeleton(bones));mesh.frustumCulled=false;
  const inverse=new T.Matrix4(),end=V();
  return feet=>{
    inverse.copy(body.matrix).invert();
    for(let j=0;j<4;j++){
      const joints=feet[2+Math.floor(j/2)].joints,segment=j%2,{bone,axis}=drivers[j];
      bone.position.copy(joints[segment]).applyMatrix4(inverse);
      end.copy(joints[segment+1]).applyMatrix4(inverse).sub(bone.position).normalize();
      bone.quaternion.setFromUnitVectors(axis,end);
    }
  };
}
