import * as T from 'three';

const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
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
  const storm=new T.Color('#71888e');
  const east=new T.Vector3(),back=new T.Vector3(),sunRay=new T.Vector3(),basis=new T.Matrix4();
  return (hour,t,s,camera,subject,rain=0,planetUp)=>{
    let j=0;while(j<keys.length-2&&hour>keys[j+1][0])j++;
    const a=keys[j],b=keys[j+1];let u=(hour-a[0])/(b[0]-a[0]);u=u*u*(3-2*u);
    [U.zenith.value,U.horizon.value,U.lit.value,U.shade.value,sun.color,hemi.color,scene.fog.color].forEach((c,i)=>c.copy(a[i+1]).lerp(b[i+1],u));
    sun.intensity=T.MathUtils.lerp(a[8],b[8],u);hemi.intensity=T.MathUtils.lerp(a[9],b[9],u);
    U.zenith.value.lerp(storm,.66*rain);U.horizon.value.lerp(storm,.48*rain);
    scene.fog.color.lerp(storm,.61*rain);scene.fog.density=.00165+.0044*rain;
    sun.intensity*=1-.72*rain;hemi.intensity*=1-.23*rain;
    const phase=(hour-6)*Math.PI/12;
    U.sunDir.value.set(-Math.cos(phase)*.91,Math.max(.19,Math.sin(phase)*.92),.38+Math.sin(phase)*.18).normalize();
    east.set(1,0,0).projectOnPlane(planetUp).normalize();back.crossVectors(east,planetUp).normalize();
    basis.makeBasis(east,planetUp,back);
    sky.quaternion.setFromRotationMatrix(basis);
    sunRay.copy(U.sunDir.value).transformDirection(basis);
    sun.target.position.copy(subject);sun.position.copy(subject).addScaledVector(sunRay,29);
    U.clock.value=t%100000;U.night.value=clamp((.9-hemi.intensity)*2,0,1);
    sky.position.copy(camera.position);
  };
}
