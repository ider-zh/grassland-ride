import * as T from 'three';
import {random} from '../world/route.js';

const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function hash(x,z){const a=Math.sin(x*127.1+z*311.7)*43758.5453;return a-Math.floor(a);}
function noise(x,z){
  const i=Math.floor(x),j=Math.floor(z);let u=x-i,v=z-j;u*=u*(3-2*u);v*=v*(3-2*v);
  return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v;
}
function alpine(x,z){
  let peak=0;
  for(const [cx,cz,h,wx,wz] of [[-425,-12,131,150,83],[-230,12,138,115,75],[-150,-8,106,73,70],[-72,0,81,94,64],[35,8,119,115,77],[86,7,148,115,70],[127,-9,123,79,74],[242,9,103,112,68],[339,4,143,119,73],[460,-5,135,124,83]]){
    const dx=(x-cx)/wx,dz=(z-cz)/wz,a=Math.atan2(dz,dx);
    const spur=1+.13*Math.sin(5*a+1.7)+.09*Math.cos(7*a-.7)+.06*Math.sin(11*a);
    peak=Math.max(peak,h*Math.pow(Math.max(0,1-Math.hypot(dx,dz)*spur*.75),1.22));
  }
  const ridge=1-Math.abs(noise(x*.09,z*.078)*2-1);
  return 6+peak+(noise(x*.059,z*.06)-.5)*13+ridge*4+(noise(x*.24,z*.23)-.5)*3.5;
}
function mountain(scene){
  const p=[],c=[],idx=[];const step=2.45,nx=400,nz=81;
  const rock=new T.Color('#646d76'),snow=new T.Color('#f4f5e5'),base=new T.Color('#82929a'),color=new T.Color();
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=(i-nx*.5)*step,z=(j-36)*step,h=alpine(x,z),dx=(alpine(x+1,z)-alpine(x-1,z))*.5,dz=(alpine(x,z+1)-alpine(x,z-1))*.5;
    const slope=Math.hypot(dx,dz),patch=noise(x*.15,z*.18);
    const cover=clamp((h-43)*.044+(1.08-slope)*1.25+patch*.6-.36+dx*.32,0,1);
    color.copy(base).lerp(rock,clamp((h-15)/39,0,1)).lerp(snow,cover);
    color.multiplyScalar(.94+patch*.10);p.push(x,h-12,z-282);c.push(color.r,color.g,color.b);
    if(j<nz-1&&i<nx-1){const a=j*nx+i;idx.push(a,a+nx,a+1,a+1,a+nx,a+nx+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();
  const group=new T.Group();
  const alpineMat=new T.MeshLambertMaterial({vertexColors:true});
  alpineMat.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec3 crag;varying vec3 faceSlope;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncrag=position;faceSlope=normal;');
    sh.fragmentShader='varying vec3 crag;varying vec3 faceSlope;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float stratum=crag.y*1.23+crag.x*.37+sin(crag.z*.34)*1.8+sin(crag.x*.71+crag.z*.36)*.54;
float grain=sin(crag.x*3.1+crag.z*1.73)*sin(crag.y*2.32+crag.z);
float exposed=smoothstep(.32,.85,1.-faceSlope.y+.20*sin(crag.x*.29+crag.z*.11));
float cracks=smoothstep(.30,.95,sin(stratum))*smoothstep(-.7,.6,sin(crag.x*.6+crag.z*.11));
diffuseColor.rgb*=1.-exposed*(.17+.23*cracks+.08*grain);
float shelf=smoothstep(.75,.99,cos(stratum*.62))*smoothstep(.5,.76,faceSlope.y)*smoothstep(35.,58.,crag.y);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.84,.89,.89),shelf*.28);`);
  };
  const cliffs=new T.Mesh(g,alpineMat);cliffs.position.z=-51;cliffs.scale.y=.92;group.add(cliffs);
  for(let l=0;l<2;l++){
    const v=[],cols=[],indices=[];
    for(let j=0;j<=20;j++)for(let i=0;i<=240;i++){
      const x=(i-120)*4,z=j*3;const f=noise(x*.021+l*5,z*.021),e=noise(x*.079,z*.067);
      const h=(7+f*20+e*4)*(1-j/25)+Math.sin(x*.027+l)*5;
      const col=new T.Color(l?'#668369':'#85979a').multiplyScalar(.9+e*.16);
      v.push(x,j===20?-22:h-4,z-216+l*36);cols.push(col.r,col.g,col.b);
      if(i<240&&j<20){const a=j*241+i;indices.push(a,a+241,a+1,a+1,a+241,a+242);}
    }
    // Stepped spruce groves reveal the scale of the foothills below the snowline.
    const rng=random(945+l);
    for(let c=0;c<102;c++){
      const cx=(rng()-.5)*940,cz=4+rng()*45;
      for(let q=0;q<29;q++){
        const x=cx+(rng()+rng()-1)*17,z=clamp(cz+(rng()+rng()-1)*6,0,55);
        const j=z/3,e=noise(x*.079,z*.067),h=(7+noise(x*.021+l*5,z*.021)*20+e*4)*(1-j/25)+Math.sin(x*.027+l)*5-4;
        const hh=1.35+rng()*3.0,ww=hh*(.13+rng()*.09),n=v.length/3;
        const col=new T.Color(l?'#47695a':'#647e78').multiplyScalar(.85+rng()*.3);
        // Three tapering, offset whorls give each spruce a broken silhouette.
        for(let tier=0;tier<3;tier++){
          const w=ww*(1-tier*.19),bottom=hh*(.03+tier*.23),top=hh*(.64+tier*.18);
          const a=n+tier*4;
          for(const [dx,dy,dz] of [[-w,bottom+.10,0],[w*.09,top,0],[w,bottom,0],[w*.14,bottom-.03,w*.69]]){
            v.push(x+dx,h-.18+dy,z-216+l*36+dz);cols.push(col.r*(.94+tier*.035),col.g*(.94+tier*.035),col.b);
          }indices.push(a,a+3,a+1,a+3,a+2,a+1);
        }
      }
    }
    const b=new T.BufferGeometry();b.setAttribute('position',new T.Float32BufferAttribute(v,3));b.setAttribute('color',new T.Float32BufferAttribute(cols,3));b.setIndex(indices);b.computeVertexNormals();
    group.add(new T.Mesh(b,new T.MeshLambertMaterial({vertexColors:true})));
  }
  // Close the horizon for a rider who turns the camera away from the main range.
  const rim=[],faces=[],colors=[];
  for(let band=0;band<3;band++)for(let i=0;i<=256;i++){
    const a=i/256*Math.PI*2,x=Math.cos(a),z=Math.sin(a),radius=band===0?305:band===1?368:402;
    const y=band===0?-24:band===2?-15:13+noise(x*5.2+8,z*5.2)*28+noise(x*13,z*13)*8;
    const col=new T.Color(band===1?'#92aaa0':'#758e78');rim.push(radius*x,y,radius*z);colors.push(col.r,col.g,col.b);
    if(band<2&&i<256){const n=band*257+i;faces.push(n,n+257,n+1,n+1,n+257,n+258);}
  }
  const rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(rim,3));rg.setAttribute('color',new T.Float32BufferAttribute(colors,3));rg.setIndex(faces);rg.computeVertexNormals();
  group.add(new T.Mesh(rg,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide})));
  scene.add(group);return group;
}
const keys=[
  [0,'#192943','#60708a','#808496','#41506a','#52617e','#acc6de','#838fa9',.53,.32],
  [5,'#475874','#db9f91','#f1b397','#a28799','#d89270','#dfc5ad','#b4a5ab',1.28,.76],
  [7,'#549cb9','#f7dba8','#fff0c9','#a4abb6','#ffe1b0','#fff3dc','#b1c1bb',2.05,1.38],
  [11,'#398dc2','#d8e8e6','#fffbea','#b7cbd6','#fff2d6','#f5f5de','#c4d5d5',2.15,1.58],
  [15,'#478fbd','#efe4c9','#fff9df','#abc0ce','#ffe7b5','#fff1cf','#c5d1c9',2.1,1.5],
  [18,'#738ca9','#fac69e','#ffddac','#a195a6','#ffa977','#f6d9ba','#c0afb1',1.72,1.10],
  [19.6,'#414b75','#df929a','#f2b5a8','#8c7d9a','#ea9890','#d6b8c6','#a095af',1.15,.72],
  [22,'#1c2c48','#68788c','#8990a5','#475674','#6b7691','#bdc9df','#909bb3',.57,.35],
  [24,'#192943','#60708a','#808496','#41506a','#52617e','#acc6de','#838fa9',.53,.32]
].map(row=>[row[0],...row.slice(1,8).map(c=>new T.Color(c)),...row.slice(8)]);
export function createSky(scene){
  const hemi=new T.HemisphereLight(0xffffff,0xb4a992,1.3),sun=new T.DirectionalLight(0xfff0cc,2);scene.add(hemi,sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:55});sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-.0004;sun.shadow.normalBias=.017;
  scene.fog=new T.FogExp2(0xc3d2d0,.0026);
  const U={};for(const k of ['zenith','horizon','lit','shade'])U[k]={value:new T.Color()};
  U.sunDir={value:new T.Vector3()};U.clock={value:0};U.night={value:0};
  const sky=new T.Mesh(new T.SphereGeometry(650,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:U,
    vertexShader:`varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 dir; uniform vec3 zenith,horizon,lit,shade,sunDir; uniform float clock,night;
float hash(vec2 p){return fract(sin(dot(mod(p,4096.),vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return .53*noise(p)+.26*noise(p*2.12+4.2)+.13*noise(p*4.41-7.)+.065*noise(p*9.3)+.033*noise(p*19.);}
void main(){vec3 d=normalize(dir);float y=max(d.y,0.);vec3 col=mix(horizon,zenith,pow(smoothstep(-.055,.66,y),.56));
vec2 uv=d.xz/max(.075,y+.095)*1.86-vec2(clock*.016,clock*.003);
float f=fbm(uv)+.065*noise(uv*.38);float mask=smoothstep(.48,.614,f)*smoothstep(.005,.12,y);
float depth=smoothstep(.49,.70,f);float rim=clamp((f-fbm(uv+sunDir.xz*.23)) *3.+.34,0.,1.);
col=mix(col,mix(shade,lit,clamp(.97-depth*.77+rim*.38,0.,1.)),mask);
float spot=max(dot(d,sunDir),0.);col+=lit*(.25*pow(spot,37.)+.84*smoothstep(.99955,.99988,spot))*(1.-mask*.9);
float star=hash(floor(d.xz/max(y,.05)*740.));col+=vec3(.55)*smoothstep(.9985,1.,star)*night*y*(1.-mask);
gl_FragColor=vec4(col,1.);
#include <colorspace_fragment>
}`}));
  sky.renderOrder=-10;scene.add(sky);
  const peaks=mountain(scene);peaks.name="fixed-snowline";
  // Three overlapping faces of the same stationary mountain belt. No camera-
  // relative translation and no changes when the route crosses a biome boundary.
  for(const [yaw,scale,offset] of [[2.08,.82,-22],[-2.04,1.06,-17]]){
    const face=new T.Group();
    for(const part of peaks.children.slice(0,3))face.add(part.clone());
    face.rotation.y=yaw;face.scale.set(scale,scale,scale);face.position.y=offset;
    peaks.add(face);
  }
  const birds=new T.Group(), wings=[];
  const r=random(885);
  for(let i=0;i<7;i++){
    const bird=new T.Group(),pair=[];
    for(const side of [-1,1]){
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,side*.54,.12,.08,side*1.27,.035,.34,side*.65,.10,.29,0,0,.18],3));geo.setIndex([0,1,3,1,2,3,0,3,4]);
      const wing=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x454e50,side:T.DoubleSide}));bird.add(wing);pair.push(wing);
    }
    bird.userData={i,x:r()*21,y:r()*4,z:r()*13};wings.push(pair);birds.add(bird);
  }
  scene.add(birds);
  const storm=new T.Color('#71888e');
  return (hour,t,s,camera,subject,rain=0)=>{
    let j=0;while(j<keys.length-2&&hour>keys[j+1][0])j++;
    const a=keys[j],b=keys[j+1];let u=(hour-a[0])/(b[0]-a[0]);u=u*u*(3-2*u);
    [U.zenith.value,U.horizon.value,U.lit.value,U.shade.value,sun.color,hemi.color,scene.fog.color].forEach((c,i)=>c.copy(a[i+1]).lerp(b[i+1],u));
    sun.intensity=T.MathUtils.lerp(a[8],b[8],u);hemi.intensity=T.MathUtils.lerp(a[9],b[9],u);
    U.zenith.value.lerp(storm,.66*rain);U.horizon.value.lerp(storm,.48*rain);
    scene.fog.color.lerp(storm,.61*rain);scene.fog.density=.0026+.0037*rain;
    sun.intensity*=1-.72*rain;hemi.intensity*=1-.23*rain;
    const phase=(hour-6)*Math.PI/12;
    U.sunDir.value.set(-Math.cos(phase)*.91,Math.max(.19,Math.sin(phase)*.92),.38+Math.sin(phase)*.18).normalize();
    sun.target.position.copy(subject);sun.position.copy(subject).addScaledVector(U.sunDir.value,29);
    U.clock.value=t%100000;U.night.value=clamp((.9-hemi.intensity)*2,0,1);
    sky.position.copy(camera.position);
    const flight=(t+9)%53;birds.visible=flight<25;
    if(birds.visible)birds.children.forEach((bird,i)=>{
      const d=bird.userData;bird.position.set(camera.position.x+flight*6-79+d.x,23+d.y+Math.sin(t*.32+i)*.6,camera.position.z-75+d.z);
      bird.rotation.y=-1.15;const flap=.14+.42*Math.sin(t*5.4+i)*Math.max(0,Math.sin(t*.68+i));
      wings[i][0].rotation.z=-flap;wings[i][1].rotation.z=flap;
    });
    return sun.position;
  };
}
