import * as T from 'three';
import {terrainBlend,trailWidth,globePoint,relief,LENGTH,RADIUS,smooth,roadLateral} from './route.js';

const palette=[
  ['#a48e70','#758044','#a89274'],
  ['#a78153','#799744','#9b9a58'],
  ['#a0917d','#7b8065','#acaca0'],
  ['#948675','#6f7c63','#a6aaa2'],
  ['#a48d71','#8b9568','#d0b58a'],
].map(row=>row.map(s=>new T.Color(s)));
const tint=new T.Color(),other=new T.Color(),stone=new T.Color(),snow=new T.Color("#eff7f3");
const material=new T.MeshLambertMaterial({vertexColors:true});
const groundMaterial=new T.MeshLambertMaterial({vertexColors:true});
material.onBeforeCompile=sh=>{
  sh.vertexShader='attribute vec3 roadUV; varying vec3 surfacePoint, paving;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsurfacePoint=position;paving=roadUV;');
  sh.fragmentShader='varying vec3 surfacePoint,paving;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 p=surfacePoint.xz;
float grit=fract(sin(dot(floor(p*43.0),vec2(127.1,311.7)))*43758.5453);
float pattern=sin(p.x*1.9+sin(p.y*2.7))*sin(p.y*.83+p.x*1.1);
diffuseColor.rgb*=.93+.10*grit+.10*pattern;
vec2 pavers=vec2(paving.x*2.35,paving.y*3.3);
pavers.y+=mod(floor(pavers.x),2.)*.5;
vec2 cell=floor(pavers),f=fract(pavers);
float joints=smoothstep(.018,.066,min(min(f.x,1.-f.x),min(f.y,1.-f.y)));
float tint=fract(sin(dot(cell,vec2(18.735,45.911)))*43758.5453);
vec3 granite=vec3(.34,.323,.288)*(.84+.28*tint)*(.63+.37*joints);
diffuseColor.rgb=mix(diffuseColor.rgb,granite,paving.z*.93);`);
};
function mesh(p,c,i,mat){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  if(c.length)g.setAttribute('color',new T.Float32BufferAttribute(c,3));
  g.setIndex(i);g.computeVertexNormals();
  const m=new T.Mesh(g,mat);m.receiveShadow=true;return m;
}
export function buildTerrain(ctx){
  const {at,ground}=ctx;
  const p=[],c=[],idx=[],uv=[],xs=[-335,-292,-250,-214,-180,-151,-124,-99,-78,-61,-49,-39,-32,-25,-18,-13,-9,-6,-4.3,-3.15,-2.68,-2.4,-2,-1.3,-.85,-.46,0,.46,.85,1.3,2,2.4,2.68,3.15,4.3,6,9,13,18,25,32,39,49,61,78,99,124,151,180,214,250,292,335];
  const rows=Math.ceil(ctx.end-ctx.start),w=xs.length;
  for(let row=0;row<=rows;row++){
    const s=ctx.start+(ctx.end-ctx.start)*row/rows,[a,b,m]=terrainBlend(s);
    for(let j=0;j<w;j++){
      const side=xs[j],v=at(s,side),d=Math.abs(side),road=trailWidth(s);
      const mix=T.MathUtils.smoothstep(d,road-.25,road+.82);
      tint.copy(palette[a][0]).lerp(palette[b][0],m);
      other.copy(palette[a][1]).lerp(palette[b][1],m);
      stone.copy(palette[a][2]).lerp(palette[b][2],m);
      const noise=.5+.5*Math.sin(v.x*.65+v.z*.24)*Math.cos(v.z*.79-v.x*.21);
      const rut=Math.exp(-Math.pow((d-1.22)*5,2));
      tint.multiplyScalar(.92+.13*noise-.14*rut);
      const alt=relief(s,roadLateral(s)+side);
      other.lerp(stone,.12+noise*.23+smooth(52,95,alt)*.54);
      other.lerp(snow,smooth(87,143,alt+noise*11)*.94);
      tint.lerp(other,mix);
      p.push(v.x,v.y+.008,v.z);c.push(tint.r,tint.g,tint.b);
      uv.push(s,side,(1-mix)*((a===0?1-m:0)+(b===0?m:0)));

      if(row<rows&&j<w-1){const k=row*w+j;idx.push(k,k+1,k+w,k+1,k+w+1,k+w);}
    }
  }
  const soil=mesh(p,c,idx,material);
  soil.geometry.setAttribute("roadUV",new T.Float32BufferAttribute(uv,3));
  // Analytic vertex normals agree at every tile boundary, not just the heights.
  const normals=soil.geometry.attributes.normal;
  for(let i=0;i<normals.count;i++){
    const x=p[i*3],z=p[i*3+2];
    const dx=(ground(x+.35,z)-ground(x-.35,z))/.7,dz=(ground(x,z+.35)-ground(x,z-.35))/.7;
    const n=Math.hypot(dx,1,dz);normals.setXYZ(i,-dx/n,1/n,-dz/n);
  }
  ctx.own(soil.geometry);ctx.group.add(soil);
}
export function addFarGround(planet){
  // Permanent, inexpensive terrain mesh. Its mountains share the exact height
  // field used by road/collision, and nearby streamed detail overlays it.
  const sectors=12,nAlong=72,nAcross=58;
  for(let sec=0;sec<sectors;sec++){
    const p=[],col=[],idx=[];
    for(let i=0;i<=nAlong;i++){
      const s=LENGTH*(sec+i/nAlong)/sectors,[a,b,m]=terrainBlend(s),mid=roadLateral(s);
      for(let j=0;j<=nAcross;j++){
        const l=-510+j*1020/nAcross,h=relief(s,l);
        const fine=(.5+.5*Math.sin(s*.024+l*.058)*Math.sin(l*.09-s*.073));
        const edge=smooth(340,505,Math.abs(l));
        const offset=1.4+3.7*edge+smooth(18,35,Math.abs(l-mid))*1.8;
        const v=globePoint(s,l,offset);
        tint.copy(palette[a][1]).lerp(palette[b][1],m);
        stone.copy(palette[a][2]).lerp(palette[b][2],m);
        tint.lerp(stone,.12+fine*.13+smooth(47,105,h)*.56);
        tint.lerp(snow,smooth(87,143,h+fine*11)*.94);
        tint.lerp(shellColor,edge);
        p.push(v.x,v.y,v.z);col.push(tint.r,tint.g,tint.b);
        if(i<nAlong&&j<nAcross){const k=i*(nAcross+1)+j;idx.push(k,k+1,k+nAcross+1,k+1,k+nAcross+2,k+nAcross+1);}
      }
    }
    const far=mesh(p,col,idx,groundMaterial);far.receiveShadow=false;planet.add(far);
  }
  const sphere=new T.Mesh(new T.SphereGeometry(RADIUS-7,96,56),new T.MeshLambertMaterial({color:shellColor}));
  planet.add(sphere);
}
const shellColor=new T.Color('#728556');
