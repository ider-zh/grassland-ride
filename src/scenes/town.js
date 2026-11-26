import * as T from 'three';

// A compact mountain village, organized around the road rather than a scatter of props.
// Human-scaled frontages and a compact square are built from shared instanced primitives.
const BOX=new T.BoxGeometry(1,1,1);
const ROCK=new T.IcosahedronGeometry(1,0);
const LEAF=new T.IcosahedronGeometry(1,1);
const POST=new T.CylinderGeometry(1,1,1,10);
const CONE=new T.ConeGeometry(1,1,8);
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
    float fleck=townNoise(townP*24.);
    float worn=townNoise(townP*vec3(1.1,.42,1.1));
    float streak=townNoise(townP*vec3(5.2,.82,5.2));
    diffuseColor.rgb*=0.83+0.13*film+0.055*fleck+0.11*worn-0.05*smoothstep(.48,.86,streak);
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
    const inn=kind==='inn',barn=kind==='workshop',sm=kind==='cottage',was=kind==='stone';
    const plaster=inn?'#cba680':was?'#a79c88':barn?'#b9bca5':choose(cream,r);
    const shade=inn?'#68463a':was?'#535855':barn?'#5f4d42':choose(shingle,r),foot=was?2.7:barn?1.32:.95;
    const eaves=h,rise=w*(inn?.48:barn?.39:sm?.39:.54);
    let low=b.y;
    for(const a of [-.51,0,.51])for(const x of [-.52,.52])low=Math.min(low,at(s+a*w,lateral+x*d).y);
    base(b,w,d,foot,.48+b.y-low);
    box(b,0,(eaves+foot)/2,0,w,eaves-foot,d,plaster);
    // Face some eaves, not every gable, toward the road.
    if(was){
      const cross={...b,yaw:b.yaw+rad};
      emit(GABLE,cross,0,eaves,0,d,rise*.67,w,plaster);
      roof(cross,d,w,eaves,rise*.67,shade);
      for(const a of [-1,1]){
        box(b,a*(w*.5-.05),eaves-.24,0,.12,.46,d+.18,stone[3]);
        box(b,a*(w*.5-.05),eaves-.79,0,.115,.16,d+.10,stone[1]);
      }
    }else{
      emit(GABLE,b,0,eaves,0,w,rise,d,plaster);
      roof(b,w,d,eaves,rise,shade);
    }
    const plant=(px,py,pz)=>planter(b,px,py,pz,.93);
    if(inn){
      // A stepped attic bay breaks the main roof line and identifies the inn.
      const bay=offset(b,w*.25,0,-d*.5+.33),ww=3.50,dd=2.8,top=eaves+rise*.40,peak=1.47;
      box(bay,0,(eaves-1.01+top)*.5,0,ww,top-(eaves-1.01),dd,plaster);
      emit(GABLE,bay,0,top,0,ww,peak,dd,plaster);roof(bay,ww,dd,top,peak,shade);
      beam(bay,-1.71,top,0,top+peak,-1.47,.17);beam(bay,0,top+peak,1.71,top,-1.47,.17);
      beam(bay,-1.71,top,1.71,top,-1.47,.17);
      for(const a of [-1,1]){
        beam(bay,a*1.65,eaves-1.01,a*1.65,top,-1.47,.19);
        window(bay,a*.66,top-.73,-1.48,.71,.92,false,1,true);
        planter(bay,a*.66,top-1.32,-1.69,.79);
      }
    }
    // Frame all street-facing gables and wrap the posts / plate onto side wings.
    const f=-d*.5-.067,rim=w*.5-.075;
    if(!was){
      beam(b,-rim,eaves,0,eaves+rise,f);beam(b,0,eaves+rise,rim,eaves,f);
      beam(b,-rim,eaves,rim,eaves,f,.2);
      beam(b,0,eaves+.02,0,eaves+rise-.04,f,.17);
      beam(b,-rim*.66,eaves+rise*.30,rim*.66,eaves+rise*.30,f,.16);
      if(rise>2.4){
        beam(b,-rim*.26,eaves,-rim*.49,eaves+rise*.48,f,.105);
        beam(b,rim*.26,eaves,rim*.49,eaves+rise*.48,f,.105);
      }
      if(!sm)window(b,0,eaves+rise*.42,f-.04,.76,.87,false,1,inn);
    }else{
      for(let xx=-rim+.32;xx<rim;xx+=.52)box(b,xx,eaves-.105,f,.15,.13,.39,edgeWood);
    }
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
    if(eaves>4.6)for(const a of [-1,0,1]){
      window(b,a*w*.279,eaves-1.04,f-.064,.83,1.05,false,1,inn);
      if(!was&&a!==0&&r()>.33)plant(a*w*.279,eaves-1.69,f-.31);
    }
    if(!barn||inn){
      const x=w*.28,z=d*.23,y=eaves+rise*(was?.67:1)+(was?.67:1.1);
      box(b,x,(eaves+rise*.47+y)*.5,z,.79,y-(eaves+rise*.47),.76,stone[1]);
      box(b,x,y,z,.99,.16,.99,stone[3]);
      for(let j=0;j<4;j++)box(b,x-.406,y-.18-j*.25,z,.042,.028,.71,stone[3]);
    }
    if(inn||barn){
      const xp=inn?w*.095:w*.16,hp=inn?3.45:2.86,wp=inn?w*.73:w*.49;
      box(b,xp,hp,f-.66,wp,.14,1.19,shade,-.19);
      for(const a of [-1,1]){
        const sx=xp+a*(wp*.46);
        box(b,sx,hp*.50,f-1.18,.17,hp+.04,.19,timber);
        box(b,sx,.19,f-1.18,.30,.47,.30,stone[1]);
      }
      if(barn){
        // Cooper's service counter and staves; alternate active and closed facades.
        box(b,xp,1.20,f-.31,wp*.64,.20,.59,edgeWood);
        barrel(offset(b,xp+wp*.35,0,f-.82),.33,.81);
        if(w>7.4)barrel(offset(b,xp+wp*.51,0,f-.74),.30,.69);
      }
      if(inn){
        barrel(offset(b,w*.36,0,f-1.06),.31,.75);
        box(b,-w*.30,4.00,f-.43,.17,.16,.87,timber);
        box(b,-w*.30,3.63,f-.82,.63,.52,.1,'#8f5d40');
        post(b,-w*.30,3.64,f-.88,.145,.024,.145,'#c6a469',rad);
        box(b,-w*.30+.13,3.65,f-.89,.16,.055,.05,'#c6a469');
      }
    }
  }

  function offset(b,x=0,y=0,z=0){
    const c=Math.cos(b.yaw),s=Math.sin(b.yaw);
    return {x:b.x+c*x+s*z,y:b.y+y,z:b.z-s*x+c*z,yaw:b.yaw};
  }
  function planter(b,x,y,z,w){
    box(b,x,y,z,w,.21,.29,'#79583e');
    for(let i=0;i<6;i++){
      const xp=x+(i/5-.5)*w*.84;
      rock(b,xp,y+.11+r()*.08,z,.14,.15+r()*.12,.145,choose(['#526640','#6b7650','#4d623b'],r));
      if(r()>.39)rock(b,xp,y+.23+r()*.07,z,.064,.06,.065,choose(['#a45640','#af8b48','#c3a46c'],r));
    }
  }
  function barrel(b,radius=.33,h=.79){
    for(const [y,w,hh] of [[.21,.94,.37],[.49,1,.29],[.79,.93,.35]])
      post(b,0,y*h,0,radius*w,hh*h,radius*w,'#805839');
    for(const y of [.20,.69])post(b,0,y*h,0,radius*1.014,.068,radius*1.014,'#47473e');
    post(b,0,.99*h,0,radius*.86,.044,radius*.86,'#9c754d');
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
      const color=choose(['#59613e','#65704a','#697342','#515d43'],r);
      emit(LEAF,b,(r()-.5)*.28,.36+r()*.16,z,.57,.43+r()*.20,.61,color,r()*.4,r()*4,r()*.17);
      for(let j=0;j<3;j++)emit(LEAF,b,(r()-.5)*.65,.54+r()*.25,z+(r()-.5)*.7,.20+r()*.11,.20+r()*.09,.25,choose(['#687548','#738151','#767d4b'],r));
    }
  }

  function orchardTree(s,lateral,height){
    const b=attach(at,s,lateral),c=height*.57;
    post(b,0,c*.5,0,.12,c,.109,'#564939',-.02,0,.07);
    for(let u=0;u<6;u++){
      const a=u*2.399,rr=(.30+r()*.28)*height*.52,x=Math.cos(a)*rr,z=Math.sin(a)*rr;
      const y=height*(.50+r()*.28);
      post(b,x*.37,(y+c*.64)*.5,z*.40,.058,Math.hypot(y-c*.64,x,z),.058,'#5f513d',0,b.yaw*.19,-Math.atan2(x,y-c*.64));
      for(let i=0;i<5;i++){
        const dx=(r()-.5)*height*.38,dz=(r()-.5)*height*.33;
        const up=(i===4?.17:.03+r()*.09)*height;
        emit(LEAF,b,x+dx,y+up,z+dz,height*(.17+r()*.06),height*(.14+r()*.05),height*(.16+r()*.052),
          choose(['#536144','#64724e','#768052','#5d6f4b','#6e7549'],r),r(),r()*5,r());
      }
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
    box(b,0,high+.15,0,8.65,.075,.33,edgeWood);
    for(const a of [-1,1]){
      box(b,a*3.91,high-.35,0,1.27,.14,.22,edgeWood,0,0,a*.49);
      for(const z of [-.15,.15])post(b,a*3.85,high,z,.073,.044,.073,'#8e7754',rad);
    }
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

  function belfry(s,lateral){
    // Roadside way chapel with a weathered stone bell tower. Open bell
    // apertures and a bronze silhouette read before the viewer reaches town.
    const b=attach(at,s,lateral,-.18),w=4.28,d=4.22;
    const belf=6.62,top=9.36;
    base(b,w+.35,d+.25,1.25,1.32);
    box(b,0,3.25,0,w,6.71,d,stone[2]);
    for(const face of [-1,1]){
      for(let row=0;row<13;row++){
        for(let j=0;j<5;j++){
          const x=(j-2)*.824+((row%2&&j>0&&j<4)?.22:0);
          const y=1.49+row*.395,z=face*(d*.5+.029);
          box(b,x,y,z,.72+r()*.092,.31+r()*.04,.082,choose(stone,r));
          if(j===0||j===4)box(b,face*(w*.5+.022),y,(j-2)*.91,.078,.33,1.04,choose(stone,r));
        }
      }
      box(b,0,belf-.13,face*d*.5,w+.22,.24,.25,stone[3]);
      box(b,face*w*.5,belf-.13,0,.25,.24,d+.20,stone[3]);
      for(const right of [-1,1]){
        box(b,right*(w*.5-.32),(belf+top)*.5,face*(d*.5-.31),.64,top-belf,.63,stone[1]);
        box(b,right*(w*.5-.32),top-.50,face*(d*.5-.31),.85,.2,.86,stone[3]);
      }
      box(b,0,top-.34,face*(d*.5-.13),w,.75,.55,stone[1]);
      box(b,face*(w*.5-.13),top-.34,0,.55,.75,d,stone[1]);
      box(b,0,belf+.25,face*(d*.5-.12),w,.60,.46,stone[2]);
      box(b,face*(w*.5-.12),belf+.25,0,.46,.60,d,stone[2]);
      box(b,0,3.93,face*(d*.5+.045),.38,1.34,.15,stone[3]);
      box(b,0,3.95,face*(d*.5+.135),.17,1.07,.077,'#33352d');
      for(const a of [-1,1])box(b,a*1.53,1.60,face*(d*.5+.08),.56,3.18,.27,stone[1]);
    }
    box(b,0,8.67,0,3.5,.20,.25,timber);
    post(b,0,7.64,0,.56,.25,.56,'#94734b');
    emit(CONE,b,0,7.99,0,.55,.70,.55,'#80633d');
    post(b,0,7.48,0,.09,.28,.09,'#a48152');
    box(b,0,top+.045,0,w+.54,.14,d+.56,stone[3]);
    emit(CONE,b,0,top+1.20,0,2.88,2.57,2.85,'#514c46',0,.39);
    for(let i=0;i<6;i++){
      const rad0=2.86-i*.43;
      emit(CONE,b,0,top+.18+i*.37,0,rad0,.46,rad0,'#554e45',0,.39);
    }
    post(b,0,top+2.68,0,.065,.51,.065,'#806346');
    rock(b,0,top+2.87,0,.20,.20,.20,'#9c8352');
    // The stone nave is a low, long silhouette alongside the bell tower.
    const nave=offset(b,-4.65,0,.52);
    base(nave,5.92,5.46,1.17,.76);
    box(nave,0,2.05,0,5.92,3.14,5.43,stone[2]);
    emit(GABLE,nave,0,3.62,0,5.92,2.58,5.43,stone[2]);roof(nave,5.92,5.43,3.62,2.58,'#58544e');
    for(const a of [-1,1]){
      box(nave,a*1.47,2.23,-2.73,.68,1.65,.14,stone[3]);
      box(nave,a*1.47,2.22,-2.82,.40,1.32,.072,'#514d39');
      box(nave,a*1.47,3.00,-2.81,.30,.23,.089,stone[3],0,0,.78);
    }
  }

  function market(s,lateral,turn,cloth){
    const b=attach(at,s,lateral,Math.sign(lateral)*Math.PI/2+turn),w=3.05,d=1.54;
    for(const a of [-1,1])for(const z of [-1,1]){
      const yy=z>0?2.70:2.36;
      box(b,a*w*.49,yy*.50,z*d*.44,.13,yy,.14,timber);
      box(b,a*w*.49,.14,z*d*.44,.20,.29,.22,stone[2]);
    }
    for(const z of [-1,1])box(b,0,z>0?2.70:2.36,z*d*.49,w+.26,.118,.104,edgeWood);
    const paint=cloth?'#765045':'#647564',linen='#bdac82',n=9;
    for(let i=0;i<n;i++){
      const px=(i+.5-n*.5)*w/n;
      box(b,px,2.535,0,w/n+.012,.044,d+.38,i%3===0?linen:paint,-.195);
      box(b,px,2.32,-d*.57,w/n+.01,.23,.05,i%3===0?linen:paint,0,0,(r()-.5)*.035);
    }
    box(b,.16,.93,-.28,2.59,.14,.78,'#947452');
    for(const a of [-1,1])box(b,.16+a*1.06,.46,-.28,.105,.92,.38,edgeWood);
    for(let m=0;m<3;m++){
      const tx=(m-1)*.75+.08;
      box(b,tx,1.04,-.32,.61,.12,.54,'#674f39');
      for(let k=0;k<8;k++)rock(b,tx+(r()-.5)*.47,1.13+r()*.11,-.32+(r()-.5)*.36,.065,.069,.067,
        cloth?choose(['#a66a48','#ad854b','#a14f42'],r):choose(['#798457','#91945e','#ac975b'],r));
    }
    barrel(offset(b,w*.60,0,.33),.30,.69);
    for(const [xx,zz] of [[-1.86,.26],[-1.64,.74]])box(b,xx,.225,zz,.53,.45,.51,'#8d6b45');
  }

  // Choreography down a narrow connected street: outer gate and pasture wall,
  // first tight row, pocket market/well with a landmark inn, then crofts.
  // Building frontage intervals intentionally abut but don't overlap.
  const houses=[
    [34,-13.4,5.5,5.9,4.15,'cottage',.08],
    [44,7.74,7.6,6.1,4.57,'workshop',-.067],[53,7.88,7.4,6.1,5.36,'home',.024],
    [64,9.37,10.0,7.5,5.12,'stone',-.025],[75,7.91,7.6,6.0,5.62,'home',.062],
    [46,-8.30,7.6,7.0,4.92,'stone',.077],[59,-10.04,8.1,6.5,4.50,'cottage',-.039],
    [71,-8.28,9.6,7.1,5.19,'workshop',-.025],
    [88,8.73,7.2,6.2,4.71,'cottage',.091],[104,9.89,11.6,8.4,6.36,'inn',.04],
    [117,8.71,8.2,7.3,5.02,'stone',-.032],[129,9.60,8.1,7.2,5.41,'home',-.011],
    [86,-11.31,7.3,6.2,4.33,'cottage',.04],[99,-15.05,8.3,7.1,4.63,'workshop',.11],
    [111,-8.47,7.8,6.4,5.52,'home',-.01],[123,-9.01,8.6,6.7,4.91,'stone',.06],
    [132,-8.81,8.3,7.3,5.39,'home',.012],[145,-9.15,7.1,6.3,4.64,'cottage',-.06],
    [148,10.10,7.6,6.3,4.22,'workshop',.11],[164,10.97,6.8,5.8,3.98,'cottage',-.14]
  ];
  for(const h of houses)if(located(h[0]))house(...h);
  for(const [s,x,len,h] of [[8,-4.1,8.5,.72],[17,-4.2,8.2,.74],[14,4.55,12,.76],[31,5.20,9.2,.83],
    [83,4.87,5.1,.69],[102,-9.85,5.2,.44],[137,4.25,10,.72],[143,4.32,6,.74],
    [157,-4.5,9.2,.78],[168,-4.55,10.2,.74],[179,-4.91,9.2,.62],[171,5.85,12,.64]])
    if(located(s))wall(s,x,len,h);
  for(const [s,x,len] of [[11,-5.52,12],[12,5.55,17],[34,6.1,3.1],[137,5.39,6],[171,-5.72,13],[180,6.8,12]])
    if(located(s))hedge(s,x,len);
  for(const [s,x,h] of [[10,11.8,3.98],[17,21.3,4.85],[20,-15.2,4.71],[37,17.7,3.95],
    [82,-15.85,4.24],[106,-13.2,3.92],[141,11.45,4.01],[155,-14.0,3.56],[177,-9.85,3.92],[185,12.1,3.47]])
    if(located(s))orchardTree(s,x,h);
  if(located(24))gateway(24);
  if(located(29.7))belfry(29.7,12.25);
  if(located(97.5))well(97.5,-8.20);
  if(located(82))market(82,5.29,.28,true);
  if(located(92.65))market(92.65,-6.88,.1,true);
  if(located(102.7))market(102.7,-7.02,-.12,false);
  square(97.3,-4.25);
  square(84.6,4.42);

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
