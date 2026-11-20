import * as T from 'three';
import {createBlades,createSeedHeads} from './grass.js';

export const road = s => 12*Math.sin(s*.014)+6*Math.sin(s*.034+.36)+9*Math.sin(s*.007-.72);
export function ground(x,s){
  const d = Math.abs(x-road(s));
  const bank = Math.min(1,d/42);
  return 2.8*Math.sin(s*.036-.6)+2.3*Math.cos(s*.019+1.4)+.8*Math.sin(x*.058+s*.028)
    +bank*bank*(3.4+4.5*Math.sin(x*.045+s*.018)+2.8*Math.cos(s*.055-x*.046));
}
export function random(seed){
  return () => {seed=(Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296;};
}
function geometry(p,c,idx){
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  if(c.length)g.setAttribute('color',new T.Float32BufferAttribute(c,3));
  if(idx)g.setIndex(idx); g.computeVertexNormals(); return g;
}
const noise = `
float hash(vec2 p){return fract(sin(dot(mod(p,4096.),vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}`;
// Integrated crosswind displacement. Its derivative stays positive even in
// a lull, so mist drifts downwind while the blades rise and fall in waves.
export function windTravel(t){
  return 2.05*t+1.75*Math.sin(t*.50)+.58*Math.sin(t*1.12);
}
// Broad fronts cross the trail obliquely, separated by sheltered intervals.
export function meadowWind(x,s,t){
  const phase=x*.17+s*.092-windTravel(t)*.67+.82*Math.sin(s*.081+t*.25);
  const front=T.MathUtils.smoothstep(Math.sin(phase)+.28*Math.sin(phase*1.9+s*.10),-.27,.89);
  return .08+front*(.93+.20*Math.sin(x*.46-s*.28-t*3.4));
}
const windShader=`
float windAt(vec2 field,float t){
  float travel=2.05*t+1.75*sin(t*.50)+.58*sin(t*1.12);
  float phase=field.x*.17+field.y*.092-travel*.67+.82*sin(field.y*.081+t*.25);
  float front=smoothstep(-.27,.89,sin(phase)+.28*sin(phase*1.9+field.y*.10));
  return .08+front*(.93+.20*sin(field.x*.46-field.y*.28-t*3.4));
}`;
// Both the turf shader and the tuft scatter follow this wandering verge.
function shoulderWidth(s,side){
  const phase=side<0?1.8:4.7;
  return 2.13+.49*Math.sin(s*.19+phase)+.33*Math.sin(s*.51-phase*1.9)+.19*Math.sin(s*1.03+phase);
}
const tile=36;
export function createLand(scene){
  const time={value:0};
  const soil=new T.MeshLambertMaterial({color:0xffffff});
  soil.onBeforeCompile=sh=>{
    sh.uniforms.windTime=time;
    sh.vertexShader='attribute float track; attribute float along; attribute float verge; varying vec2 field; varying float lane; varying float shoulder;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n field=vec2(position.x,along);lane=track;shoulder=verge;');
    sh.fragmentShader='uniform float windTime;varying vec2 field;varying float lane;varying float shoulder;\n'+noise+windShader+'\n'+sh.fragmentShader.replace('#include <color_fragment>',`
float n=noise2(field*.125)*.56+noise2(field*.46)*.31+noise2(field*2.)*.13;
float swath=noise2(vec2(field.x*.038+field.y*.026,field.y*.14));
float grit=noise2(field*10.);
float islands=noise2(field*vec2(2.4,1.65))*.63+noise2(field*5.3)*.37;
float edge=shoulder+1.05*(islands-.5)+.40*(grit-.5);
float turf=smoothstep(-.81,.70,edge);
float flecks=smoothstep(.42,.63,islands+.15*(grit-.5));
vec3 grass=mix(vec3(.070,.177,.061),vec3(.32,.44,.13),smoothstep(.16,.86,n*.72+swath*.28));
grass*=1.+.17*windAt(field,windTime);
float rut=exp(-pow((abs(lane)-1.03)*4.6,2.));
vec3 earth=mix(vec3(.29,.174,.091),vec3(.56,.394,.213),n+.15*(grit-.5))*(1.-rut*.14);
earth+=vec3(.04,.067,.008)*max(0.,1.-abs(lane)*1.4)*smoothstep(.48,.72,n);
float sunPatch=smoothstep(.25,.72,noise2(field*.052-vec2(windTime*.023,windTime*.006)));
vec3 stubble=mix(earth,grass,.34+.32*flecks);
vec3 surface=mix(mix(earth,stubble,smoothstep(-1.13,-.24,edge)),grass,turf);
diffuseColor.rgb*=surface*mix(vec3(.83,.89,.95),vec3(1.05,1.045,.99),sunPatch);`);
  };
  const grassStart={value:0};
  const leaf=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,emissive:0x303b15});
  leaf.onBeforeCompile=sh=>{
    sh.uniforms.uWind=time;sh.uniforms.patchStart=grassStart;
    sh.vertexShader='uniform float uWind;uniform float patchStart;attribute float flex;varying float bent;\n'+windShader+'\n'+sh.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.);
