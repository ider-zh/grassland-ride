import * as T from 'three';

// Slate outcrops are assembled from low-sided bevelled slabs, with pale
// fractured top surfaces and darker strata. One instanced draw per material
// family, not one mesh per stone.
const color = x => new T.Color(x);
const slate = ['#797a70', '#7f8178', '#676c65', '#929087', '#858472'].map(color);
const grass = ['#838051', '#787347', '#969267', '#8a8862', '#626b4d'].map(color);
const timber = ['#78634a', '#695842', '#887254'].map(color);
const layers = [[-.5, .64], [-.34, 1], [.19, .94], [.49, .66]];
const ring = [[-.9,-.44],[-.44,-.91],[.46,-.93],[.96,-.37],[.83,.56],[.25,.96],[-.61,.76],[-1,.2]];
const rockMaterial = new T.MeshLambertMaterial({vertexColors:true});
const woodMaterial = new T.MeshLambertMaterial();
const woodGeometry = new T.BoxGeometry(1,1,1);
const stoneGeometry = makeStone();
const scrubGeometry = makeScrub();
let scrubMaterial;

function makeStone(){
  const points = layers.flatMap(([height,size],layer)=>ring.map(([x,z],i)=>[
    .51*x*size+.074*height, height + .075*Math.sin(i*1.6+layer*.21), .5*z*size+.057*height
  ]));
  const positions=[], colors=[];
  const add=(a,b,c,light)=>{
    for(const i of [a,b,c]){
      positions.push(...points[i]);
      const g=light*(.89+.11*Math.cos(i*1.15));
      colors.push(g*.99,g,g*.96);
    }
  };
  for(let l=0;l<layers.length-1;l++){
    const k=l*8;
    for(let i=0;i<8;i++){
      const j=(i+1)%8,a=k+i,b=k+j,c=a+8,d=b+8,light=[.43,.64,.89][l];
      add(a,c,b,light);add(b,c,d,light+.04);
    }
  }
  for(let i=1;i<7;i++){add(0,i,i+1,.48);add(24,25+i,24+i,.96);}
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();
  return g;
}

