import * as T from 'three';

// Slate outcrops are assembled from low-sided bevelled slabs, with pale
// fractured top surfaces and darker strata. One instanced draw per material
// family, not one mesh per stone.
const color = x => new T.Color(x);
const slate = ['#5e6364','#737678','#675c54','#5a6062','#808073'].map(color);
const grass = ['#838051', '#787347', '#969267', '#8a8862', '#626b4d'].map(color);
const timber = ['#66533c', '#695842', '#84603d'].map(color);
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

const faceMaterial=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
faceMaterial.onBeforeCompile=sh=>{
  sh.vertexShader='attribute vec3 rockBasis; varying vec3 rockWorld;\n'+sh.vertexShader.replace('#include <begin_vertex>',`
    #include <begin_vertex>
    rockWorld=rockBasis;
  `);
  sh.fragmentShader='varying vec3 rockWorld;\n'+sh.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    float bedding=rockWorld.y*.94+rockWorld.z*.16+rockWorld.x*.09;
    float breaks=sin(rockWorld.z*1.9+sin(rockWorld.y*1.5))*sin(rockWorld.x*1.3+rockWorld.y*.56);
    float seam=pow(max(0.,sin(bedding*6.3+.66*breaks)),12.);
    float dark=pow(max(0.,sin(bedding*2.3+.55*breaks)),8.);
    float grit=fract(sin(dot(floor(66.*rockWorld),vec3(12.1,47.4,139.4)))*2374.1);
    diffuseColor.rgb*=.91+.13*grit+.09*breaks-.16*seam-.21*dark;
  `);
};

const mix=(a,b,x)=>a+(b-a)*x;
const f=(s,from,to)=>Math.min(T.MathUtils.smoothstep(s,from,from+17),1-T.MathUtils.smoothstep(s,to-18,to));
const cliffColors=[
  '#525857','#565f63','#616767','#707677','#6e6a61','#535b5d',
  '#747675','#66696a','#717878','#6b6e68','#7c827c','#88877d','#686c6b'
].map(color);
const temp=color('white');

// Each profile extends from the shared grade up the valley wall. Bedrock
// shelves interleave with bevels, and every sampled endpoint is a pure
// function of route distance, so streamed neighbours meet across chunk seams.
export function cutWall(ctx,from,to,side,amplitude,identity,{foot=6.3,reach=12,variant='canyon'}={}){
  const start=Math.max(from,ctx.start),end=Math.min(to,ctx.end);
  if(end<=start)return;
  const {at}=ctx,points=[],colors=[],idx=[],basis=[],bp=13,n=Math.ceil((end-start)/2);
  const hz=[0,.12,.15,.28,.35,.39,.58,.63,.67,.79,.87,.94,1];
  const runs=[0,.06,.21,.25,.28,.38,.44,.51,.59,.66,.73,.85,1];
  const fold=(s,i)=>Math.sin(s*.103+i*.52+identity)*.61+
    Math.sin(s*.31+i*.42+identity*2.7)*.34+Math.sin(s*.73+i*.35)*.17;
  for(let k=0;k<=n;k++){
    const s=mix(start,end,k/n),t=f(s,from,to);
    const gate=variant==='canyon'?Math.exp(-Math.pow((s-(2459+side*4))/16,2)):0;
    const toe=foot+side*.6+.91*fold(s,0)-gate*.82;
    const tall=amplitude*(.44+t*.56)+gate*1.9+amplitude*.085*fold(s,2);
    for(let l=0;l<bp;l++){
      const d=side*(toe+runs[l]*(reach+t*reach*.52)+fold(s,l)*t*.62);
      const p=at(s,d);
      const bottom=at(s,side*toe).y;
      const raw=bottom+hz[l]*tall+fold(s,l)*t*hz[l]*1.6;
      // Sink the perimeter well below the graded surface to avoid floating
      // panels on steeper terrain and opening cracks along the cut edges.
      const y=(l===0?p.y-.54:(l===bp-1?p.y-.85:
        mix(p.y-.33,Math.max(p.y+.08,raw),t)));
      points.push(p.x,y,p.z);basis.push(d,y-bottom,-s);
      temp.copy(cliffColors[l]).multiplyScalar(.90+.10*fold(s,l));
      colors.push(temp.r,temp.g,temp.b);
      if(k<n&&l<bp-1){
        const i=k*bp+l;
        const tri=(k+l)%2?[i,i+1,i+bp+1,i,i+bp+1,i+bp]:[i,i+1,i+bp,i+1,i+bp+1,i+bp];
        idx.push(...tri);
      }
    }
  }
  const g=new T.BufferGeometry();g.setIndex(idx);
  g.setAttribute('position',new T.Float32BufferAttribute(points,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.setAttribute('rockBasis',new T.Float32BufferAttribute(basis,3));
  g.computeVertexNormals();
  const mesh=new T.Mesh(g,faceMaterial);
  mesh.name='Folded slate '+variant+' cut';
  mesh.receiveShadow=true;
  // The main terrain occludes the far side. Do not cast umbrella-shaped
  // shadows from the top cap over the sunset valley floor.
  ctx.group.add(mesh);ctx.own(g);
}

const pick=(r,palette)=>palette[Math.floor(r()*palette.length)];
const stamp=new T.Object3D();
const lightStone=['#9d8771','#a29078','#917c69','#6c655d','#aba193'].map(color);
const bark=['#53473a','#76644c','#9d7b57','#73543b'].map(color);
const rust=['#a14929','#b06038','#82452f','#bc8d40'].map(color);
const ownedCloth=new T.PlaneGeometry(1.3,.41,12,4);
const bannerMaterialCache=new WeakMap();

function bannerMaterial(clock){
  if(bannerMaterialCache.has(clock))return bannerMaterialCache.get(clock);
  const m=new T.MeshLambertMaterial({color:'#a34c33',side:T.DoubleSide,emissive:0x160602});
  m.onBeforeCompile=sh=>{
    sh.uniforms.ridgeTime=clock;
    sh.vertexShader='uniform float ridgeTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float freeEnd=smoothstep(0.,1.,uv.x);
      transformed.z+=freeEnd*(.19*sin(6.*uv.x-6.*ridgeTime)+.065*sin(17.*uv.x-9.*ridgeTime+uv.y));
      transformed.y-=.13*freeEnd*(.7+.3*sin(6.*uv.x-4.*ridgeTime));
    `);
    sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float hemming=step(.06,vUv.x)*step(vUv.x,.945)*step(.095,vUv.y)*step(vUv.y,.9);
      float worn=.71+.13*sin(vUv.x*122.)*sin(vUv.y*97.)+.14*sin(vUv.x*21.+vUv.y*5.);
      diffuseColor.rgb*=worn*(.66+.37*hemming);
    `);
  };
  m.defines={...m.defines,USE_UV:''};
  bannerMaterialCache.set(clock,m);
  return m;
}

export function makeSet(ctx){
  const {group,at,random:r,windTime,own}=ctx;
  const rocks=[],woods=[],plants=[];
  function rock(s,lateral,w,h,d,{hue=pick(r,slate),rise=h*.23,rot=0,tilt=.06}={}){
    const p=at(s,lateral);
    rocks.push([p.x,p.y+rise,p.z,w,h,d,p.yaw+rot,hue,tilt,(r()-.5)*.12]);
  }
  function timberAt(s,lateral,w,h,d,{hue=pick(r,bark),rise=h*.44,rot=0,tilt=0}={}){
    const p=at(s,lateral);
    woods.push([p.x,p.y+rise,p.z,w,h,d,p.yaw+rot,hue,tilt,(r()-.5)*.08]);
    return p;
  }
  function tie(a,b,w,depth,y,hue=pick(r,bark)){
    const delta=new T.Vector3(b.x-a.x,b.y-a.y,b.z-a.z);
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),delta.clone().normalize());
    woods.push([(a.x+b.x)*.5,(a.y+b.y)*.5+y,(a.z+b.z)*.5,delta.length()+.12,w,depth,0,hue,0,0,q]);
  }
  function scrub(s,lateral,size,{height=.75,palette=grass}={}){
    const p=at(s,lateral);
    plants.push([p.x,p.y-.014,p.z,size,size*height,size,r()*6.28,pick(r,palette),0,0]);
  }
  function marker(s,d,scale=1,palette=lightStone){
    let rise=.025;
    for(let i=0;i<6;i++){
      const w=scale*(.86-i*.12),h=scale*(.29-i*.025);
      rock(s+(r()-.5)*.08,d+(r()-.5)*.11,w,h,w*.70,{hue:pick(r,palette),rise:rise+h*.41,rot:r()*6.28});
      rise+=h*.74;
    }
  }
  function flag(s,d){
    const p=timberAt(s,d,.105,2.5,.11);
    const m=new T.Mesh(ownedCloth,bannerMaterial(windTime));
    m.name='Worn cinnabar route pennant';
    m.position.set(p.x+.54,p.y+2.06,p.z+.31);
    m.rotation.y=-.31;
    group.add(m);
  }
  function scatter(patches,count,radius,options){
    for(const [s,d] of patches)for(let i=0;i<count;i++){
      const j=s+(r()-.5)*5,l=d+(r()-.5)*radius;
      if(j<ctx.start||j>=ctx.end||Math.abs(l)<3.1)continue;
      scrub(j,l,.24+r()**1.55*(options?.size??1.0),options);
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
    mesh.computeBoundingSphere();group.add(mesh);own(mesh);
  }
  function finish(title){
    batch(rocks,stoneGeometry,rockMaterial,{cast:true,name:title+' strata'});
    batch(plants,scrubGeometry,getScrubMaterial(windTime),{name:title+' windswept plants'});
    batch(woods,woodGeometry,woodMaterial,{cast:true,name:title+' timber'});
  }
  return {rock,timberAt,tie,scrub,marker,flag,scatter,finish,slate,lightStone,bark,rust};
}

const within=(s,ctx)=>s>=ctx.start&&s<ctx.end;
export function buildRidge(ctx){
  const {start,end,random:r}=ctx;
  const set=makeSet(ctx);
  // Uphill side only, one coherent band: dark thin seams in stepped benches.
  // The left side remains open to the landscape.
  const banks=[[3010,3184,1],[3230,3370,1],[3448,3570,1],[3680,3745,1]];
  for(let i=0;i<banks.length;i++){
    const [from,to,side]=banks[i];
    cutWall(ctx,from,to,side,6.8,i+10,{foot:7.8,reach:7.3,variant:'ridge'});
    for(let s=from;s<to;s+=9){
      if(!within(s,ctx))continue;
      for(let k=0;k<4;k++){
        const z=s+(r()-.5)*5,n=side*(5+r()*4.1),q=.12+r()**2*.62;
        set.rock(z,n,q*1.42,q*.53,q);
      }
    }
  }
  const fences=[[3170,3213],[3276,3304],[3384,3424],[3548,3571]];
  for(const [from,to] of fences){
    const off=s=>-4.7-.46*Math.sin((s-from)*.13);
    for(let s=from;s<to;s+=2.65){
      if(!within(s,ctx))continue;
      const p=set.timberAt(s,off(s),.142,.97,.145);
      if(s+2.65<to){
        const nxt=ctx.at(s+2.65,off(s+2.65));
        set.tie(p,nxt,.093,.094,.68);set.tie(p,nxt,.068,.083,.37);
      }
      if(Math.abs(s-from)<.2)set.rock(s,off(s)-.46,1.1,.67,.88,{hue:pick(r,lightStone)});
    }
  }
  for(const s of [3092,3217,3366,3537,3774])if(within(s,ctx))set.marker(s,-3.8+.12*Math.sin(s),1.05);
  for(const s of [3183,3208,3394,3560])if(within(s,ctx))set.flag(s,-6.15);
  // Narrow alpine pockets grow against depressions rather than all over the view.
  const patches=[];
  for(let i=0;i<9;i++){
    const s=start+.3+r()*(end-start-.6),side=i<6?1:-1;
    const d=side*(3.8+r()**2*14.5);
    patches.push([s,d]);
  }
  set.scatter(patches,13,3.2,{height:.49,size:.74});
  set.finish('Snowline ledge');
}
