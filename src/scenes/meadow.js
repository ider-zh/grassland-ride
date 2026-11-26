import * as T from 'three';
import {createBlades,createSeedHeads} from './grass.js';

// Shared species geometry survives chunk eviction. Near clumps and seed heads
// give the verge depth; at distance the same species uses fewer ribbons.
let species;
function meadowSpecies(){
  if(species)return species;
  let seed=13218;
  const blades=createBlades(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
  const small=blades.clone();
  small.setDrawRange(0,9*15);
  return species={blades,small,seeds:createSeedHeads(),pebble:new T.IcosahedronGeometry(1,0),crown:new T.IcosahedronGeometry(1,1),solid:new T.MeshLambertMaterial({vertexColors:true,flatShading:true})};
}
const breezeMaterials=new WeakMap();
function breezeMaterial(time){
  if(breezeMaterials.has(time))return breezeMaterials.get(time);
  const leaf=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,emissive:0x202b13});
  leaf.onBeforeCompile=sh=>{
    sh.uniforms.uWind=time;
    sh.vertexShader=`uniform float uWind;
attribute float flex;
varying float meadowBend;
float meadowWind(vec2 field,float t){
  float travel=2.05*t+1.75*sin(t*.50)+.58*sin(t*1.12);
  float q=field.x*.17+field.y*.092-travel*.67+.82*sin(field.y*.081+t*.25);
  return .08+.92*smoothstep(-.27,.89,sin(q)+.28*sin(q*1.9+field.y*.10));
}
`+sh.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=instanceMatrix*vec4(transformed,1.);
vec3 root=(modelMatrix*vec4(instanceMatrix[3].xyz,1.)).xyz;
float gust=meadowWind(vec2(root.x,-root.z),uWind-flex*.37);
float size=length(instanceMatrix[1].xyz);
float phase=root.x*2.7+root.z*3.6;
float flutter=(.037+.085*gust)*sin(phase-uWind*5.3-flex*3.);
mvPosition.x+=flex*size*(.06+1.05*gust+flutter);
mvPosition.y-=flex*size*(.29*gust+.08*abs(flutter));
mvPosition.z+=flex*size*(-.24*gust+.07*sin(uWind*2.3-root.z*.23));
meadowBend=gust*min(1.,flex*3.3);
mvPosition=modelViewMatrix*mvPosition;
gl_Position=projectionMatrix*mvPosition;`);
    sh.fragmentShader='varying float meadowBend;\n'+sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb*=vec3(1.+.19*meadowBend,1.+.17*meadowBend,1.+.09*meadowBend);')
      .replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\n normal*=faceDirection;');
  };
  breezeMaterials.set(time,leaf);return leaf;
}
const colors=['#ead177','#f3e8c3','#ad9bb9'].map(c=>new T.Color(c));
const stoneColors=['#bfa279','#929683','#716d60'].map(c=>new T.Color(c));
const treeColors=['#4a6840','#667a45','#818c50','#574c3b'].map(c=>new T.Color(c));
const stalk=new T.Color('#718b48');

export function buildMeadow({group,start,end,at,random:r,windTime,own}){
  const m=meadowSpecies(),leaf=breezeMaterial(windTime),span=end-start;
  const counts=[870,490],grass=counts.map((n,i)=>new T.InstancedMesh(i?m.small:m.blades,leaf,n));
  const heads=new T.InstancedMesh(m.seeds,leaf,130);
  const stamp=new T.Object3D(),tint=new T.Color();let headCount=0;
  const spread=(s,side)=>.34*Math.sin(s*.19+side)+.22*Math.sin(s*.48-side);
  for(let band=0;band<2;band++)for(let i=0;i<counts[band];i++){
    const s=start+r()*span,side=r()<.5?-1:1,edge=spread(s,side);
    const d=band?7+Math.pow(r(),1.35)*26:2.42+edge+Math.pow(r(),1.92)*5.9;
    const u=at(s,side*Math.max(2.38,d)),field=.5+.25*Math.sin(u.x*.48+u.z*.18)+.25*Math.sin(u.x*.13-u.z*.54);
    const size=(.54+r()*.97)*(.58+.47*field)*(d<2.8?.65:1.);
    stamp.position.set(u.x,u.y-.035,u.z);
    stamp.rotation.y=r()*Math.PI*2;
    stamp.scale.set(size,size*(.80+.43*field),size);stamp.updateMatrix();
    grass[band].setMatrixAt(i,stamp.matrix);
    grass[band].setColorAt(i,tint.setRGB(.62+.44*field+r()*.105,.81+r()*.17,.66+.25*(1-field)+r()*.07));
    if(!band&&d>2.7&&i%4===0&&field>.53&&headCount<heads.count)heads.setMatrixAt(headCount++,stamp.matrix);
  }
  heads.count=headCount;
  for(const mesh of [...grass,heads]){
    mesh.computeBoundingSphere();
    // The vertex shader stretches silhouettes beyond the baked blade bounds.
    mesh.boundingSphere.radius+=1.2;
    group.add(mesh);
  }
  const verts=[],cols=[];
  function blob({x,y,z},rx,ry,rz,color,geo=m.pebble,angle=0,raise=0){
    const p=geo.attributes.position,cs=Math.cos(angle),sn=Math.sin(angle);
    for(let v=0;v<p.count;v++){
      const dx=p.getX(v)*rx,dz=p.getZ(v)*rz;
      verts.push(x+dx*cs-dz*sn,y+p.getY(v)*ry+raise,z+dx*sn+dz*cs);
      cols.push(color.r,color.g,color.b);
    }
  }
  for(let i=0;i<56;i++){
    const large=i>=42, s=start+r()*span,side=r()<.5?-1:1;
    const d=large?4+r()*26:1.95+r()*1.8, a=large?.15+r()*.53:.027+r()*.054;
    blob(at(s,side*d),a,a*.47,a*(.72+r()*.84),stoneColors[large?1+i%2:0],m.pebble,r()*6,a*.13);
  }
  for(let k=0;k<11;k++){
    const s0=start+1.4+r()*(span-2.8), off=(r()<.5?-1:1)*(3.1+r()*9.5);
    for(let j=0;j<12;j++){
      const p=at(s0+(r()-.5)*2.4,off+(r()-.5)*1.2), h=.15+r()*.23;
      blob(p,.011,h*.55,.011,stalk,m.pebble,0,h*.47);
      blob(p,.047,.023,.043,colors[k%3],m.pebble,r()*6,h);
    }
  }
  // Shelter belts break up the middle distance while keeping the alpine view
  // visible. Place them on the outer shoulder to avoid near-curve overlap.
  if(Math.floor(start/span)%3!==1){
    const side=Math.floor(start/span)%2?1:-1;
    const s=start+5+r()*(span-10), outer=side*(17+r()*12);
    for(let i=0;i<3;i++){
      const p=at(Math.min(end-.2,s+i*3.3),outer+side*i*2),
        h=2.8+r()*2.7;
      blob(p,h*.055,h*.46,h*.070,treeColors[3],m.pebble,.15,h*.37);
      for(let j=0;j<7;j++){
        const a=j*2.399+r()*.8,rad=(.06+r()*.19)*h;
        blob({x:p.x+h*.10+Math.cos(a)*rad,y:p.y,z:p.z+Math.sin(a)*rad},
          h*(.25+r()*.12),h*(.23+r()*.12),h*(.25+r()*.09),treeColors[j%3],m.crown,a,h*(.65+r()*.22));
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(cols,3));
  geometry.computeVertexNormals();
  own(geometry);
  const details=new T.Mesh(geometry,m.solid);details.receiveShadow=true;
  group.add(details);
}