mvPosition=instanceMatrix*mvPosition;
float along=patchStart-(modelMatrix*mvPosition).z;
float gust=windAt(vec2(mvPosition.x,along),uWind-flex*.37);
float size=length(instanceMatrix[1].xyz);
float phase=instanceMatrix[3].x*2.7-instanceMatrix[3].z*3.6;
float flutter=(.037+.085*gust)*sin(phase-uWind*5.3-flex*3.);
float rebound=.09*sin(phase*.37-uWind*2.9-flex*4.1)*(1.-min(gust,1.));
mvPosition.x+=flex*size*(.06+1.05*gust+flutter+rebound);mvPosition.y-=flex*size*(.31*gust+.08*abs(flutter));
mvPosition.z+=flex*size*(-.24*gust+.07*sin(uWind*2.3+along*.23));
bent=gust*min(1.,flex*3.3);
mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`);
    sh.fragmentShader='varying float bent;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=vec3(1.+.19*bent,1.+.17*bent,1.+.09*bent);').replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal*=faceDirection;');
  };
  const tuftGeometry=createBlades(random(13218)),seedGeometry=createSeedHeads();
  const distantTuft=tuftGeometry.clone();
  distantTuft.setDrawRange(0,Math.round(tuftGeometry.index.count*12/21));
  const sharedGrass=new Set([tuftGeometry,distantTuft,seedGeometry]);
  const rockMat=new T.MeshLambertMaterial({vertexColors:true,flatShading:true});
  const unit=new T.IcosahedronGeometry(1,0), crown=new T.IcosahedronGeometry(1,1);
  const chunks=new Map();
  function build(k){
    const group=new T.Group(),start=k*tile,r=random(k*3877+83511);
    const p=[],idx=[],along=[],track=[],verge=[];
    const xs=[-480,-260,-150,-96,-64,-44,-31];
    for(let j=-27;j<=27;j+=1.5)xs.push(j);
    xs.push(31,44,64,96,150,260,480);
    for(let i=0;i<=18;i++)for(const dx of xs){
      const s=start+i*2,x=road(s)+dx;
      p.push(x,ground(x,s),-i*2);along.push(s%32768);track.push(dx);verge.push(Math.abs(dx)-shoulderWidth(s,Math.sign(dx)));
    }
    for(let j=0;j<18;j++)for(let i=0;i<xs.length-1;i++){
      const a=j*xs.length+i,b=a+xs.length;idx.push(a,a+1,b,a+1,b+1,b);
    }
    const g=geometry(p,[],idx);
    g.setAttribute('track',new T.Float32BufferAttribute(track,1));g.setAttribute('along',new T.Float32BufferAttribute(along,1));
    g.setAttribute('verge',new T.Float32BufferAttribute(verge,1));
    const earthMesh=new T.Mesh(g,soil);earthMesh.receiveShadow=true;group.add(earthMesh);
    const count=5350,tuft=new T.InstancedMesh(tuftGeometry,leaf,count);
    const stamp=new T.Object3D(),tint=new T.Color();
    const seedHeads=new T.InstancedMesh(seedGeometry,leaf,Math.ceil(count/7));
    let spikes=0;
    const extraGrass=random(k*2141+7979);
    for(let i=0;i<count;i++){
      const sample=i<3500?r:extraGrass;
      const s=start+sample()*tile,side=sample()<.5?-1:1,spread=sample();
      const rim=shoulderWidth(s,side);
      const fringe=i>=4150&&i%3!==0;
      const inner=Math.max(1.21-rim,-1.15);
      const offset=fringe?inner+spread*(1.55-inner):Math.pow(spread,i<4150?1.68:1.23)*(i<4150?33:17);
      const dx=side*(rim+offset),x=road(s)+dx;
      stamp.position.set(x,ground(x,s)-.025,start-s);
      const height=T.MathUtils.smoothstep(offset,-1.15,1.18);
      const size=(.56+sample()*.83)*(.14+.86*height);
      const patch=.5+.26*Math.sin(x*.46+s*.19)+.24*Math.sin(s*.53-x*.12);
      stamp.scale.set(size+.17*(1-height),size*(.77+.46*patch),size+.17*(1-height));stamp.rotation.y=sample()*6.28;stamp.updateMatrix();tuft.setMatrixAt(i,stamp.matrix);
      tint.setRGB(.66+.32*patch+sample()*.17,.82+sample()*.14,.71+.15*(1-patch)+sample()*.13);
      tuft.setColorAt(i,tint);
      if(i%7===0 && patch>.58 && offset>.24){
        seedHeads.setMatrixAt(spikes++,stamp.matrix);
      }
    }
    tuft.userData.fullCount=count;
    seedHeads.count=spikes;seedHeads.userData.fullCount=spikes;
    group.add(tuft,seedHeads);group.userData.tuft=tuft;group.userData.seedHeads=seedHeads;
    const dp=[],dc=[];
    function blob(x,y,z,rx,ry,rz,color,geo=unit,angle=0){
      const pts=geo.attributes.position,co=new T.Color(color),cs=Math.cos(angle),sn=Math.sin(angle);
      for(let v=0;v<pts.count;v++){
        const xx=pts.getX(v)*rx,zz=pts.getZ(v)*rz;
        dp.push(x+xx*cs-zz*sn,y+pts.getY(v)*ry,z+xx*sn+zz*cs);
        dc.push(co.r,co.g,co.b);
      }
    }
    for(let i=0;i<96;i++){
      const s=start+r()*tile,dx=i<70?(r()-.5)*6:(r()<.5?-1:1)*(3.1+r()*29),x=road(s)+dx,a=i<70?.015+r()*.065:.18+r()*.66;
      blob(x,ground(x,s)+a*.07,start-s,a,a*.50,a*(.65+r()),i<70?'#bfa279':'#929683',unit,r()*6);
    }
    // Islands of buttercups, pale yarrow and violet gentians.
    for(let q=0;q<18;q++){
      const mid=start+r()*tile,base=road(mid)+(r()<.5?-1:1)*(2.7+r()*18),color=['#ead177','#f0e7bf','#ad9bb9'][q%3];
      for(let j=0;j<19;j++){
        const s=mid+(r()-.5)*2.7,x=base+(r()-.5)*2.7;if(Math.abs(x-road(s))<2.35)continue;
        const y=ground(x,s),h=.16+r()*.18;blob(x,y+h*.5,start-s,.011,h*.52,.012,'#748647');
        blob(x,y+h,start-s,.040,.026,.036,color);
      }
    }
    // Wind-shaped trees appear in irregular shelter belts outside the trail.
    for(let j=0;j<2;j++){
      if(r()<.34)continue;
      const s=start+r()*tile,x=road(s)+(r()<.5?-1:1)*(13+r()*57),z=start-s,y=ground(x,s),h=2.5+r()*3.8;
      blob(x,y+h*.35,z,h*.060,h*.43,h*.063,'#65563f');
      for(let c=0;c<9;c++){
        const a=r()*6.28,rad=r()*h*.36;
        blob(x+Math.cos(a)*rad+h*.09,y+h*(.65+r()*.30),z+Math.sin(a)*rad,h*(.29+r()*.18),h*(.19+r()*.18),h*.32,['#527343','#697e43','#819247'][c%3],crown,a);
      }
    }
    group.add(new T.Mesh(geometry(dp,dc),rockMat));scene.add(group);return group;
  }
  return (s,t,density)=>{
    const center=Math.floor(s/tile);time.value=t;grassStart.value=s%32768;
    for(const [k,g] of chunks)if(k<center-3||k>center+6){scene.remove(g);g.traverse(o=>{if(o.geometry && !sharedGrass.has(o.geometry))o.geometry.dispose();if(o.isInstancedMesh)o.dispose();});chunks.delete(k);}
    for(let k=center-3;k<=center+6;k++){
      if(!chunks.has(k))chunks.set(k,build(k));
      const g=chunks.get(k);g.position.z=s-k*tile;
      const grass=g.userData.tuft,d=Math.abs(g.position.z-tile*.5);
      grass.geometry=d>48?distantTuft:tuftGeometry;
      const spikes=g.userData.seedHeads;
      spikes.count=Math.floor(spikes.userData.fullCount*density*T.MathUtils.clamp((46-d)/18,0,1));
      spikes.visible=spikes.count>0;
      grass.visible=d<103;grass.count=Math.round(grass.userData.fullCount*density*Math.max(.08,Math.min(1,(86-d)/51)));
    }
  };
}
