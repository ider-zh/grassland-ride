import * as T from 'three';
import {terrainBlend,trailWidth,relief,surfacePoint,arcPoint,RADIUS,COUNT,CHUNK,TARN,tarnShape,smooth,roadLateral} from './route.js';
import {createFrame} from './frame.js';

const palette=[
  ['#837064','#68744d','#8a8071'],
  ['#9c784e','#657b3f','#9a9765'],
  ['#80766c','#656d68','#7d8588'],
  ['#897466','#627473','#7b8a8e'],
  ['#a18a64','#8c8957','#b19c72'],
].map(row=>row.map(s=>new T.Color(s)));
const tint=new T.Color(),biome=new T.Color(),rock=new T.Color(),snow=new T.Color('#e3eff0');
const material=new T.MeshLambertMaterial({vertexColors:true});

material.onBeforeCompile=sh=>{
  sh.vertexShader='attribute vec3 roadUV; attribute vec3 landUV; varying vec3 pathArt, earthArt;\n'+
    sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npathArt=roadUV;earthArt=landUV;');
  sh.fragmentShader=`
varying vec3 pathArt,earthArt;
float fieldHash(vec2 p){return fract(sin(dot(mod(p,4096.),vec2(127.1,311.7)))*43758.5453123);}
float fieldNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(fieldHash(i),fieldHash(i+vec2(1.,0.)),f.x),mix(fieldHash(i+vec2(0.,1.)),fieldHash(i+vec2(1.)),f.x),f.y);
}
`+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 p=vec2(pathArt.x,pathArt.y);
float grain=fieldNoise(p*4.6);
float clump=fieldNoise(p*.027)+.4*fieldNoise(p*.095);
float dust=(fieldNoise(p*1.9) - .5)*.18;
float fineK=smoothstep(.21,.50,1.-max(length(dFdx(p)),length(dFdy(p))));
float trail=earthArt.z;
float wheel=exp(-pow((abs(pathArt.y)-1.23)*4.8,2.));
float grit=(fieldHash(floor(p*33.))-.5)*.085*fineK;
diffuseColor.rgb*=.84+grain*.13+clump*.19+grit+dust-trail*wheel*.13;

float geologic=earthArt.x*.145 + p.x*.038 + p.y*.027 +
               fieldNoise(p*.029)*1.4 + fieldNoise(p*.112)*.31;
float seam=1.-smoothstep(.047,.145,abs(fract(geologic)-.5));
float rill=fieldNoise(vec2(p.x*.11+p.y*.05,p.y*.26-p.x*.08));
float stoneBand=smoothstep(.19,.77,earthArt.y)*(1.-trail);
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*(.76+.28*rill)+vec3(.012,.019,.024),stoneBand*.68);
diffuseColor.rgb*=1.-seam*stoneBand*(.16+.19*rill);
float grassPatch=smoothstep(.45,.88,clump)*(1.-trail)*(1.-stoneBand);
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.08,1.04,.77),grassPatch*.50);

