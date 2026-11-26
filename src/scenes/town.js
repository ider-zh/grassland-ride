import * as T from 'three';

// A compact mountain village, organized around the road rather than a scatter of props.
// Human-scaled frontages and a compact square are built from shared instanced primitives.
const BOX=new T.BoxGeometry(1,1,1);
const ROCK=new T.IcosahedronGeometry(1,0);
const POST=new T.CylinderGeometry(1,1,1,10);
const ARCH=new T.CylinderGeometry(1,1,1,18,1,true);
const gableShape=new T.Shape();
gableShape.moveTo(-.5,0);gableShape.lineTo(.5,0);gableShape.lineTo(0,1);gableShape.closePath();
const GABLE=new T.ExtrudeGeometry(gableShape,{depth:1,bevelEnabled:false}).translate(0,0,-.5);
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
const timber='#4c3829',edgeWood='#72513a',shadow='#302820';
const stone=['#847467','#9a8c7c','#a49a86','#746d64','#b09f89'];
const cream=['#d6c6a5','#e3cfaa','#beb8a4','#d6be97','#c5ad86'];
const shingle=['#51443b','#5d4a3c','#684f3e','#67463a','#5a554d'];
const shutters=['#49605d','#695347','#655841','#53604a'];
const choose=(list,r)=>list[Math.floor(r()*list.length)];
const rad=Math.PI/2;
function attach(at,s,lateral,turn=0){
  const a=at(s,lateral);
  return {x:a.x,y:a.y,z:a.z,yaw:a.yaw+turn};
}

