import * as T from 'three';
import {at,blendAt,ground,trailWidth} from './route.js';

const palette=[
  ['#a48e70','#758044','#a89274'],
  ['#a78153','#799744','#9b9a58'],
  ['#a0917d','#7b8065','#acaca0'],
].map(row=>row.map(s=>new T.Color(s)));
const tint=new T.Color(),other=new T.Color(),stone=new T.Color();
const material=new T.MeshLambertMaterial({vertexColors:true});
const groundMaterial=new T.MeshLambertMaterial({color:'#75864f'});
material.onBeforeCompile=sh=>{
  sh.vertexShader='varying vec3 surfacePoint;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsurfacePoint=position;');
  sh.fragmentShader='varying vec3 surfacePoint;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 p=surfacePoint.xz;
float grit=fract(sin(dot(floor(p*43.0),vec2(127.1,311.7)))*43758.5453);
float pattern=sin(p.x*1.9+sin(p.y*2.7))*sin(p.y*.83+p.x*1.1);
diffuseColor.rgb*=.90+.13*grit+.12*pattern;`);
};
function mesh(p,c,i,mat){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  if(c.length)g.setAttribute('color',new T.Float32BufferAttribute(c,3));
  g.setIndex(i);g.computeVertexNormals();
  const m=new T.Mesh(g,mat);m.receiveShadow=true;return m;
}
export function buildTerrain(ctx){
  const p=[],c=[],idx=[],xs=[-39,-32,-25,-18,-13,-9,-6,-4.3,-3.15,-2.68,-2.4,-2,-1.3,-.85,-.46,0,.46,.85,1.3,2,2.4,2.68,3.15,4.3,6,9,13,18,25,32,39];
  const rows=Math.ceil(ctx.end-ctx.start),w=xs.length;
  for(let row=0;row<=rows;row++){
    const s=ctx.start+(ctx.end-ctx.start)*row/rows,[a,b,m]=blendAt(s);
    for(let j=0;j<w;j++){
      const side=xs[j],v=at(s,side),d=Math.abs(side),road=trailWidth(s);
      const mix=T.MathUtils.smoothstep(d,road-.25,road+.82);
      tint.copy(palette[a][0]).lerp(palette[b][0],m);
      other.copy(palette[a][1]).lerp(palette[b][1],m);
      stone.copy(palette[a][2]).lerp(palette[b][2],m);
      const noise=.5+.5*Math.sin(v.x*.65+v.z*.24)*Math.cos(v.z*.79-v.x*.21);
      const rut=Math.exp(-Math.pow((d-1.22)*5,2));
      tint.multiplyScalar(.92+.13*noise-.14*rut);
      other.lerp(stone,.12+noise*.23);
      tint.lerp(other,mix);
      p.push(v.x,v.y+.008,v.z);c.push(tint.r,tint.g,tint.b);
      if(row<rows&&j<w-1){const k=row*w+j;idx.push(k,k+1,k+w,k+1,k+w+1,k+w);}
    }
  }
  const soil=mesh(p,c,idx,material);
  // Analytic vertex normals agree at every tile boundary, not just the heights.
  const normals=soil.geometry.attributes.normal;
  for(let i=0;i<normals.count;i++){
    const x=p[i*3],z=p[i*3+2];
    const dx=(ground(x+.35,z)-ground(x-.35,z))/.7,dz=(ground(x,z+.35)-ground(x,z-.35))/.7;
    const n=Math.hypot(dx,1,dz);normals.setXYZ(i,-dx/n,1/n,-dz/n);
  }
  ctx.own(soil.geometry);ctx.group.add(soil);
}
export function addFarGround(scene){
  const p=[],idx=[],n=81,step=8;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const x=(i-(n-1)/2)*step,z=(j-(n-1)/2)*step;
    p.push(x,ground(x,z)-.8,z);
    if(i<n-1&&j<n-1){const a=j*n+i;idx.push(a,a+n,a+1,a+1,a+n,a+n+1);}
  }
  scene.add(mesh(p,[],idx,groundMaterial));
}