vec2 pavers=vec2(pathArt.x*2.35,pathArt.y*3.3);
pavers.y+=mod(floor(pavers.x),2.)*.5;
vec2 cell=floor(pavers),f=fract(pavers);
float joint=smoothstep(.025,.085,min(min(f.x,1.-f.x),min(f.y,1.-f.y)));
float tint=fieldHash(cell);
vec3 granite=mix(vec3(.22,.19,.16),vec3(.37,.36,.32),.38+.51*tint);
granite*=.59+.41*joint;
granite*=(.89+.16*grain);
diffuseColor.rgb=mix(diffuseColor.rgb,granite,pathArt.z*.88);`);
};

const offsets=[-510,-465,-420,-380,-344,-311,-279,-249,-221,-195,-171,-149,-130,-112,-96,-82,-69,-57,-47,-39,-32,-25,-18,-13,-9,-6,-4.3,-3.15,-2.68,-2.4,-2,-1.3,-.85,-.46,0,.46,.85,1.3,2,2.4,2.68,3.15,4.3,6,9,13,18,25,32,39,47,57,69,82,96,112,130,149,171,195,221,249,279,311,344,380,420,465,510];
const n=new T.Vector3(),point1=new T.Vector3(),point2=new T.Vector3(),tangent=new T.Vector3(),cross=new T.Vector3(),sample=new T.Vector3();
const shellColor=new T.Color('#728556'),shaleBeach=new T.Color('#a09c84'),wetBank=new T.Color('#726c55');
function tile(index,frame,rows){
  const w=offsets.length,start=index*CHUNK,p=[],co=[],b=[],uv=[],earth=[],normals=[];
  // Exactly the same boundary curve, vertex locations, normals and art
  // coordinates at both resolutions, including across longitude zero.
  const point=(s,x,out)=>frame.project(surfacePoint(s,x,4*smooth(355,510,Math.abs(x))),out);
  for(let row=0;row<=rows;row++){
    const s=start+CHUNK*row/rows,[a,f,m]=terrainBlend(s),center=roadLateral(s),width=trailWidth(s);
    for(let j=0;j<w;j++){
      const side=offsets[j],d=Math.abs(side),trail=1-smooth(width-.22,width+1.05,d);
      point(s,side,sample);
      point(s-.42,side,point1);point(s+.42,side,point2);tangent.subVectors(point2,point1);
      point(s,side-.52,point1);point(s,side+.52,point2);cross.subVectors(point2,point1);
      n.crossVectors(cross,tangent).normalize();
      const slope=1-n.y,h=relief(s,center+side);
      const scatter=.5+.5*Math.sin(s*.134+side*.207)*Math.cos(s*.21-side*.14);
      const bed=smooth(.05,.43,slope)*smooth(18,75,h);
      tint.copy(palette[a][0]).lerp(palette[f][0],m);
      biome.copy(palette[a][1]).lerp(palette[f][1],m);
      rock.copy(palette[a][2]).lerp(palette[f][2],m);
      biome.lerp(rock,.12+.17*scatter+.57*bed);
      biome.lerp(snow,smooth(88,153,h-23*slope+scatter*17)*.93);
      if(a===4||f===4){
        const lake=tarnShape(s,center+side),shore=(1-smooth(.80,1.17,lake))*smooth(16,23,center+side);
        const rim=smooth(TARN.level-.8,TARN.level+1.7,h)*(1-smooth(TARN.level+2.0,TARN.level+5.9,h));
        biome.lerp(wetBank,shore*.31);
        biome.lerp(shaleBeach,rim*shore*(.57+.36*scatter));
      }
      biome.lerp(shellColor,smooth(360,510,d));
      biome.lerp(tint,trail);
      p.push(sample.x,sample.y+.008,sample.z);co.push(biome.r,biome.g,biome.b);normals.push(n.x,n.y,n.z);
      uv.push(s,side,trail*((a===0?1-m:0)+(f===0?m:0)));
      earth.push(h,bed,trail);
      if(row<rows&&j<w-1){const k=row*w+j;b.push(k,k+1,k+w,k+1,k+w+1,k+w);}
    }
  }
  const geo=new T.BufferGeometry();
  for (const [key,data] of Object.entries({position:p,color:co,normal:normals,roadUV:uv,landUV:earth}))
    geo.setAttribute(key,new T.Float32BufferAttribute(data,3));
  geo.setIndex(b);geo.computeBoundingSphere();
  const mesh=new T.Mesh(geo,material);mesh.receiveShadow=rows>4;
  return mesh;
}

export function buildTerrain(ctx){
  const soil=tile(ctx.index,ctx.frame,32);
  ctx.own(soil.geometry);ctx.group.add(soil);
}
export function addFarGround(planet){
  const tiles=[];
  for(let i=0;i<COUNT;i++){
    const frame=createFrame(i*CHUNK+CHUNK/2),m=tile(i,frame,4);
    m.matrixAutoUpdate=false;m.matrix.copy(frame.toPlanet);
    planet.add(m);tiles.push(m);
  }
  const sphere=new T.Mesh(new T.SphereGeometry(RADIUS-8,96,56),new T.MeshLambertMaterial({color:shellColor}));
  sphere.name='underlay';planet.add(sphere);
  return tiles;
}
export function addTarn(planet,clock){
  const p=[],idx=[],uv=[],rows=36,cols=24;
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
    const s=TARN.s+(i/rows-.5)*TARN.length*2.46,l=TARN.l+(j/cols-.5)*TARN.width*2.75;
    const v=arcPoint(s,l,TARN.level);
    p.push(v.x,v.y,v.z);uv.push(s/40,l/40);
    if(i<rows&&j<cols){const a=i*(cols+1)+j;idx.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
  const body=new T.ShaderMaterial({uniforms:{clock},fog:true,side:T.DoubleSide,
    vertexShader:`varying vec2 st;
    #include <fog_pars_vertex>
    void main(){st=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
    fragmentShader:`uniform float clock;varying vec2 st;
    #include <fog_pars_fragment>
    void main(){
      float s=st.x*40.,l=st.y*40.;
      float cS=${TARN.s.toFixed(1)},cL=${TARN.l.toFixed(1)};
      float boundary=length(vec2((s-cS+.19*(l-cL))/${TARN.length.toFixed(1)},
          (l-cL+4.*sin((s-cS)*.029))/${TARN.width.toFixed(1)}));
      if(boundary>1.048||l<19.)discard;
      float a=sin(st.x*41.0+sin(st.y*17.0+clock*.6)*1.65+clock*.84);
      float b=sin(st.y*66.0-st.x*12.0-clock*.95);
      float fleck=smoothstep(.76,.98,a*.66+b*.34);
      float clouds=.5+.5*cos(st.y*13.0+sin(st.x*9.0+clock*.09));
      vec3 water=mix(vec3(.044,.123,.119),vec3(.125,.245,.233),clouds*.57+.2);
      vec2 waved=vec2((s-cS)/12.,(l-cL)/12.);
      float flow=sin(waved.x*3.2+waved.y*1.2+clock*.8)+.6*sin(waved.x*2.5-waved.y*1.75+clock*.47);
      water*=.92+.12*flow;
      water+=vec3(.067,.104,.097)*fleck*.69;
      water=mix(water,vec3(.14,.237,.208),smoothstep(.57,1.02,boundary)*.46);
      gl_FragColor=vec4(water,1.);
      #include <fog_fragment>
      #include <colorspace_fragment>
    }`});
  // ShaderMaterial fog uniforms are populated by the renderer if declared.
  body.uniforms=T.UniformsUtils.merge([T.UniformsLib.fog,{clock}]);body.uniforms.clock=clock;
  const lake=new T.Mesh(g,body);lake.name='tarn';planet.add(lake);
}
