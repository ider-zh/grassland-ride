import * as T from 'three';
import {createBlades,createSeedHeads} from './grass.js';
import {RADIUS,trailWidth,smooth,random} from '../world/route.js';

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
attribute float flex, meadowAnchor;
varying float meadowBend;
float meadowWind(vec2 field,float t){
  float travel=2.05*t+1.75*sin(t*.50)+.58*sin(t*1.12);
  float q=field.x*.17+field.y*.092-travel*.67+.82*sin(field.y*.081+t*.25);
  return .08+.92*smoothstep(-.27,.89,sin(q)+.28*sin(q*1.9+field.y*.10));
}
`+sh.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=instanceMatrix*vec4(transformed,1.);
vec3 root=instanceMatrix[3].xyz;
float a=meadowAnchor-root.z/${RADIUS.toFixed(7)};
vec2 field=vec2(root.x+sin(a)*62., sin(a)*121.+cos(a)*38.);
float gust=meadowWind(field,uWind-flex*.37);
float size=length(instanceMatrix[1].xyz);
float phase=field.x*2.7-field.y*3.6;
float flutter=(.037+.085*gust)*sin(phase-uWind*5.3-flex*3.);
mvPosition.x+=flex*size*(.06+1.05*gust+flutter);
mvPosition.y-=flex*size*(.29*gust+.08*abs(flutter));
mvPosition.z+=flex*size*(-.24*gust+.07*sin(uWind*2.3+field.y*.23));
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
const treeColors=['#4a6840','#667a45','#818c50','#574c3b','#768e70','#a0ac82','#c0bc87'].map(c=>new T.Color(c));
const stalk=new T.Color('#718b48');

// These envelopes span multiple chunks and follow natural terrain pockets rather
// than a tile index. A given field edge is continuous on rebuild and at seams.
const moments=[
  {s:2075,span:93,side:1,ribbon:10,type:'silver',hue:[.74,1.02,.99]},
  {s:2230,span:74,side:-1,ribbon:12,type:'gentian',hue:[.84,.88,1.14]},
  {s:5240,span:145,side:-1,ribbon:9,type:'gold',hue:[1.38,1.05,.52]},
  {s:5291,span:52,side:1,ribbon:6,type:'gold',hue:[1.38,1.05,.52]},
  {s:5514,span:106,side:1,ribbon:13,type:'silver',hue:[.74,1.05,1.10]},
  {s:6060,span:95,side:-1,ribbon:9,type:'gentian',hue:[.87,.91,1.09]},
];
const gaussian=(x,w)=>Math.exp(-((x/w)**2));
function fieldAt(s,side,d){
  const shape=.5+.28*Math.sin(s*.091+side*1.7+d*.48)+.22*Math.sin(s*.224-d*.54);
  let strongest=null, influence=0;
  for(const m of moments){
    if(m.side!==side||Math.abs(s-m.s)>m.span*2.8)continue;
    const edge=m.ribbon+3.8*Math.sin((s-m.s)*.040)+1.4*Math.sin((s-m.s)*.12);
    const envelope=gaussian(s-m.s,m.span)*gaussian(d-edge,6.5);
    if(envelope>influence){strongest=m;influence=envelope;}
  }
  return {shape,strongest,influence};
}
export function buildMeadow({group,start,end,at,random:r,windTime,own}){
  const m=meadowSpecies(),leaf=breezeMaterial(windTime),span=end-start;
  function anchored(geometry){
    const copy=geometry.clone();
    // Per-tile vertex attribute rather than a shared material uniform: the
    // world rotates to rebase the camera without changing field coordinates.
    const anchors=new Float32Array(copy.attributes.position.count).fill((start+span*.5)/RADIUS);
    copy.setAttribute('meadowAnchor',new T.BufferAttribute(anchors,1));
    own(copy);return copy;
  }
  const counts=[800,560],grass=counts.map((n,i)=>new T.InstancedMesh(anchored(i?m.small:m.blades),leaf,n));
  const heads=new T.InstancedMesh(anchored(m.seeds),leaf,145);
  const stamp=new T.Object3D(),tint=new T.Color();let headCount=0;
  const edgeAt=(s,side)=>trailWidth(s)+.76+.53*Math.sin(s*.071+side*1.35)+.28*Math.sin(s*.24-side);
  for(let band=0;band<2;band++)for(let i=0;i<counts[band];i++){
    let s,side,d,f;
    for(let retry=0;retry<5;retry++){
      s=start+r()*span;side=r()<.5?-1:1;
      const edge=edgeAt(s,side);
      d=band?6.8+Math.pow(r(),1.2)*30:edge+Math.pow(r(),1.38)*7.0;
      f=fieldAt(s,side,d);
      const density=.16+.44*f.shape+.42*f.influence;
      if(r()<density)break;
    }
    const u=at(s,side*Math.max(trailWidth(s)+.45,d));
    const size=(.50+r()*.95)*(.59+.51*f.shape)*(d<3.25?.68:1.);
    const h=f.strongest?.hue??[1,1,1],mix=f.influence*.91;
    stamp.position.set(u.x,u.y-.038,u.z);
    stamp.rotation.y=r()*Math.PI*2;
    stamp.scale.set(size,size*(.78+.35*f.shape+.26*f.influence),size);stamp.updateMatrix();
    grass[band].setMatrixAt(i,stamp.matrix);
    grass[band].setColorAt(i,tint.setRGB((.61+.46*f.shape+r()*.105)*(1+mix*(h[0]-1)),
      (.80+r()*.16)*(1+mix*(h[1]-1)),(.65+.25*(1-f.shape)+r()*.07)*(1+mix*(h[2]-1))));
    if(!band&&d>3.15&&i%3===0&&f.shape+f.influence>.61&&headCount<heads.count){
      if(f.influence>.34){stamp.scale.y*=1+.55*f.influence;stamp.updateMatrix();}
      heads.setMatrixAt(headCount,stamp.matrix);heads.setColorAt(headCount,tint.setRGB(1+mix*(h[0]-1),1+mix*(h[1]-1),1+mix*(h[2]-1)));headCount++;
    }
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
  for(let k=0;k<15;k++){
    const s0=start+1.4+r()*(span-2.8), side=r()<.5?-1:1, off=3.35+r()*16;
    const f=fieldAt(s0,side,off), feature=f.influence>.39;
    const type=feature?f.strongest.type:null;
    const bloom=type==='gentian'?colors[2]:type==='silver'?colors[1]:type==='gold'?colors[0]:colors[k%3];
    if(!feature&&r()>.41*f.shape)continue;
    for(let j=0;j<(feature?15:9);j++){
      const p=at(s0+(r()-.5)*2.4,side*(off+(r()-.5)*1.2)), h=.16+r()*(feature?.39:.20);
      blob(p,.014,h*.56,.013,stalk,m.pebble,0,h*.47);
      blob(p,feature?.075:.048,.032,feature?.069:.044,bloom,m.pebble,r()*6,h);
    }
  }
  function branch(a,b,w,f,color){
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z, length=Math.hypot(dx,dy,dz);
    if(length<1e-4)return;
    const U=new T.Vector3(dx,dy,dz).normalize(),V=new T.Vector3(0,0,1).cross(U).normalize();
    if(V.lengthSq()<.1)V.set(1,0,0);
    const W=new T.Vector3().crossVectors(U,V);
    const points=(p,width)=>Array.from({length:6},(_,i)=>{
      const a=i*Math.PI/3, c=width*Math.cos(a), d=width*Math.sin(a);
      return [p.x+c*V.x+d*W.x,p.y+c*V.y+d*W.y,p.z+c*V.z+d*W.z];
    });
    const p=points(a,w),q=points(b,w*f);
    for(let i=0;i<6;i++){
      const j=(i+1)%6;verts.push(...p[i],...p[j],...q[i],...p[j],...q[j],...q[i]);
      for(let j=0;j<6;j++)cols.push(color.r,color.g,color.b);
    }
  }
  function willow(p,h,dir,roll,kind){
    const trunk=treeColors[3],a={x:p.x+dir*h*.19,y:p.y+h*.40,z:p.z+h*.06},
      top={x:p.x+dir*h*.40,y:p.y+h*.77,z:p.z+h*.12};
    branch(p,a,h*.064,.59,trunk);branch(a,top,h*.044,.32,trunk);
    for(let i=0;i<7;i++){
      const q=i*2.399+roll()*1.2, reach=h*(.17+roll()*.29), lift=h*(.49+roll()*.45);
      const tip={x:top.x+Math.cos(q)*reach,y:p.y+lift,z:top.z+Math.sin(q)*reach};
      branch(i%2?a:top,tip,h*(i%2?.032:.019),.28,trunk);
      if(kind===1){
        // Slate-leaf shrubs lose height and split at the tips.
        for(let n=0;n<3;n++){
          const angle=q+n*2.1;
          blob({x:tip.x+Math.cos(angle)*h*.19,y:tip.y,z:tip.z+Math.sin(angle)*h*.20},
            h*(.19+roll()*.11),h*(.12+roll()*.10),h*(.15+roll()*.13),
            treeColors[4+(n+i)%3],m.crown,angle,h*.05+n*.09);
        }
      }else{
        blob(tip,h*(.23+roll()*.19),h*(.11+roll()*.14),h*(.23+roll()*.19),
          treeColors[i%3],m.crown,q,h*.055);
        blob({x:tip.x+Math.cos(q)*h*.20,y:tip.y+h*.13,z:tip.z+Math.sin(q)*h*.19},
          h*(.15+roll()*.12),h*(.10+roll()*.07),h*(.13+roll()*.10),
          treeColors[(i+1)%3],m.crown,q,h*.04);
      }
    }
  }
  // Long open field between purposeful shelter belts. Each belt has a
  // windward leader, low shrubs on its edge, and leaning crowns behind.
  const belts=[
    [382,1,22,4,3.7],[744,-1,18,5,3.3],[1160,1,30,5,4.7],[1550,-1,21,6,4.0],
    [1790,1,21,3,3.4],[1990,1,15,6,4.8],[2142,1,7,5,4.45],[2222,-1,14,6,3.85],
    [5038,1,14,4,3.7],[5183,-1,7,7,4.65],[5283,1,14,6,3.2],[5316,-1,17,3,3.7],[5497,1,10,7,4.55],
    [5772,1,27,5,4.1],[6125,-1,16,6,3.85],[6556,1,19,3,3.4],[6806,-1,15,4,3.6]
  ];
  for(const [s0,side,offset,n,maxH] of belts){
    if(s0<start-32||s0>end+32)continue;
    const rng=random(317+s0*41);
    for(let i=0;i<n;i++){
      const s=s0+i*3.45+rng()*1.6,d=offset+rng()*3+i*.9,h=maxH*(.71+rng()*.35);
      if(s>=start&&s<end)willow(at(s,side*d),h,side,random(29817+s0*17+i),i%3===2||s0===5283?1:0);
    }
  }
  // Low granite forms mark entry to the snowy pass and echo on descent
  // without blocking the view of the actual summit.
  const stones=[[2162,-1,6],[2191,1,6],[2241,-1,9],[2254,1,10],[5161,1,9],[5265,-1,6],[5352,1,14]];
  for(const [s0,side,d0] of stones){
    const rng=random(919+s0*23);
    for(let j=0;j<6;j++){
      const s=s0+j*1.65,d=d0+j*.6+rng()*1.9,sz=.32+rng()*1.4,angle=rng()*6;
      if(s<start||s>=end)continue;
      blob(at(s,side*d),sz*(1+j*.08),sz*.58,sz*.85,stoneColors[1+j%2],m.crown,angle,sz*.23);
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