export function buildTown({group,start,end,at,random:r}){
  const items=new Map();
  const emit=(geo,b,x,y,z,w,h,d,color,rx=0,ry=0,rz=0)=>{
    const c=Math.cos(b.yaw),s=Math.sin(b.yaw);
    if(!items.has(geo))items.set(geo,[]);
    items.get(geo).push([b.x+c*x+s*z,b.y+y,b.z-s*x+c*z,w,h,d,color,rx,b.yaw+ry,rz]);
  };
  const box=(...a)=>emit(BOX,...a);
  const rock=(...a)=>emit(ROCK,...a);
  const post=(...a)=>emit(POST,...a);
  const located=s=>s>=start&&s<end;
  function surface(b,x,y,z,w,h,d,mat,cross=false,angle=0){
    if(cross)box(b,z,y,x,d,h,w,mat,angle,0,0);
    else box(b,x,y,z,w,h,d,mat,0,0,angle);
  }
  function beam(b,x1,y1,x2,y2,z,thick=.17,mat=timber){
    const dx=x2-x1,dy=y2-y1;
    box(b,(x1+x2)/2,(y1+y2)/2,z,Math.hypot(dx,dy),thick,.15,mat,0,0,Math.atan2(dy,dx));
  }

  function base(b,w,d,foot,depth){
    box(b,0,(foot-depth)*.5,0,w+.18,foot+depth,d+.18,stone[3]);
    // Mortared local stone, false small seams rather than loose evenly spaced bricks.
    for(let row=0;row<Math.ceil(foot/.34);row++){
      const n=Math.ceil(w/.85);
      for(let j=0;j<n;j++){
        const loose=(.2+.55*r())*(j>0&&j<n-1?1:0),x=(j+.5-n*.5+loose)*w/n;
        box(b,x,.12+row*.31,-d*.5-.095,w/n*(.86+r()*.09),.235+r()*.055,.115,choose(stone,r),0,0,(r()-.5)*.028);
      }
      for(const sign of [-1,1]){
        const nn=Math.ceil(d/1.02);
        for(let j=0;j<nn;j++)box(b,sign*(w*.5+.095),.12+row*.31,(j+.5-nn*.5)*d/nn,.115,.25,d/nn*.91,choose(stone,r));
      }
    }
  }
  function window(b,x,y,z,w=.79,h=1.0,cross=false,exterior=1,lit=false){
    const paint=choose(shutters,r);
    const p=(dx,dy,dz,ww,hh,dd,col)=>surface(b,x+dx,y+dy,z+dz*exterior,ww,hh,dd,col,cross);
    p(0,0,-.02,w+.18,h+.15,.105,timber);
    p(0,0,-.083,w,h,.08,lit?'#b08d55':'#3e493d');
    p(0,.02,-.136,.04,h,.055,'#897650');p(0,.03,-.136,w,.042,.055,'#897650');
    for(const a of [-1,1])p(a*(w/2+.13),.01,-.096,.22,h+.035,.08,paint);
    p(0,-h/2-.03,-.125,w+.5,.095,.22,edgeWood);
    p(0,h/2+.055,-.13,w+.34,.095,.19,edgeWood);
  }

  function roof(b,w,d,eaves,rise,color){
    const half=w*.5+.42,a=Math.atan(rise/(w*.5)),len=(half+.03)/Math.cos(a);
    for(const sign of [-1,1]){
      const over=.49;
      const y=eaves+rise-(half*.5)*Math.tan(a);
      box(b,sign*half*.5,y,0,len,.18,d+over*2,color,0,0,-sign*a);
      // Laid courses overlap down the pitch; the offset edge catches morning light.
      const n=Math.ceil(len/.44);
      for(let i=0;i<n;i++){
        const s=(i+.5)/n*half;
        const shade=i%4===0?shingle[1]:i%5===0?shingle[3]:color;
        box(b,sign*s,eaves+rise-s*Math.tan(a)+.083,0,len/n*1.08,.067,d+over*2+.035,shade,0,0,-sign*a);
      }
      for(const end of [-1,1]){
        box(b,sign*half*.5,y-.035,end*(d*.5+over+.012),len+.12,.18,.16,timber,0,0,-sign*a);
      }
      for(let z=-d*.48;z<d*.5;z+=.68)box(b,sign*(w*.5+.15),eaves-.07,z,.49,.15,.13,edgeWood);
    }
    box(b,0,eaves+rise+.06,0,.27,.188,d+1.13,timber);
  }

  function house(s,lateral,w,d,h,kind,turn=0){
    const b=attach(at,s,lateral,Math.sign(lateral)*rad+turn);
    const inn=kind==='inn',barn=kind==='workshop',sm=kind==='cottage';
    const plaster=choose(cream,r),shade=choose(shingle,r),foot=barn?1.32:.95;
    const eaves=h,rise=w*(inn?.43:barn?.42:.51);
    let low=b.y;
    for(const a of [-.51,0,.51])for(const x of [-.52,.52])low=Math.min(low,at(s+a*w,lateral+x*d).y);
    base(b,w,d,foot,.48+b.y-low);
    box(b,0,(eaves+foot)/2,0,w,eaves-foot,d,plaster);
    emit(GABLE,b,0,eaves,0,w,rise,d,plaster);
    roof(b,w,d,eaves,rise,shade);
    // Frame all street-facing gables and wrap the posts / plate onto side wings.
    const f=-d*.5-.067,rim=w*.5-.075;
    beam(b,-rim,eaves,0,eaves+rise,f);beam(b,0,eaves+rise,rim,eaves,f);
    beam(b,-rim,eaves,rim,eaves,f,.2);
    beam(b,0,eaves+.02,0,eaves+rise-.04,f,.17);
    beam(b,-rim*.66,eaves+rise*.30,rim*.66,eaves+rise*.30,f,.16);
    if(rise>2.4){
      beam(b,-rim*.26,eaves,-rim*.49,eaves+rise*.48,f,.105);
      beam(b,rim*.26,eaves,rim*.49,eaves+rise*.48,f,.105);
    }
    if(!sm)window(b,0,eaves+rise*.42,f-.04,.76,.87,false,1,inn);
    const floor=inn?3.20:eaves>4.7?2.95:2.48;
    for(const z of [f,d*.5+.068]){
      beam(b,-rim,foot,rim,foot,z,.19);beam(b,-rim,eaves,rim,eaves,z,.205);
      if(eaves>4.6)beam(b,-rim,floor,rim,floor,z,.21);
      for(const u of [-1,-.41,.41,1])beam(b,rim*u,foot,rim*u,eaves,z,.174);
      for(const sign of [-1,1]){
        beam(b,sign*rim*.98,floor+.1,sign*rim*.43,foot+.09,z,.14);
        if(eaves>4.6)beam(b,sign*rim*.98,eaves-.02,sign*rim*.71,floor+.08,z,.14);
      }
    }
    for(const x of [-rim-.09,rim+.09]){
      box(b,x,eaves,0,.16,.18,d+.08,timber);
      if(eaves>4.6)box(b,x,floor,0,.16,.175,d+.06,timber);
      for(const z of [-.47,-.14,.16,.47])box(b,x,(foot+eaves)*.5,z*d,.17,eaves-foot,.19,timber);
      for(const z of [-.30,.19])window(b,z*d,eaves>4.6?eaves-1.02:2.20,x,.69,.90,true,x<0?1:-1);
    }
    const doorX=inn?-.45:-w*.11,doorW=inn?1.82:barn?1.62:1.18,doorH=inn?3.08:2.42;
    box(b,doorX,doorH*.5+.17,f-.039,doorW+.33,doorH+.14,.16,timber);
    box(b,doorX,doorH*.5+.171,f-.147,doorW,doorH,.12,inn?'#613e30':'#674836');
    for(let u=-.38;u<.50;u+=.22)box(b,doorX+doorW*u,doorH*.5+.17,f-.215,.022,doorH*.94,.018,shadow);
    beam(b,doorX-doorW*.47,doorH*.34,doorX+doorW*.47,doorH*.57,f-.24,.111,edgeWood);
    box(b,doorX+.31*doorW,doorH*.49,f-.246,.087,.11,.061,'#a18250');
    box(b,doorX,.08,f-.28,doorW+.40,.18,.73,stone[2]);
    for(const a of [-1,1])window(b,a*w*.305,1.95,f-.064,inn?.98:.76,.98,false,1,inn);
    if(eaves>4.6)for(const a of [-1,0,1])window(b,a*w*.279,eaves-1.04,f-.064,.83,1.05,false,1,inn);
    if(!barn||inn){
      const x=w*.28,z=d*.23,y=eaves+rise+1.1;
      box(b,x,(eaves+rise*.47+y)*.5,z,.79,y-(eaves+rise*.47),.76,stone[1]);
      box(b,x,y,z,.99,.16,.99,stone[3]);
      for(let j=0;j<4;j++)box(b,x-.406,y-.18-j*.25,z,.042,.028,.71,stone[3]);
    }
    if(inn||barn){
      const xp=w*.16,hp=inn?3.45:2.86,wp=w*.49;
      box(b,xp,hp,f-.66,wp,.14,1.19,shade,-.19);
      for(const a of [-1,1]){
        const sx=xp+a*(wp*.46);
        box(b,sx,hp*.50,f-1.18,.17,hp+.04,.19,timber);
        box(b,sx,.19,f-1.18,.30,.47,.30,stone[1]);
      }
      if(inn){
        box(b,-w*.30,4.00,f-.43,.17,.16,.87,timber);
        box(b,-w*.30,3.63,f-.82,.63,.52,.1,'#8f5d40');
        post(b,-w*.30,3.64,f-.88,.145,.024,.145,'#c6a469',rad);
        box(b,-w*.30+.13,3.65,f-.89,.16,.055,.05,'#c6a469');
      }
    }
  }

  function wall(s,lateral,len,h=.83){
    const b=attach(at,s,lateral);
    const slots=Math.ceil(len/.72);
    for(let k=0;k<slots;k++){
      const z=(k+.5-slots*.5)*len/slots;
      box(b,(r()-.5)*.078,h*.30,z,.55,h*1.22,len/slots+.02,choose(stone,r),0,(r()-.5)*.23);
      box(b,0,h*.73,z,.63,.16,len/slots-.042,choose(stone,r),0,(r()-.5)*.12);
    }
  }
  function hedge(s,lateral,len){
    const b=attach(at,s,lateral);
    for(let i=0;i<Math.ceil(len/.70);i++){
      const z=(i+.5-Math.ceil(len/.70)*.5)*.70;
      rock(b,(r()-.5)*.29,.39+r()*.19,z,.61,.53+r()*.18,.62,choose(['#626c45','#626949','#717752','#545c42'],r),r()*.4,r()*4,r()*.17);
    }
  }

  function gateway(s){
    const b=attach(at,s,0);
    const yL=at(s,-4.35).y-b.y,yR=at(s,4.35).y-b.y;
    for(const [a,y] of [[-1,yL],[1,yR]]){
      const x=a*4.35;
      box(b,x,1.46+y,0,1.67,4.36,1.52,stone[2]);
      for(let j=0;j<8;j++)for(let n=0;n<2;n++){
        box(b,x+(n-.5)*.74,(j+.15)*.44+y,.795,.70,.39,.15,choose(stone,r));
        box(b,x+(n-.5)*.74,(j+.15)*.44+y,-.795,.70,.39,.15,choose(stone,r));
      }
      box(b,x,3.71+y,0,1.88,.25,1.76,stone[3]);
      box(b,x,4.17+y,0,.37,.89,.49,timber);
      const cap=Object.assign({},b,{x:b.x+Math.cos(b.yaw)*x,y:b.y+y,z:b.z-Math.sin(b.yaw)*x});
      roof(cap,1.71,1.55,3.94,.79,shingle[0]);
    }
    // No low beams across the road. The beam bridges the two piers above
    // 4.25m even with grade and camber; the rider is about 2.9m high.
    const high=4.69+Math.max(0,yL,yR);
    box(b,0,high,0,8.96,.28,.27,timber);
    for(const a of [-1,1])box(b,a*3.91,high-.35,0,1.27,.12,.17,edgeWood,0,0,a*.49);
  }

  function well(s,lateral){
    const b=attach(at,s,lateral);
    const r0=1.11,h=1.05;
    emit(ARCH,b,0,.45,0,r0,.96,r0,stone[0]);
    for(let j=0;j<3;j++)for(let i=0;i<13;i++){
      const a=(i+j*.45)/13*2*Math.PI;
      box(b,r0*Math.sin(a),.15+j*.28,r0*Math.cos(a),.51,.24,.27,choose(stone,r),0,a);
    }
    for(let i=0;i<18;i++){
      const a=i/18*2*Math.PI;
      box(b,r0*Math.sin(a),h,r0*Math.cos(a),.43,.13,.38,stone[2],0,a);
    }
    post(b,0,.53,0,.96,.014,.96,'#344642');
    for(const a of [-1,1]){
      box(b,a*1.02,1.68,0,.17,3.48,.17,timber);
      box(b,a*1.02,3.16,0,.66,.13,.19,edgeWood,0,0,-a*.63);
    }
    box(b,0,2.05,0,2.16,.12,.15,edgeWood);
    post(b,0,1.71,0,.018,.61,.018,'#a88b63');
    post(b,0,1.38,0,.16,.24,.16,'#785a3c');
    roof(b,2.08,1.65,3.32,.85,shingle[3]);
  }

  function square(s,lateral){
    // Small off-road gathering area, each worn paving slab follows terrain.
    for(let i=0;i<12;i++){
      const p=s-5.1+i*.89;
      if(!located(p))continue;
      for(let row=0;row<6;row++){
        const sign=Math.sign(lateral);
        const x=lateral+sign*(row*.86-.15+(i%2)*.15);
        const base=attach(at,p,x);
        const width=.67+r()*.24;
        box(base,0,.024,0,width,.09,.72+r()*.19,choose(stone,r),0,(r()-.5)*.24);
      }
    }
  }

  // Choreography down a narrow connected street: outer gate and pasture wall,
  // first tight row, pocket market/well with a landmark inn, then crofts.
  // Building frontage intervals intentionally abut but don't overlap.
  const houses=[
    [31,-7.65,5.5,5.9,4.15,'cottage',.02],
    [44,7.35,7.1,6.2,4.70,'workshop',-.035],[53,7.62,7.9,6.6,5.36,'home',-.017],
    [63,8.05,8.8,7.1,5.6,'home',-.029],[73,7.75,8.5,6.8,5.20,'home',.014],
    [43,-7.82,7.0,6.7,4.92,'home',.022],[52.5,-7.70,8.5,6.8,5.35,'home',.012],
    [62.6,-8.31,8.2,7.8,5.68,'home',-.025],[72.3,-8.02,8.5,6.8,5.08,'workshop',-.035],
    [89,8.25,8.2,6.6,5.40,'home',.064],[102,9.88,11.2,8.4,6.53,'inn',.035],
    [115,8.52,8.2,7.4,5.42,'home',-.009],[125,8.25,8.1,7.2,5.62,'home',-.018],
    [87,-9.31,8.0,7.3,4.83,'workshop',.04],[99,-15.05,8.3,7.1,4.9,'workshop',.11],
    [111,-8.47,7.8,6.4,5.52,'home',-.01],[121,-7.91,8.6,6.7,5.28,'home',.037],
    [132,-8.81,8.3,7.3,5.39,'home',.012],[145,-9.15,7.1,6.3,4.64,'cottage',-.06],
    [146,9.00,7.4,6.7,4.51,'cottage',.07],[159,9.61,6.3,5.8,3.97,'cottage',-.05]
  ];
  for(const h of houses)if(located(h[0]))house(...h);
  for(const [s,x,len,h] of [[8,-4.1,8.5,.72],[17,-4.2,8.2,.74],[14,4.55,12,.76],[31,5.20,9.2,.83],
    [83,4.87,5.1,.69],[102,-9.85,5.2,.44],[137,4.25,10,.72],[143,4.32,6,.74],
    [157,-4.5,9.2,.78],[168,-4.55,10.2,.74],[179,-4.91,9.2,.62],[171,5.85,12,.64]])
    if(located(s))wall(s,x,len,h);
  for(const [s,x,len] of [[11,-5.52,12],[12,5.55,17],[34,6.1,3.1],[137,5.39,6],[171,-5.72,13],[180,6.8,12]])
    if(located(s))hedge(s,x,len);
  if(located(24))gateway(24);
  if(located(97.5))well(97.5,-7.55);
  square(97.3,-4.25);

  const stamp=new T.Object3D(),tint=new T.Color();
  for(const [geo,list] of items){
    const mesh=new T.InstancedMesh(geo,material,list.length);
    for(let i=0;i<list.length;i++){
      const [x,y,z,w,h,d,col,rx,ry,rz]=list[i];
      stamp.position.set(x,y,z);stamp.rotation.set(rx,ry,rz,'YXZ');stamp.scale.set(w,h,d);
      stamp.updateMatrix();mesh.setMatrixAt(i,stamp.matrix);mesh.setColorAt(i,tint.set(col));
    }
    mesh.instanceMatrix.needsUpdate=mesh.instanceColor.needsUpdate=true;
    mesh.castShadow=geo!==ROCK;mesh.receiveShadow=true;
    group.add(mesh);
  }
}
