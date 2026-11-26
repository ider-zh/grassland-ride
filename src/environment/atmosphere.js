import * as T from 'three';
import {random,windTravel,LENGTH,segmentAt,sections,terrainBlend,smooth} from '../world/route.js';

export function createTrailAir(scene){
  const roll=random(27641),capacity=115,particles=Array.from({length:capacity},()=>({life:0}));
  let next=0,verge=0,last=NaN,diagnostics={};
  const p=new T.BufferAttribute(new Float32Array(capacity*6*3),3).setUsage(T.DynamicDrawUsage);
  const c=new T.BufferAttribute(new Float32Array(capacity*6*3),3).setUsage(T.DynamicDrawUsage);
  const alpha=new T.BufferAttribute(new Float32Array(capacity*6),1).setUsage(T.DynamicDrawUsage);
  const g=new T.BufferGeometry();g.setAttribute('position',p);g.setAttribute('color',c);g.setAttribute('alpha',alpha);
  const leaves=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,transparent:true,depthWrite:false}));
  leaves.material.onBeforeCompile=sh=>{
    sh.vertexShader='attribute float alpha;varying float soft;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsoft=alpha;');
    sh.fragmentShader='varying float soft;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=soft;');
  };
  leaves.frustumCulled=false;scene.add(leaves);
  const field=['#838d57','#a1a663','#b5ab72','#87865a','#c0b174'].map(v=>new T.Color(v));
  const town=['#8e846d','#aaa08c','#988f7d'].map(v=>new T.Color(v));
  const down=[false,false],point=new T.Vector3(),dir=new T.Vector3(),zero=new T.Vector3();
  function emit(x,y,z,hoof,region,p){
    const b=particles[next++%capacity];b.x=x;b.y=y;b.z=z;b.life=b.max=hoof?.25+roll()*.25:1.7+roll()*1.5;
    const along=hoof?-.24-roll()*.95:.38+roll()*.90,cross=(roll()-.54)*(hoof?.74:1.65);
    b.vx=p.fx*along+p.rx*cross;b.vz=p.fz*along+p.rz*cross;
    b.vy=hoof?.8+roll()*.95:.04+roll()*.38;b.a=roll()*6.28;b.spin=(roll()-.5)*(hoof?13:5.9);
    b.length=(hoof?.035:.067)+roll()*(hoof?.046:.082);b.width=.006+roll()*(hoof?.009:.013);
    b.col=region===0?town[Math.floor(roll()*town.length)]:field[Math.floor(roll()*field.length)];b.hoof=hoof;
  }
  const update=(dt,t,s,speed,feet,frame,subject)=>{
    const reset=!Number.isFinite(last)||Math.abs(s-last)>3;last=s;
    if(reset){for(const b of particles)b.life=0;verge=0;}
    const region=sections[segmentAt(s)].scenery,[from,to,mix]=terrainBlend(s);
    const fill=[.09,1,.40,.34,.51],density=fill[from]*(1-mix)+fill[to]*mix;
    for(let i=0;i<2;i++){
      const f=feet[i+2];
      if(!reset&&down[i]&&!f.stance&&speed>3.65&&region!==0&&roll()<.33+.29*smooth(4,7.4,speed))
        emit(f.sole.x+(roll()-.5)*.05,f.sole.y+.05,f.sole.z,true,region,subject);
      down[i]=f.stance;
    }
    verge+=dt*(1.33+speed*.20)*density;
    while(verge>=1){
      verge--;
      // A broad wind field in front of the rider, not a burst around the hooves.
      const at=s+7.5+roll()*Math.min(22,10+speed*1.9),side=roll()<.52?-1:1;
      const pos=frame.at(at,side*(.75+roll()*5.9)),zone=sections[segmentAt(at)].scenery;
      if(zone===0&&roll()>.35)continue;
      const h=pos.y+.28+roll()*1.03,n=roll()<.41?2:1;
      for(let i=0;i<n;i++)emit(pos.x+(roll()-.5)*.34,h+roll()*.28,pos.z+(roll()-.5)*.48,false,zone,subject);
    }
    let v=0,front=0,aft=0,kicked=0;
    for(const b of particles){
      b.life-=dt;if(b.life<=0)continue;
      b.vy-=dt*(b.hoof?7.7:.30);b.x+=(b.vx+.12*Math.sin(2.1*t+b.a))*dt;
      b.y+=b.vy*dt;b.z+=b.vz*dt;b.a+=b.spin*dt;
      const ahead=(b.x-subject.x)*subject.fx+(b.z-subject.z)*subject.fz;
      if(ahead < -4.5||b.y<frame.ground(b.x,b.z)+.014){b.life=0;continue;}
      const fade=smooth(0,.22,b.life)*smooth(0,.15,b.max-b.life);
      const opacity=fade*(b.hoof?.32:.60)*(.12+.88*smooth(-3.4,3,ahead));
      if(opacity<.012)continue;
      if(ahead>=0)front++;else aft++;
      if(b.hoof)kicked++;
      const len=b.length,w=b.width,ax=Math.cos(b.a)*len,ay=Math.sin(b.a)*len*.77,az=len*.38;
      const write=(l,k,shade)=>{p.setXYZ(v,b.x+ax*l-w*k*Math.sin(b.a),b.y+ay*l+w*k*Math.cos(b.a),b.z+az*l+.008*k);
        c.setXYZ(v,b.col.r*shade,b.col.g*shade,b.col.b*shade);alpha.setX(v++,opacity);};
      write(-.5,0,.75);write(.08,1,1.15);write(.65,0,1);write(-.5,0,.75);write(.65,0,1);write(.08,-.6,.86);
    }
    g.setDrawRange(0,v);p.needsUpdate=c.needsUpdate=alpha.needsUpdate=true;
    diagnostics={front,aft,kicked,region,density};
  };
  update.rebase=matrix=>{
    zero.set(0,0,0).applyMatrix4(matrix);
    for(const b of particles)if(b.life>0){
      point.set(b.x,b.y,b.z).applyMatrix4(matrix);
      dir.set(b.vx,b.vy,b.vz).applyMatrix4(matrix).sub(zero);
      b.x=point.x;b.y=point.y;b.z=point.z;b.vx=dir.x;b.vy=dir.y;b.vz=dir.z;
    }
  };
  update.inspect=()=>({...diagnostics});
  return update;
}

