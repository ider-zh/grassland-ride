import * as T from 'three';

// Trail settlement: raked limewashed walls, shallow slate roofs and dark,
// deep-set timber openings. All dimensions are scene metres. Near details
// are batched by primitive rather than contributing one draw call per beam.
const BOX=new T.BoxGeometry(1,1,1);
const TAPER=BOX.clone();
const wallPosition=TAPER.attributes.position;
for(let i=0;i<wallPosition.count;i++)if(wallPosition.getY(i)>.0){
  wallPosition.setX(i,wallPosition.getX(i)*.964);
  wallPosition.setZ(i,wallPosition.getZ(i)*.964);
}
TAPER.computeVertexNormals();
const BALL=new T.IcosahedronGeometry(1,0);
const CONE=new T.ConeGeometry(1,1,7);
const POST=new T.CylinderGeometry(1,1,1,8);
const material=new T.MeshStandardMaterial({roughness:.91});
// Soft detail at saddle distance without texture fetches or repeated assets.
material.onBeforeCompile=sh=>{
  sh.vertexShader='varying vec3 townP;\n'+sh.vertexShader.replace('#include <begin_vertex>',`
    #include <begin_vertex>
    townP=(instanceMatrix*vec4(position,1.)).xyz;
  `);
  sh.fragmentShader=`
    varying vec3 townP;
    float townHash(vec3 p) {
      return fract(sin(dot(mod(p,289.),vec3(11.3,53.2,137.1)))*41933.6);
    }
    float townNoise(vec3 p) {
      vec3 i=floor(p), f=fract(p);
      f=f*f*(3.-2.*f);
      return mix(
        mix(mix(townHash(i),townHash(i+vec3(1,0,0)),f.x),mix(townHash(i+vec3(0,1,0)),townHash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(townHash(i+vec3(0,0,1)),townHash(i+vec3(1,0,1)),f.x),mix(townHash(i+vec3(0,1,1)),townHash(i+vec3(1,1,1)),f.x),f.y),
        f.z);
    }
  `+sh.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    float film=townNoise(townP*vec3(2.6,4.1,2.6));
    float fleck=townNoise(townP*20.);
    diffuseColor.rgb*=0.91+0.14*film+0.04*fleck;
  `);
};
const flagGeometry=new T.PlaneGeometry(1,1,3,2);
const flagMaterial=new T.MeshStandardMaterial({roughness:1,side:T.DoubleSide});
const flags=['#8f5148','#caa059','#e0d3a8','#59777c','#6f7c5d'];
const stone=['#8b7865','#9a8874','#aa987e','#736657','#ae9a86','#958476'];
const wash=['#d9c5a3','#d4bc96','#e4d1b4','#c7ac8e','#c9bdab'];
const slates=['#494b45','#56564d','#615b50','#4b5151'];
const wood=['#655044','#5e4b42','#765748','#855744'];
const choose=(list,r)=>list[Math.floor(r()*list.length)];

function attach(at,s,lateral,turn=0){
  const a=at(s,lateral);
  return {x:a.x,y:a.y,z:a.z,yaw:a.yaw+turn};
}

export function buildTown(ctx){
  const {group,start,end,at,random:r,windTime,own}=ctx;
  const items=new Map();
  const emit=(geo,b,x,y,z,w,h,d,color,rx=0,ry=0,rz=0)=>{
    const c=Math.cos(b.yaw),s=Math.sin(b.yaw);
    const item=[b.x+c*x+s*z,b.y+y,b.z-s*x+c*z,w,h,d,color,rx,b.yaw+ry,rz];
    if(!items.has(geo))items.set(geo,[]);
    items.get(geo).push(item);
  };
  const box=(...a)=>emit(BOX,...a);
  const rock=(...a)=>emit(BALL,...a);
  const post=(...a)=>emit(POST,...a);
  const cone=(...a)=>emit(CONE,...a);
  const cloth=(...a)=>emit(flagGeometry,...a);

  function house(s,lateral,kind){
    const b=attach(at,s,lateral,Math.sign(lateral)*Math.PI*.5+(r()-.5)*.11);
    const lodge=kind==='lodge';
    const w=lodge?9.2:5.0+r()*2.2,d=lodge?5.7:3.7+r()*1.3;
    const first=1.95+r()*.36,h=first+(lodge?1.82:r()<.45?1.28:.35);
    const plaster=choose(wash,r),trim=choose(wood,r),roof=choose(slates,r);
    // Bury the foundation deeply so structures remain seated on sloped plots.
    box(b,0,-.34,0,w+.18,1.45,d+.16,choose(stone,r));
    emit(TAPER,b,0,h*.5+.17,0,w,h,d,plaster);
    // Raked jambs, projected stone courses, and softly varied foundation blocks.
    for(const sign of [-1,1]){
      box(b,sign*(w*.50-.06),h*.46,-d*.50-.01,.23,h*.88,.14,choose(stone,r),0,0,-sign*.021);
    }
    for(let k=0;k<3;k++){
      const n=Math.ceil(w/.51);
      for(let j=0;j<n;j++){
        const xx=(j+.5+(k%2? .24:-.16)-n*.5)*w/n;
        if(Math.abs(xx)>.48*w)continue;
        box(b,xx,.035+k*.16,-d*.5-.09,w/n*.93,.13,.11,choose(stone,r));
      }
    }
    const bands=lodge||h>3;
    if(bands){
      for(const z of [-1,1])box(b,0,first,z*(d*.5+.026),w-.12,.15,.08,'#7c5144');
      for(const x of [-1,1])box(b,x*(w*.5+.026),first,0,.08,.15,d-.13,'#7c5144');
    }
    const door=-w*.23,wall=-d*.5;
    const doorTone=lodge?'#775048':'#795d46';
    function pane(x,y,z,w,h,mode){
      const door=mode==='door',across=mode==='side';
      const add=(dx,dy,dz,ww,hh,dd,tone)=>{
        if(across)box(b,x+dz,y+dy,z+dx,dd,hh,ww,tone);
        else box(b,x+dx,y+dy,z+dz,ww,hh,dd,tone);
      };
      add(0,0,-.036,w+.26,h+.22,.07,'#584d42');
      add(0,0,-.082,w+.03,h+.03,.09,door?doorTone:'#282a27');
      add(-(w+.07)/2,0,-.14,.115,h+.15,.08,trim);
      add((w+.07)/2,0,-.14,.115,h+.15,.08,trim);
      add(0,h*.5+.05,-.16,w+.31,.13,.19,trim);
      add(0,-h*.5-.035,-.15,w+.24,.095,.174,door?'#988366':'#9e7c5a');
      add(0,0,-.145,door?.04:.045,h*.93,.045,door?'#493a31':'#754f39');
      if(door){
        for(const k of [-.32,.32])add(0,k*h,-.15,w-.015,.06,.05,trim);
        add(w*.22,-.08,-.195,.093,.09,.04,'#b08148');
      }else{
        add(0,.03,-.148,w*.93,.044,.047,trim);
        add(w*.19,h*.23,-.132,w*.22,h*.27,.016,'#a08462');
      }
    }
    pane(door,.91,wall,.79,1.59,'door');
    for(const xx of lodge?[-3.22,-.36,1.20,3.14]:[w*.12,w*.34]){
      pane(xx,1.36,wall,lodge?.71:.57,.54,'window');
    }
    if(bands)for(const xx of [-.30,-.10,.12,.32])pane(xx*w,h-.59,wall,.54,.65,'window');
    for(const zz of [-.21,.21])pane(-w*.5,1.40,zz*d,.57,.53,'side');

    // Dark roof rake, projecting rafter tails and parapet cap.
    box(b,0,h+.17,0,w+.60,.13,d+.56,trim);
    box(b,0,h+.28,0,w+.84,.15,d+.78,roof);
    box(b,0,h+.39,0,w+.45,.105,d+.45,choose(slates,r));
    for(const sign of [-1,1]){
      box(b,0,h+.48,sign*(d*.5+.07),w+.46,.14,.19,roof);
      box(b,sign*(w*.5+.12),h+.48,0,.18,.14,d+.40,roof);
      for(let xx=-w*.5+.18;xx<w*.5;xx+=.46)box(b,xx,h+.14,sign*(d*.5+.17),.105,.13,.37,trim);
    }
    const sx=(r()-.5)*w*.53,sz=(r()-.5)*d*.43;
    box(b,sx,h+.71,sz,.44,.68,.49,'#ae947e');
    box(b,sx,h+1.03,sz,.58,.10,.60,roof);
    box(b,door,.12,wall-.31,1.14,.24,.67,'#9b8668');
    box(b,door,.025,wall-.63,1.19,.18,.43,'#85755e');

    if(lodge){
      const x=w*.13,porchD=1.04,porchW=w*.63;
      box(b,x,1.88,wall-.58,porchW,.10,porchD,'#9d866b',-.105);
      box(b,x,1.82,wall-1.07,porchW+.15,.15,.15,trim);
      for(const px of [x-porchW*.44,x+porchW*.44]){
        box(b,px,.94,wall-1.01,.16,1.9,.18,trim);
        box(b,px,.14,wall-1.01,.24,.31,.23,'#827260');
      }
      box(b,x,.39,wall-.83,1.2,.09,.25,'#8b6148');
      for(const dx of [-.45,.45])box(b,x+dx,.18,wall-.83,.13,.36,.17,trim);
    }else if(r()>.33){
      for(let j=0;j<5;j++)post(b,-w*.42+j*.14,.19,wall-.29,.067,.57,.066,'#674d38',Math.PI/2);
    }
    if(r()<.72){
      const px=w*.38;
      rock(b,px,.22,wall-.63,.31,.22,.25,'#786755');
      rock(b,px-.25,.13,wall-.42,.30,.14,.21,'#9b8875');
    }
  }

  function roadsideWall(s,side,len=5.2){
    const b=attach(at,s,side*(3.67+r()*.7));
    const n=Math.ceil(len/.68);
    for(let j=0;j<n;j++){
      const z=(j+.5-n*.5)*len/n;
      const h=.34+r()*.13;
      box(b,(r()-.5)*.09,h*.46,z,.53,h+.29,len/n+.02,choose(stone,r),0,(r()-.5)*.22);
      box(b,0,h-.025,z,.62,.14,len/n-.02,choose(stone,r),0,(r()-.5)*.1);
    }
  }

  function waypost(s,lateral,ceremonial=false){
    const b=attach(at,s,lateral);
    const h=ceremonial?2.82:2.03;
    const col='#745542';
    box(b,0,-.03,0,.44,.31,.44,'#948372');
    box(b,0,h*.48,0,.15,h,.16,col);
    box(b,0,h-.25,0,.24,.08,.24,'#ae7757');
    cone(b,0,h-.03,0,.14,.20,.14,'#c3a777');
    if(ceremonial){
      for(let j=0;j<5;j++){
        const h0=h-.55-j*.21;
        const dir=Math.sign(lateral),dx=dir*(.35+.13*j);
        const x=dx*.53;
        box(b,x,h0+.065,.005,Math.abs(dx)+.09,.032,.035,'#9a8269',0,0,-dir*.12);
        cloth(b,dx*.78,h0-.062,.026,.34,.25,.23,flags[j],0,-.13,dir*.09)
      }
    }else{
      box(b,.265,1.53,0,.67,.22,.13,'#725140',0,0,.085);
      box(b,.13,1.55,-.075,.29,.031,.014,'#c7a674',0,0,.085);
      box(b,.34,1.50,-.075,.20,.028,.014,'#b1956f',0,0,.085);
    }
  }

  function juniper(s,lateral,h){
    const b=attach(at,s,lateral);
    post(b,0,.42*h,0,.11,.95*h,.11,'#655542',.08,0,.12);
    for(let j=0;j<5;j++){
      const y=(.37+j*.135)*h,rad=(.31-j*.046)*h;
      cone(b,(r()-.5)*h*.16,y,(r()-.5)*h*.13,rad,h*.44,rad*.92,choose(['#526045','#61674c','#53644e','#78805b'],r),-.15,0,.11);
    }
  }

  function stack(s,lateral){
    const b=attach(at,s,lateral);
    for(let i=0;i<5;i++){
      const size=.54-i*.084;
      rock(b,(r()-.5)*.2,.095+i*.18,(r()-.5)*.12,size,.14-i*.013,size*.68,choose(stone,r),(r()-.5)*.4,r()*3,.15);
    }
  }

  // Deterministic landmarks with intentional breathing space on either side
  // of the settlement; a section can be unloaded without modifying another.
  const homes=[
    [14,9.3,'home'],[25,-9.6,'home'],
    [41,8.2,'home'],[50,-8.8,'lodge'],[61,17.8,'home'],
    [69,10.0,'home'],[73,-11.9,'home'],[87,-15.8,'home'],
    [106,10.1,'lodge'],[117,-9.7,'home'],
    [127,17.1,'home'],[135,-10.8,'home'],[148,10.3,'home'],
    [166,-12.5,'home']
  ];
  const inChunk=s=>s>=start&&s<end;
  for(const [s,lateral,kind] of homes)if(inChunk(s))house(s,lateral,kind);
  const walls=[[11,-1,5],[17,-1,4],[28,1,6],[36,-1,5],[44,1,5],[58,1,5],[78,-1,6],
    [90,1,6],[96,1,6],[104,-1,6],[112,-1,6],[121,1,5],[135,1,5],[145,-1,5],[155,-1,6],
    [169,1,6],[179,1,5]];
  for(const [s,side,len] of walls)if(inChunk(s))roadsideWall(s,side,len);
  for(const [s,x,main] of [[7,-3.55,1],[8,3.78,1],[33,4.25,0],[98,-4.11,1],[154,4.12,0],[183,-3.89,1]])
    if(inChunk(s))waypost(s,x,main);
  for(const [s,x,h] of [[9,17,3.1],[18,-17,2.7],[32,-18,2.6],[64,-21,4.2],[92,13,3.1],
    [101,15,3.9],[129,-18,3.2],[156,13,3.6],[175,-17,3.7],[184,9,2.5],[188,11,3.4]])
    if(inChunk(s))juniper(s,x,h);
  for(const [s,x] of [[5,5],[82,5],[95,-5],[162,-5],[182,5],[186,6]])
    if(inChunk(s))stack(s,x);
  for(let i=0;i<26;i++){
    const s=T.MathUtils.lerp(start+.9,end-.9,r()),side=r()<.5?-1:1,x=side*(3.2+r()*16);
    const b=attach(at,s,x),size=.14+r()*.41;
    rock(b,0,.055,0,size,.09+r()*.17,size*.65,r()<.66?choose(stone,r):'#646e45',r()*.4,r()*6,.11);
  }

  const stamp=new T.Object3D(),tint=new T.Color();
  for(const [geo,list] of items){
    // This optional per-chunk material shares the wind clock uniform but
    // uses local flag coordinates to keep each cloth's hanging edge free.
    let mat=material;
    if(geo===flagGeometry){
      mat=flagMaterial;
      if(windTime&&typeof windTime==='object'&&'value' in windTime&&own){
        mat=flagMaterial.clone();own(mat);
        mat.onBeforeCompile=sh=>{
          sh.uniforms.townWindTime=windTime;
          sh.vertexShader='uniform float townWindTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',`
            #include <begin_vertex>
            float lifted = 0.5 - position.y;
            float wavePhase = instanceMatrix[3].x * 0.42 + instanceMatrix[3].z * 0.37;
            transformed.z += lifted * (0.49 * sin(townWindTime * 4.2 + position.x * 5.8 + wavePhase));
            transformed.y += lifted * 0.17 * sin(townWindTime * 3.2 + wavePhase);
          `);
        };
      }
    }
    const mesh=new T.InstancedMesh(geo,mat,list.length);
    for(let i=0;i<list.length;i++){
      const [x,y,z,w,h,d,col,rx,ry,rz]=list[i];
      stamp.position.set(x,y,z);stamp.rotation.set(rx,ry,rz,'YXZ');stamp.scale.set(w,h,d);
      stamp.updateMatrix();mesh.setMatrixAt(i,stamp.matrix);mesh.setColorAt(i,tint.set(col));
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
    mesh.castShadow=geo===BOX||geo===TAPER||geo===CONE;mesh.receiveShadow=true;
    group.add(mesh);
  }
}