function makeScrub(){
  const pos=[],rgb=[];
  const tri=(a,b,c,shades)=>{
    for(const [point,shade] of [[a,shades[0]],[b,shades[1]],[c,shades[2]]]){
      pos.push(...point);rgb.push(shade*.97,shade,shade*.89);
    }
  };
  for(let i=0;i<8;i++){
    const a=i*2.40+Math.sin(i*3)*.27, ux=Math.cos(a), uz=Math.sin(a),
      h=.47+.29*(.5+.5*Math.sin(i*8.3)),f=.29+.22*(.5+.5*Math.cos(i*1.49)),
      w=.022+.007*(i%3),x=ux*.04,z=uz*.04,bx=-uz*w,bz=ux*w;
    const l=[x+bx,0,z+bz],r=[x-bx,0,z-bz],
      u=[x+ux*f*.3+bx*.63,h*.56,z+uz*f*.3+bz*.63],
      v=[x+ux*f*.3-bx*.63,h*.56,z+uz*f*.3-bz*.63],
      tip=[x+ux*f,h,z+uz*f];
    tri(l,r,u,[.44,.44,.75]);tri(r,v,u,[.44,.75,.75]);tri(u,v,tip,[.75,.75,1]);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
  g.computeVertexNormals();
  return g;
}

function getScrubMaterial(windTime){
  if(scrubMaterial?.clock===windTime)return scrubMaterial.material;
  const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,emissive:0x11130a});
  material.onBeforeCompile=shader=>{
    shader.uniforms.ridgeTime=windTime;
    shader.vertexShader='uniform float ridgeTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vec2 loc=instanceMatrix[3].xz;
      float gust=sin(ridgeTime*2.7-loc.x*.23-loc.y*.19);
      float ripple=sin(ridgeTime*5.1+loc.x*.51-loc.y*.63);
      transformed.x+=position.y*position.y*(.21+.15*gust+.055*ripple);
      transformed.z+=position.y*position.y*.11*gust;
    `);
  };
  scrubMaterial={clock:windTime,material};
  return material;
}

const sideOf = r => r()<.5 ? -1 : 1;
const pick = (r,palette) => palette[Math.floor(r()*palette.length)];
const yawAngle = r => r()*Math.PI*2;

export function buildRidge({group,start,end,index,at,random:r,windTime,own}){
  const rocks=[], scrub=[], rails=[];
  const stamp=new T.Object3D();
  const fade=s=>{
    const f=T.MathUtils.smoothstep(s,2944,2976)*(1-T.MathUtils.smoothstep(s,3808,3840));
    return f;
  };
  function mine(s,lateral,w,h,d,rotation,tint,raise=h*.29){
    const p=at(s,lateral);
    rocks.push([p.x,p.y+raise,p.z,w,h,d,rotation,tint,(r()-.5)*.19,(r()-.5)*.19]);
  }
  function post(s,lateral,height){
    const p=at(s,lateral);
    rails.push([p.x,p.y+height*.41,p.z,.12,height,.125,p.yaw,pick(r,timber),.045,-.025]);
    return new T.Vector3(p.x,p.y+height*.73,p.z);
  }
  function railBetween(a,b){
    const center=new T.Vector3().addVectors(a,b).multiplyScalar(.5);
    const delta=new T.Vector3().subVectors(b,a);
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),delta.clone().normalize());
    rails.push([center.x,center.y,center.z,delta.length()+.10,.079,.069,0,pick(r,timber),0,0,q]);
  }

  // Alternating shelves: keep the outer lookout open, tuck steep low stratum
  // silhouettes toward the inside. Secondary bars imply repeated bedding.
  for(let i=0;i<7;i++){
    const s=start+2+r()*(end-start-4), weight=fade(s);
    if(r()>weight*.79)continue;
    const side=index%3===1 ? -1 : 1;
    const lateral=side*(6+r()*14),p=at(s,lateral), rotation=p.yaw+.5+(r()-.5)*.8;
    const large=.74+r()*1.4;
    for(let l=0;l<4;l++){
      const h=large*(.43-l*.06)*(1+r()*.19);
      const w=large*(2.4-l*.34),d=large*(1.64-l*.24);
      mine(s+(r()-.5)*.62,lateral+side*l*.17,w,h,d,rotation,pick(r,slate),large*(.07+l*.23));
    }
    for(let k=0;k<3;k++){
      const scale=.18+r()*.53;
      mine(s+(r()-.5)*3.8,lateral+(r()-.5)*2.5,scale*.95,scale*.55,scale*1.2,yawAngle(r),pick(r,slate));
    }
  }
  // Scree and small plants taper in rather than turning on at a scene boundary.
  for(let i=0;i<140;i++){
    const s=start+.25+r()*(end-start-.5);
    if(r()>.31+.69*fade(s))continue;
    const side=sideOf(r), lateral=side*(2.9+(r()**1.75)*21);
    const a=.065+r()**2*.65;
    mine(s,lateral,a*1.25,a*.83,a,yawAngle(r),pick(r,slate));
  }
  for(let i=0;i<245;i++){
    const s=start+.25+r()*(end-start-.5);
    const side=sideOf(r),lateral=side*(2.8+r()**1.9*29);
    const p=at(s,lateral),v=.37+r()**2*.85;
    scrub.push([p.x,p.y-.016,p.z,v,v*(.61+.35*r()),v,yawAngle(r),pick(r,grass),0,0]);
  }
  // Two human-scale wayfinding details per stretch, without entering the road.
  const signSide=index%2===0 ? -1 : 1;
  if(index%2===0){
    const s=start+8.7+r()*4,off=signSide*(3.6+.4*r());
    let stack=.02;
    for(let i=0;i<5;i++){
      const w=.54-i*.09,h=.17-i*.014;
      mine(s+(r()-.5)*.1,off+(r()-.5)*.07,w,h,w*.93,yawAngle(r),pick(r,slate),stack+h*.43);
      stack+=h*.73;
    }
  }
  if(index%3===1){
    const s0=start+8,side=-signSide,off=side*3.55;
    const points=Array.from({length:5},(_,i)=>post(s0+i*1.8,off+side*(.14*Math.sin(i*.7)),.81+.05*(i%2)));
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];railBetween(a,b);
      railBetween(a.clone().add(new T.Vector3(0,-.27,0)),b.clone().add(new T.Vector3(0,-.27,0)));
    }
  }

  function batch(data,geometry,material,{cast=false,receive=true,name}){
    if(!data.length)return;
    const mesh=new T.InstancedMesh(geometry,material,data.length);
    mesh.name=name;mesh.castShadow=cast;mesh.receiveShadow=receive;
    for(let i=0;i<data.length;i++){
      const [x,y,z,w,h,d,angle,tint,rx,rz,q]=data[i];
      stamp.position.set(x,y,z);stamp.scale.set(w,h,d);
      if(q)stamp.quaternion.copy(q);else stamp.rotation.set(rx,angle,rz,'YXZ');
      stamp.updateMatrix();mesh.setMatrixAt(i,stamp.matrix);mesh.setColorAt(i,tint);
    }
    mesh.computeBoundingSphere();group.add(mesh);
    // InstancedMesh itself owns its per-instance GPU buffers, unlike shared
    // geometry/material. A swept chunk can dispose these without touching peers.
    own(mesh);
  }
  batch(rocks,stoneGeometry,rockMaterial,{cast:true,name:'Ridge slate'});
  batch(scrub,scrubGeometry,getScrubMaterial(windTime),{name:'Ridge alpine scrub'});
  batch(rails,woodGeometry,woodMaterial,{cast:true,name:'Ridge outlook fence'});
}