// A tileable density map gives each passing bank pockets of clear air. Sample
// it in two oblique planes along the view ray, including when the eye is inside.
function cloudNoise(){
  const size=128,data=new Uint8Array(size*size),roll=random(13931);
  for(const [cells,weight] of [[4,.40],[8,.30],[16,.18],[32,.09],[64,.03]]){
    const grid=Float32Array.from({length:cells*cells},()=>roll());
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const fx=x*cells/size,fy=y*cells/size,ix=Math.floor(fx),iy=Math.floor(fy);
      let u=fx-ix,v=fy-iy;u*=u*(3-2*u);v*=v*(3-2*v);
      const at=(a,b)=>grid[((iy+b)%cells)*cells+(ix+a)%cells];
      data[y*size+x]+=Math.round(252*weight*((1-v)*((1-u)*at(0,0)+u*at(1,0))+v*((1-u)*at(0,1)+u*at(1,1))));
    }
  }
  const tex=new T.DataTexture(data,size,size,T.RedFormat);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.minFilter=tex.magFilter=T.LinearFilter;tex.needsUpdate=true;return tex;
}

// Scatter in a two-dimensional meadow coordinate system that moves with the
// wind. Empty cells stay empty and the trail is never consulted for placement.
function meadowMist(uniforms){
  const cells=72,cellSize=LENGTH/cells,reach=142;
  const mod=i=>(i%cells+cells)%cells;
  return (s,t,frame)=>{
    const shift=windTravel(t),alongShift=shift*.2;
    const index=Math.floor((s-alongShift)/cellSize);
    let n=0;
    for(let j=index-2;j<=index+2;j++)for(let a=-2;a<=2;a++){
      const r=random(Math.imul(a,73856093)^Math.imul(mod(j),19349663)^0x615cce);
      r();r();
      if(r()>.56)continue;
      const atS=(j+.16+.65*r())*cellSize+alongShift;
      const lateral=a*58+(r()-.5)*39+((shift%130+130)%130)-65;
      const range=Math.hypot(atS-s,lateral);
      if(range>=reach||n>=uniforms.banks.value.length)continue;
      const zone=sections[segmentAt(atS)].scenery;
      const size=2.1+r()*1.75,fade=(1-T.MathUtils.smoothstep(range,92,reach))*(zone===1?.86:zone===4?.21:.38);
      const p=frame.at(atS,lateral);
      uniforms.banks.value[n].set(p.x,p.y+size*.35,p.z);
      uniforms.radius.value[n].set(10+7*r(),size,7+5*r());
      uniforms.bankFade.value[n++]=fade;
    }
    uniforms.bankCount.value=n;
  };
}

// Reproject the depth of the passing verges into the previous camera. The course's
// world-space transform is fixed. Reject distant depth taps at silhouettes.
export function createShutter(renderer,scene,camera,horse){
  if(!renderer.capabilities.isWebGL2)return ()=>renderer.render(scene,camera);
  const target=new T.WebGLRenderTarget(1,1,{depthTexture:new T.DepthTexture(1,1),samples:2});
  target.texture.colorSpace=T.SRGBColorSpace;
  const size=new T.Vector2(),previous=new T.Matrix4(),current=new T.Matrix4();
  const u={color:{value:target.texture},depth:{value:target.depthTexture},inverseVP:{value:new T.Matrix4()},
    prior:{value:new T.Matrix4()},horseSpace:{value:new T.Matrix4()},pixel:{value:new T.Vector2()},shutter:{value:0}};
  Object.assign(u,{banks:{value:Array.from({length:16},()=>new T.Vector3())},radius:{value:Array.from({length:16},()=>new T.Vector3())},
    eye:{value:new T.Vector3()},mistColor:{value:new T.Color()},cloud:{value:cloudNoise()},weatherTime:{value:0},bankCount:{value:0},bankFade:{value:new Float32Array(16)}});
  const updateMist=meadowMist(u);
  const mat=new T.ShaderMaterial({uniforms:u,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 st;uniform sampler2D color,depth;uniform mat4 inverseVP,prior,horseSpace;uniform vec2 pixel;uniform float shutter;
uniform vec3 banks[16],radius[16],eye,mistColor;uniform int bankCount;uniform float bankFade[16];
uniform sampler2D cloud;uniform float weatherTime;
void main(){vec3 base=texture2D(color,st).rgb;float z=texture2D(depth,st).r;
vec4 world=inverseVP*vec4(st*2.-1.,z*2.-1.,1.);world/=world.w;
if(z<.9998&&shutter>.001){
 vec3 local=(horseSpace*world).xyz;
 float outside=max(max(abs(local.x)-.70,max(-local.z-1.7,local.z-2.40)),max(-local.y-.14,local.y-3.2));
 vec4 prev=prior*world;vec2 vel=(st-(prev.xy/prev.w*.5+.5))/pixel;
 vel*=shutter*smoothstep(0.,.45,outside);vel*=min(1.,4.4/max(length(vel),.01));
 if(dot(vel,vel)>.22){vec3 sum=base;float total=1.;
 for(int i=1;i<=4;i++){vec2 at=clamp(st-vel*pixel*float(i)*.25,vec2(0.),vec2(1.));
 float tap=texture2D(depth,at).r;float w=1.-smoothstep(.00035,.0019,abs(tap-z));sum+=texture2D(color,at).rgb*w;total+=w;}base=sum/total;}
}
vec3 segment=world.xyz-eye;float limit=length(segment);vec3 ray=segment/max(limit,.001);
float optical=0.,lightSum=0.,weightSum=0.;
for(int i=0;i<16;i++){
 if(i>=bankCount)break;
 vec3 o=(eye-banks[i])/radius[i],d=ray/radius[i];
 float a=dot(d,d),b=dot(o,d),disc=b*b-a*(dot(o,o)-1.);
 if(disc<=0.)continue;
 float root=sqrt(disc),enter=max(0.,(-b-root)/a),leave=min(limit,(-b+root)/a);
 if(leave<=enter)continue;
 float stepSize=(leave-enter)/8.,bankTau=0.,bankLight=0.;
 for(int j=0;j<8;j++){
   vec3 p=eye+ray*(enter+(float(j)+.5)*stepSize)-banks[i];
   vec3 ell=p/radius[i];
   vec2 uv=(p.xz+vec2(p.y*.64,-p.y*.88))*.038+vec2(-weatherTime*.005,weatherTime*.002);
   float n=texture2D(cloud,uv).r*.68+texture2D(cloud,uv*2.13+vec2(.37,p.y*.052)).r*.32;
   ell.y+=.14*sin(ell.x*5.+ell.z*3.1)+.13*cos(ell.z*6.-ell.x*2.);
   float shape=1.-dot(ell,ell)+(n-.52)*1.43;
   float tau=stepSize*.145*bankFade[i]*smoothstep(.06,.69,shape)*smoothstep(.22,.67,n);
   float scatter=exp(-bankTau)*(1.-exp(-tau));
   bankLight+=scatter*clamp(.82+.27*ell.y-.12*ell.x+.64*(n-.43),.63,1.26);
   bankTau+=tau;
 }
 optical+=bankTau;lightSum+=bankLight;weightSum+=1.-exp(-bankTau);
}
base=mix(base,mistColor*(lightSum/max(.0001,weightSum)),1.-exp(-optical));
gl_FragColor=vec4(base,1.);
#include <colorspace_fragment>
}`});
  const pass=new T.Scene(),flat=new T.OrthographicCamera(-1,1,1,-1,0,1);pass.add(new T.Mesh(new T.PlaneGeometry(2,2),mat));
  let lastS=NaN,lastT=NaN;
  const render=(s,t,speed,frame)=>{
    updateMist(s,t,frame);
    u.weatherTime.value=t;u.eye.value.copy(camera.position);u.mistColor.value.copy(scene.fog.color).multiplyScalar(1.07);
    renderer.getDrawingBufferSize(size);const resized=size.x!==target.width||size.y!==target.height;
    if(resized)target.setSize(size.x,size.y);
    renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);
    current.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);u.inverseVP.value.copy(current).invert();
    const dt=t-lastT,valid=!resized&&dt>0&&dt<.18&&Math.abs(s-lastS)<3;
    u.shutter.value=valid?Math.min(1,.017/dt)*T.MathUtils.smoothstep(speed,3,7):0;
    u.prior.value.copy(valid?previous:current);
    u.horseSpace.value.copy(horse.matrixWorld).invert();u.pixel.value.set(1/size.x,1/size.y);
    renderer.render(pass,flat);previous.copy(current);lastS=s;lastT=t;
  };
  render.resetHistory=()=>{lastT=NaN;};
  return render;
}
