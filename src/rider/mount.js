import * as T from 'three';
import {meadowWind} from '../world/route.js';
import {createMane,neckProfile} from './mane.js';
import {createQuarters,barrelSection,chestFront} from './quarters.js';
import {createTail} from './tail.js';
import {createStride} from './stride.js';
import {coatPanel,scarf,dressedLimb,rein,ridingArm} from './tack.js';

const TAU=2*Math.PI, clamp=T.MathUtils.clamp;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function fabric(){
  const c=document.createElement('canvas');c.width=256;c.height=256;const b=c.getContext('2d');
  b.fillStyle='#185a5c';b.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=3){b.fillStyle=y%2?'#ffffff0b':'#001c2422';b.fillRect(0,y,256,1);}
  for(let x=0;x<256;x+=4){b.fillStyle='#f3e2b008';b.fillRect(x,0,1,256);}
  function band(y){b.fillStyle='#c87949';b.fillRect(0,y,256,2);b.fillStyle='#d7b773';b.fillRect(0,y+4,256,2);
    b.strokeStyle='#cba66d';b.lineWidth=2;for(let x=-8;x<264;x+=16){b.beginPath();b.moveTo(x,y+14);b.lineTo(x+8,y+7);b.lineTo(x+16,y+14);b.lineTo(x+8,y+20);b.closePath();b.stroke();}}
  band(5);band(228);
  for(let j=0;j<3;j++)for(let i=0;i<4;i++){
    const x=24+64*i+(j%2)*22,y=61+j*63;b.strokeStyle='#89a081';b.lineWidth=2;b.beginPath();b.moveTo(x-6,y+5);b.lineTo(x,y-4);b.lineTo(x+6,y+5);b.stroke();
  }
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;return map;
}
function material(color,opts={}){return new T.MeshStandardMaterial({color,roughness:.87,...opts});}
const ball=new T.SphereGeometry(1,16,12);
function mesh(parent,geo,mat){const o=new T.Mesh(geo,mat);parent.add(o);return o;}
function oval(parent,mat,x,y,z,rx,ry,rz){
  const o=mesh(parent,ball,mat);o.position.set(x,y,z);o.scale.set(rx,ry,rz);return o;
}
function line(parent,mat,pts,r){
  const curve=new T.CatmullRomCurve3(pts.map(p=>V(...p)));
  return mesh(parent,new T.TubeGeometry(curve,Math.max(6,pts.length*4),r,6,false),mat);
}
function skin(parent,mat,rings,vertical=false){
  const pos=[],uv=[],index=[],n=28;
  const spine=new T.CatmullRomCurve3(rings.map(([y,z])=>V(0,y,z)),false,'catmullrom',.36);
  const widths=new T.CatmullRomCurve3(rings.map((r,i)=>V(i,r[2],r[3])),false,'catmullrom',.35);
  rings=Array.from({length:3*(rings.length-1)+1},(_,i)=>{
    const q=i/(3*(rings.length-1)),c=spine.getPoint(q),w=widths.getPoint(q);return [c.y,c.z,w.y,w.z];
  });
  // Each section carries its own centre, allowing the spine and muzzle to curve.
  for(let i=0;i<rings.length;i++){
    const [y,z,rx,r2]=rings[i];
    for(let j=0;j<=n;j++){
      const a=j/n*TAU,x=rx*Math.cos(a),b=r2*Math.sin(a);
      pos.push(x,y+(vertical?0:b),z+(vertical?b:0));uv.push(j/n,i/(rings.length-1));
      if(i&&j){const k=i*(n+1)+j;index.push(k-1,k-n-2,k-n-1,k-1,k-n-1,k);}
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.computeVertexNormals();
  // Normalize winding for sections built along either axis.
  const norm=geo.attributes.normal;if(norm.getX(n+1)<0){for(let i=0;i<index.length;i+=3)[index[i],index[i+1]]=[index[i+1],index[i]];geo.setIndex(index);geo.computeVertexNormals();}
  return mesh(parent,geo,mat);
}
function ear(parent,hide,dark,side){
  const flap=new T.Group();parent.add(flap);flap.position.set(side*.102,.842,-.482);flap.rotation.set(-.22,side*.23,-side*.18);
  skin(flap,hide,[[0,0,.042,.040],[.055,.006,.051,.040],[.13,.015,.040,.030],[.194,.023,.016,.017],[.213,.024,.003,.005]],true);
  const inset=oval(flap,dark,0,.107,-.019,.027,.072,.010);inset.rotation.x=.14;return flap;
}
function furMat(){
  const m=material('#9c5837');m.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec3 hidePoint;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhidePoint=position;');
    sh.fragmentShader='varying vec3 hidePoint;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 p=hidePoint;float strand=sin(p.x*684.+p.y*613.+sin(p.z*27.+p.y*12.)*3.);
float gloss=.90+.13*smoothstep(-.27,.24,p.y-1.45)+.038*strand*(1.-smoothstep(.5,2.,fwidth(p.x*684.+p.y*613.)));
float flank=smoothstep(.04,.56,p.z)*smoothstep(1.26,1.63,p.y);
vec3 cell=p*vec3(27.,18.,18.);cell.z+=sin(p.y*13.)*.7;cell.y+=sin(p.z*11.)*.6;
vec2 hairs=cell.xy+cell.z*.45;vec2 jitter=vec2(sin(dot(floor(hairs),vec2(13.2,3.8))),cos(dot(floor(hairs),vec2(5.9,7.3))))*.19;
float dapple=1.-smoothstep(.06,.46,length(fract(hairs)-.5-jitter));
float brush=sin(p.y*174.+sin(p.z*29.)*2.)*.5+.5;
diffuseColor.rgb*=gloss*(1.+flank*(dapple*.075+brush*.03));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.071,.037),.26*smoothstep(.19,.46,p.z)*(1.-smoothstep(1.10,1.45,p.y)));
#ifdef USE_COLOR
// A broken saddle of roan hairs on the croup, in rest coordinates, follows
// the skin through stifle flexion. Keep the dark leg points below it.
float ripple=.055*sin(17.*p.z+5.*p.x)+.036*sin(29.*p.y-13.*p.z)+.018*sin(42.*p.x+23.*p.y);
float swirl=sin(7.8*p.z-11.5*p.x+4.5*p.y)+.58*sin(14.*p.z+8.3*p.x+2.2*sin(9.3*p.y))+.28*sin(27.*p.y-18.*p.x+2.*sin(11.*p.z));
float saddle=smoothstep(.29,.53,p.z+ripple+.16*p.x)*smoothstep(1.34,1.55,p.y+.115*swirl+.12*p.x);
float bloom=smoothstep(-.95,.72,swirl+.14*sin(62.*p.z)*sin(63.*p.y));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.64,.49,.34)*(.90+.06*brush),saddle*(.37+.46*bloom));
#endif`);
  };return m;
}
function saddleCloth(body,mat){
  const p=[],uv=[],idx=[],rows=20,cols=26;
  for(let j=0;j<=rows;j++){
    const t=j/rows,z=-.34+.81*t,[cy,rx,top,bottom]=barrelSection(z);
    const sweep=1.68+.40*Math.sin(Math.PI*t)**.68;
    for(let k=0;k<=cols;k++){
      const u=k/cols,theta=(2*u-1)*sweep,c=Math.cos(theta),a=Math.sin(theta);
      const x=Math.sign(a)*Math.abs(a)**.86*(rx+.034+.036*t*t*Math.abs(a));
      const y=cy+Math.sign(c)*Math.abs(c)**.86*((c>0?top:bottom)+.016);
      p.push(x,y,z);uv.push(t,u);
      const n=j*(cols+1)+k;
      if(j&&k)idx.push(n-cols-2,n-1,n,n-cols-2,n,n-cols-1);
    }
  }
  const g=new T.BufferGeometry();g.setIndex(idx);g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();mesh(body,g,mat);
}

function travelHat(head,straw,binding){
  const rings=[[.012,.145],[.068,.135],[.131,.087],[.187,.049],[.261,.012],[.293,-.002],[.292,-.011],[.22,.016],[.111,.070]];
  const p=[],uv=[],idx=[],count=64;
  for(let j=0;j<rings.length;j++)for(let i=0;i<=count;i++){
    const [r,h]=rings[j],a=i/count*TAU;
    p.push(r*Math.cos(a),2.792+h+r*r*(.15*Math.sin(3*a)-.18*Math.sin(a)),-.035+r*Math.sin(a)*1.06);
    uv.push(i/count,r/.295);const n=j*(count+1)+i;
    if(i&&j)idx.push(n-1,n-count-2,n,n,n-count-2,n-count-1);
  }
  const g=new T.BufferGeometry();g.setIndex(idx);g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();mesh(head,g,straw);
  for(const side of [-1,1])line(head,binding,[[side*.146,2.814,-.04],[side*.128,2.666,-.060],[side*.069,2.56,-.092],[0,2.55,-.108]],.005);
}
// A chain of damped angular springs makes the response propagate from the attachment to the tip.
function ribbon(parent,mat,anchor,width,length,drop,flutter,seed,flare=0){
  const rows=10,cols=6,pos=new Float32Array((rows+1)*(cols+1)*3),uv=[],idx=[];
  const angle=new Float32Array(rows+1),velocity=new Float32Array(rows+1);
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    uv.push(i/cols,1-j/rows);const a=j*(cols+1)+i;
    if(j<rows&&i<cols)idx.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);
  }
  const g=new T.BufferGeometry(),attr=new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage);
  g.setAttribute('position',attr);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
  const o=mesh(parent,g,mat);o.frustumCulled=false;o.position.copy(anchor);
  return (t,dt,speed,turn,impulse)=>{
    const h=Math.min(dt,.033),lead=(.10+.09*Math.sin(t*1.7))*(.5+speed/10)-turn*.15+.11*impulse;
    let x=0;
    for(let j=0;j<=rows;j++){
      const q=j/rows,goal=(j?angle[j-1]:lead)+flutter*(.22*Math.sin(t*3.1+seed-q*2.8)+.13*Math.sin(t*6+seed+q));
      velocity[j]+=((goal-angle[j])*79-velocity[j]*9.8)*h;angle[j]+=velocity[j]*h;x+=Math.sin(angle[j])*length/rows;
      for(let i=0;i<=cols;i++){
        const u=i/cols-.5,fold=Math.cos(u*Math.PI*5+q*1.7+seed)*q*.035;
        attr.setXYZ(j*(cols+1)+i,x+u*width*(1+flare*q),-drop*q+fold+(q*q*.036*Math.sin(t*5.6+u*5.8-q*7.1+seed))+q*q*(.045*Math.sin(t*3+seed-q*4)+speed*.011+.063*impulse)-Math.abs(u)*.11*width,
          length*Math.pow(q,1.32)+q*q*(speed*.015+impulse*.054)+fold*.65-Math.abs(u)*.10*width);
      }
    }
    attr.needsUpdate=true;g.computeVertexNormals();
  };
}
// Tapered round locks keep their volume when the player orbits behind the horse.
function horsehair(parent,mat,anchor,length,drop,width,seed){
  const rings=9,sides=7,p=new Float32Array((rings+1)*sides*3),indices=[],vel=new Float32Array(rings+1),bend=new Float32Array(rings+1),lift=new Float32Array(rings+1),liftV=new Float32Array(rings+1);
  for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){
    const a=j*sides+k,b=j*sides+(k+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);
  }
  const g=new T.BufferGeometry(),attr=new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage);g.setAttribute('position',attr);g.setIndex(indices);
  const lock=mesh(parent,g,mat);lock.position.copy(anchor);lock.frustumCulled=false;
  return (t,dt,speed,turn,kick)=>{
    const h=dt;let x=0;
    for(let j=0;j<=rings;j++){
      const q=j/rings,goal=(j?bend[j-1]:.11*Math.sin(t*2.7+seed))+.08*Math.sin(t*3+seed-q*3)-turn*.03;
      vel[j]+=((goal-bend[j])*90-vel[j]*10)*h;bend[j]+=vel[j]*h;x+=bend[j]*drop/rings;
      const aim=(j?lift[j-1]*.77:0)+(.14+speed*.035+.24*kick+.08*Math.sin(t*5.3+seed-q*3))*(j?.23:1);
      liftV[j]+=((aim-lift[j])*135-liftV[j]*12)*h;lift[j]+=liftV[j]*h;
      const radius=width*(1-q*.976)*(.88+.62*Math.sin(Math.PI*q));
      for(let k=0;k<sides;k++){
        const a=k/sides*TAU;
        const swept=q*q*lift[j],wave=Math.sin(t*5.7+seed-q*5);
        attr.setXYZ(j*sides+k,x+radius*Math.cos(a),
          -drop*q+swept*.22+.009*q*q*wave+.30*radius*Math.sin(a),
          length*(1-Math.exp(-q*2.6))+.009*Math.sin(q*4+seed)*q+swept*.38+radius*Math.sin(a));
      }
    }attr.needsUpdate=true;g.computeVertexNormals();
  };
}
export function createMount(floating=true){
  const root=new T.Group(),body=new T.Group(),rider=new T.Group(),neck=new T.Group();root.add(body);body.add(neck);
  const seat=new T.Group(),chest=new T.Group(),lap=new T.Group();
  body.add(seat);seat.add(chest,lap);chest.add(rider);rider.position.y=lap.position.y=-1.91;
  const headPivot=new T.Group(),headArt=new T.Group();
  headPivot.position.set(0,2.526,-.05);headArt.position.copy(headPivot.position).negate();
  rider.add(headPivot);headPivot.add(headArt);
  const limbs=[],flow=[],coat=[];
  const hide=furMat(),dark=material('#392e2a'),hoof=material('#453d36'),eye=material('#181d19',{roughness:.23}),leather=material('#75452c'),trim=material('#d0a05a',{metalness:.32}),cream=material('#decba3'),hair=material('#292c31'),skinTone=material('#b78260'),shirt=material('#295d61'),boots=material('#433631'),red=material('#963f34');
  const weave=material('#ffffff',{map:fabric(),side:T.DoubleSide}),cape=weave;
  const strands=['#332925','#5e4232','#714e36','#44332c'].map(c=>material(c,{side:T.DoubleSide}));
  const flexQuarters=createQuarters(body,hide),tail=createTail(body);
  neck.position.set(0,1.53,-.55);
  skin(neck,hide,neckProfile,true);
  const mane=createMane(neck);
  const faceHide=material('#955a39');
  faceHide.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec3 facePoint;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n facePoint=position;');
    sh.fragmentShader='varying vec3 facePoint;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 p=facePoint;
float nose=1.-smoothstep(-1.035,-.90,p.z+.025*sin(p.y*32.));
float brow=p.y-.73-.76*(p.z+.69);
float stripe=abs(p.x+.008*sin(18.*p.z))-.019-.034*exp(-pow((p.z+.69)*11.,2.));
float blaze=(1.-smoothstep(-.004,.009,stripe+.005*sin(87.*p.y+31.*p.x)))*smoothstep(.037,.088,brow)*smoothstep(-1.04,-.985,p.z);
diffuseColor.rgb=mix(mix(diffuseColor.rgb,vec3(.093,.071,.060),nose*.87),vec3(.76,.65,.47),blaze*.94);`);
  };
  skin(neck,faceHide,[[.536,-1.084,.016,.023],[.539,-1.068,.081,.061],[.549,-1.021,.114,.082],
    [.565,-.965,.118,.090],[.61,-.873,.115,.111],[.661,-.787,.129,.135],
    [.703,-.702,.159,.170],[.715,-.614,.174,.190],[.704,-.542,.165,.187],[.724,-.441,.095,.129]]);
  const ears=[];
  for(const a of [-1,1]){
    ears.push(ear(neck,hide,dark,a));
    line(neck,dark,[[a*.066,.505,-1.065],[a*.101,.497,-1.020],[a*.109,.504,-.982],[a*.112,.523,-.946]],.004);
    const eyelid=oval(neck,dark,a*.147,.758,-.724,.022,.020,.043);eyelid.rotation.x=-.23;
    const iris=oval(neck,eye,a*.161,.759,-.729,.011,.015,.025);iris.rotation.x=-.23;
    oval(neck,cream,a*.172,.765,-.738,.003,.004,.005);
    line(neck,leather,[[a*.149,.761,-.765],[a*.158,.782,-.737],[a*.155,.784,-.713],[a*.154,.771,-.69]],.008);
    const nostril=oval(neck,dark,a*.096,.560,-1.039,.013,.017,.028);nostril.rotation.set(-.28,a*.56,0);
    line(neck,leather,[[a*.076,.569,-1.062],[a*.096,.580,-1.04],[a*.106,.571,-1.021]],.005);
    line(neck,leather,[[a*.115,.91,-.49],[a*.169,.78,-.59],[a*.157,.65,-.75],[a*.132,.52,-.92]],.016);
    line(neck,trim,[[a*.125,.62,-.948],[a*.092,.636,-.976],[0,.65,-.984]],.013);
    const ring=mesh(neck,new T.TorusGeometry(.030,.006,7,18),trim);
    ring.rotation.y=Math.PI*.5;ring.position.set(a*.149,.533,-.915);

  }
  // Noseband and browband follow the changing facial section and meet the cheekpieces.
  for(const [z,y,rx,ry] of [[-.933,.589,.123,.104],[-.654,.719,.174,.185]]){
    const path=Array.from({length:13},(_,i)=>{
      const a=(i/12-.5)*Math.PI*1.12;
      return [Math.sin(a)*rx,y+Math.cos(a)*ry,z-.007*Math.cos(a)];
    });
    line(neck,leather,path,.012);
    line(neck,cream,path.map(([x,y,z])=>[x,y+.004,z-.009]),.003);
  }
  const fringe=new T.Group();neck.add(fringe);fringe.position.set(0,.872,-.526);
  for(let i=-3;i<=3;i++){
    const x=i*.015,dz=.027*Math.cos(i*1.7);
    const lock=skin(fringe,strands[(i+4)%4],[[.005,.017,.015,.016],[.033,-.055,.022,.014],[.032,-.117,.026,.013],
      [.014,-.166,.023,.012],[-.009,-.203,.015,.010],[-.043+dz,-.246+dz,.003,.004]]);
    lock.position.x=x;lock.rotation.y=.13+i*.068;
  }
  // Saddle blanket wraps the barrel, embroidered panels hang over the flanks.
  saddleCloth(body,weave);
  oval(body,leather,0,1.875,-.035,.285,.115,.315);oval(body,leather,0,1.93,.225,.27,.12,.084);
  for(const a of [-1,1]){
    oval(body,leather,a*.295,1.61,.39,.121,.155,.132);
    line(body,trim,[[a*.394,1.70,.46],[a*.413,1.63,.406],[a*.382,1.53,.365]],.014);
  }
  // Rider in a cross-collar coat, sash, bound boots and a pinned topknot.
  skin(rider,shirt,[[1.85,.00,.16,.13],[1.99,.009,.21,.144],[2.15,-.009,.168,.124],[2.40,-.044,.216,.135],[2.49,-.05,.196,.104],[2.52,-.048,.10,.092]],true);
  oval(rider,red,0,2.075,0,.187,.066,.146);
  line(rider,cream,[[-.09,2.51,-.13],[.035,2.41,-.178],[.15,2.29,-.127]],.014);
  oval(rider,skinTone,0,2.535,-.053,.077,.103,.072);
  skin(headArt,skinTone,[[2.52,-.086,.050,.057],[2.561,-.087,.088,.088],[2.62,-.072,.122,.106],[2.695,-.058,.132,.12],[2.77,-.047,.121,.11],[2.80,-.041,.089,.076]],true);
  oval(headArt,skinTone,0,2.646,-.173,.032,.036,.036);
  // Lower the hairline at the nape but leave the eyes and temples uncovered.
  skin(headArt,hair,[[2.66,.047,.081,.064],[2.704,.026,.132,.105],[2.735,-.020,.141,.139],
    [2.766,-.041,.137,.132],[2.811,-.031,.118,.110],[2.853,.006,.058,.071]],true);
  const straw=material('#b48a52',{side:T.DoubleSide});
  straw.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec2 cane;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n cane=uv;');
    sh.fragmentShader='varying vec2 cane;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float ring=cane.y*40.,weft=cane.x*120.;
float basket=sin(6.283*ring+sin(6.283*weft)*.53)*(1.-smoothstep(.17,.50,fwidth(ring)));
float spoke=cos(6.283*weft)*(1.-smoothstep(.15,.50,fwidth(weft)));
diffuseColor.rgb*=.96+.104*basket+.073*spoke;
diffuseColor.rgb*=1.-.54*smoothstep(.965,.985,cane.y)-.23*(1.-smoothstep(.010,.023,abs(cane.y-.47)));`);
  };
  travelHat(headArt,straw,leather);
  const lips=material('#925344'),irisBrown=material('#493629');
  for(const side of [-1,1]){
    const lock=oval(headArt,hair,side*.108,2.688,-.095,.027,.076,.039);lock.rotation.z=-side*.22;
    const sclera=oval(headArt,cream,side*.056,2.681,-.159,.032,.011,.009);sclera.rotation.y=-side*.51;
    oval(headArt,irisBrown,side*.056,2.683,-.167,.014,.010,.005);
    line(headArt,hair,[[side*.025,2.685,-.174],[side*.054,2.694,-.165],[side*.087,2.691,-.148]],.004);
    line(headArt,hair,[[side*.030,2.709,-.162],[side*.059,2.717,-.153],[side*.087,2.711,-.14]],.006);
  }
  line(headArt,lips,[[-.029,2.606,-.174],[-.010,2.604,-.178],[.009,2.604,-.179],[.029,2.607,-.174]],.005);
  // A broad lapel, indigo undercollar and bound cuffs read at riding distance.
  const collar=material('#34505b'),braid=material('#d6b780'),bracer=material('#47676b');
  const lapel=[[-.102,2.487,-.119],[-.060,2.443,-.170],[.014,2.37,-.178],[.096,2.288,-.145],[.142,2.207,-.094]];
  line(rider,collar,lapel,.026);line(rider,braid,lapel.map(([x,y,z])=>[x+.015,y,z-.022]),.007);
  line(rider,leather,[[.157,2.466,-.123],[.076,2.362,-.173],[-.009,2.266,-.164],[-.127,2.100,-.098]],.019);
  const bag=new T.Group();rider.add(bag);bag.position.set(-.082,2.234,.197);bag.rotation.set(-.13,-.14,-.16);
  skin(bag,leather,[[-.108,0,.093,.038],[-.082,0,.132,.057],[.008,.004,.144,.063],
    [.078,.002,.137,.056],[.100,.002,.123,.038]],true);
  // Closed flap overlaps the pouch body, pointed in the middle with two brass studs.
  const flapPoints=[[-.134,.075,.036],[-.093,.101,.050],[.091,.098,.055],[.135,.068,.041],
    [.116,-.007,.061],[.018,-.059,.071],[-.103,-.018,.065]];
  const fp=[0,.028,.077,...flapPoints.flat()],fi=[];
  for(let i=0;i<flapPoints.length;i++)fi.push(0,i+1,1+(i+1)%flapPoints.length);
  const flapGeo=new T.BufferGeometry();flapGeo.setIndex(fi);flapGeo.setAttribute('position',new T.Float32BufferAttribute(fp,3));flapGeo.computeVertexNormals();
  mesh(bag,flapGeo,material('#875331',{side:T.DoubleSide}));line(bag,braid,[...flapPoints,flapPoints[0]],.0036);
  for(const a of [-1,1])oval(bag,trim,a*.072,-.002,.071,.009,.009,.005);
  line(rider,leather,[[.16,2.456,-.089],[.16,2.502,-.032],[.146,2.469,.048],[.078,2.397,.147],[-.015,2.332,.188],[-.105,2.284,.224]],.020);
  oval(rider,trim,-.124,2.093,-.115,.041,.028,.010);
  bracer.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec2 sleeveUV;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n sleeveUV=uv;');
    sh.fragmentShader='varying vec2 sleeveUV;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float br=smoothstep(.44,.49,sleeveUV.y);
float cord=br*(1.-smoothstep(.018,.068,abs(fract(sleeveUV.y*5.5+sleeveUV.x)-.5)));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.115,.057,.038),br);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.45,.29,.13),cord*.79);`);
  };
  const reinLeather=material('#775137',{vertexColors:true,roughness:.66});
  for(const a of [-1,1]){
    oval(headArt,skinTone,a*.133,2.668,-.035,.023,.035,.021);
    line(headArt,hair,[[a*.126,2.753,-.089],[a*.115,2.706,-.149],[a*.109,2.665,-.143]],.013);

    oval(headArt,trim,a*.135,2.628,-.037,.012,.022,.011);
    const palm=new T.Group();body.add(palm);
    oval(palm,skinTone,0,0,-.041,.035,.044,.050);
    for(let j=0;j<4;j++){
      const finger=oval(palm,skinTone,-a*.015,.024-j*.016,-.069+j*.003,.025,.010,.021);
      finger.rotation.z=-a*.18;
    }
    const thumb=oval(palm,skinTone,-a*.027,.022,-.054,.016,.015,.033);thumb.rotation.y=a*.49;
    const cuff=oval(body,cream,0,0,0,.052,.053,.034);cuff.frustumCulled=false;
    oval(body,boots,a*.355,1.24,-.18,.078,.062,.146);
    line(body,trim,[[a*.306,1.32,-.14],[a*.315,1.185,-.18],[a*.407,1.185,-.18],[a*.411,1.319,-.14]],.013);
    limbs.push({a,arm:ridingArm(a,dressedLimb(body,shirt,.084,.089),dressedLimb(body,bracer,.064,.068),cuff,palm,rein(body,reinLeather,a)),
      thigh:dressedLimb(body,dark,.095,.105),shin:dressedLimb(body,boots,.068,.073)});
  }
  const mantle=new T.Group();
  rider.add(mantle);mantle.position.set(0,2.473,.047);
  const cloth=[ribbon(mantle,cape,V(0,0,0),.39,.51,.64,.39,.82,1.12)];
  oval(mantle,red,.089,.035,.047,.043,.027,.039);
  const streamScarf=scarf(mantle,material('#b9513e',{side:T.DoubleSide,vertexColors:true}));
  oval(rider,red,0,2.502,-.046,.131,.049,.111);
  for(const a of [-1,1]){
    const breast=[];
    for(let k=0;k<=12;k++){
      const u=k/12,x=a*.372*Math.sin(u*Math.PI*.5),y=1.335+.33*u*u;
      breast.push([x,y,chestFront(x,y)-.021]);
    }
    line(body,red,breast,.023);
    line(body,leather,breast.map(([x,y,z])=>[x,y+.012,z-.013]),.008);
    for(const k of [3,6,9]){const [x,y,z]=breast[k];oval(body,trim,x,y,z-.020,.012,.016,.008);}
    oval(neck,trim,a*.167,.721,-.695,.010,.017,.019);
    cloth.push(horsehair(neck,red,V(a*.159,.713,-.69),.037,.132,.021,3+a));
  }
  oval(body,trim,0,1.327,chestFront(0,1.335)-.047,.035,.046,.014);
  // A rolled felt blanket, leather keepers and a knotted waist cord sit behind the saddle.
  oval(body,cream,0,1.76,.37,.355,.082,.083);
  for(const a of [-1,1]){
    const x=a*.197;line(body,leather,[[x,1.70,.423],[x,1.77,.454],[x,1.841,.385],[x,1.829,.321]],.019);
    line(body,trim,[[a*.369,1.55,-.206],[a*.401,1.49,-.153],[a*.405,1.46,-.13]],.009);
    line(body,leather,[[a*.382,1.43,-.152],[a*.40,1.40,-.135],[a*.392,1.37,-.106]],.014);
    oval(rider,shirt,a*.185,2.395,-.025,.095,.11,.112);
    coat.push(coatPanel(lap,weave,a));
  }
  oval(rider,weave,0,2.446,.042,.213,.084,.141);
  line(rider,red,[[-.135,2.069,.098],[0,2.051,.154],[.148,2.075,.100]],.025);
  const gait=createStride(root,floating);
  // Batch rigid pieces that share a material and a joint. Streaming hair and cloth retain their own buffers.
  for(const joint of [body,neck,rider,headArt]){
    const batches=new Map();
    for(const piece of joint.children){
      if(!piece.isMesh||!piece.frustumCulled||piece.material===hide)continue;
      if(!batches.has(piece.material))batches.set(piece.material,[]);
      batches.get(piece.material).push(piece);
    }
    for(const [mat,pieces] of batches){
      if(pieces.length<2)continue;
      const vertices=[],normals=[],uvs=[],faces=[],vec=V(),normalMatrix=new T.Matrix3();
      for(const piece of pieces){
        piece.updateMatrix();normalMatrix.getNormalMatrix(piece.matrix);
        const geo=piece.geometry,attrs=geo.attributes,start=vertices.length/3;
        for(let i=0;i<attrs.position.count;i++){
          vec.fromBufferAttribute(attrs.position,i).applyMatrix4(piece.matrix);vertices.push(vec.x,vec.y,vec.z);
          vec.fromBufferAttribute(attrs.normal,i).applyNormalMatrix(normalMatrix);normals.push(vec.x,vec.y,vec.z);
          uvs.push(attrs.uv?.getX(i)??0,attrs.uv?.getY(i)??0);
        }
        if(geo.index){for(const i of geo.index.array)faces.push(start+i);}
        else{for(let i=0;i<attrs.position.count;i++)faces.push(start+i);}
        joint.remove(piece);
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(faces);mesh(joint,geo,mat);
    }
  }
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const shoulder=V(),bit=V(),hip=V(),knee=V(),ankle=V();
  let seatHeight=1.91,seatRate=0,lean=0,leanRate=0;
  const riderMatrix=new T.Matrix4();
  return {root,feet:gait.feet,rebase:gait.rebase,inspect:()=>({pose:{...gait.pose},seatHeight,lean,tailTip:tail.points.at(-1).toArray(),tailDock:tail.points[1].toArray(),
    arms:limbs.map(f=>f.arm.inspect()),tailLocks:tail.guides.map(g=>g.nodes.at(-1).toArray()),
    feet:gait.feet.map(f=>({down:f.stance,sole:f.sole.toArray(),joints:f.joints.map(v=>v.toArray())}))}),
    update(t,dt,speed,turn,distance,terrain){
      const p=gait.update(dt,speed,turn,distance,terrain,body);
      const rad=p.phase*TAU,post=p.trot*(1-p.run)*(.5+.5*Math.sin(rad-.58));
      flexQuarters(gait.feet);tail.update(dt,t,speed,turn,gait.feet,distance,p.bob);
      // Use the stirrups and folded knees as the base. The rider clears the cantle,
      // moving the sternum forward and down while the head keeps looking up the trail.
      const target=1.915+p.bob+.104*post+p.run*(.049+.019*p.drive)-.018*p.gather;
      seatRate+=((target-seatHeight)*159-seatRate*17)*dt;seatHeight+=seatRate*dt;
      const impact=(1-p.run)*Math.sin(2*rad-.86)*(.24+.35*p.trot)+p.run*Math.sin(rad-.72);
      seat.position.set(.011*Math.sin(rad)*(1-p.trot),1.91+clamp(seatHeight-(1.91+p.bob),-.014,.147),-.026*post+.019*p.run-.026*p.drive);
      seat.rotation.x=-p.pitch*.52+.028*impact;seat.rotation.z=-p.roll*.46;
      const leanTarget=-.04-.665*p.run-.067*post-.56*p.pitch-.132*p.gather+.055*p.drive;
      leanRate+=((leanTarget-lean)*128-leanRate*16)*dt;lean+=leanRate*dt;
      chest.rotation.x=lean;chest.rotation.z=-p.roll*.32;
      mantle.rotation.x=-.86*(lean+seat.rotation.x)*p.run;
      headPivot.rotation.x=-.67*(lean+seat.rotation.x+p.pitch);
      headPivot.rotation.z=-.25*p.roll;
      const previousNod=neck.rotation.x;
      neck.rotation.x=.035*Math.sin(2*rad+.7)*(1-p.run)+p.run*(.089*Math.sin(rad+.88)-.189-.069*p.drive);
      for(let i=0;i<ears.length;i++){
        const side=i*2-1,listen=Math.sin(t*1.33+i*2.2);
        ears[i].rotation.y=side*(.23+.14*listen+.34*Math.max(0,listen)**8-.10*p.run);
        ears[i].rotation.x=-.22+.08*Math.sin(rad+.7*i)-.07*p.run;
      }
      fringe.rotation.x=.045*Math.sin(rad+.38)*(.45+.55*p.run);
      neck.rotation.z=.018*Math.sin(rad)*(1-p.trot);
      seat.updateMatrix();chest.updateMatrix();rider.updateMatrix();neck.updateMatrix();
      riderMatrix.copy(seat.matrix).multiply(chest.matrix).multiply(rider.matrix);
      for(const f of limbs){
        const a=f.a;
        shoulder.set(a*.174,2.428,-.038).applyMatrix4(riderMatrix);
        bit.set(a*.149,.533,-.885).applyMatrix4(neck.matrix);
        f.arm.update(shoulder,bit,p.run,turn,dt);
        hip.set(a*.147,.035,-.022).applyMatrix4(seat.matrix);
        ankle.set(a*.354,1.265,-.124);knee.set(a*(.348+.018*p.run),1.622+.040*p.run+.25*(hip.y-1.945),-.245-.087*p.run+.32*(hip.y-1.945)-.016*impact);
        f.thigh(hip,knee);f.shin(knee,ankle);
      }
      const breeze=meadowWind(root.position.x,distance,t)*Math.cos(root.rotation.y);
      const gust=(breeze-.49)*1.8-turn*.24;
      const air=T.MathUtils.smoothstep(speed,1.15,7.4);
      streamScarf(dt,t,air,breeze,seatRate,turn);
      const nodRate=dt?clamp((neck.rotation.x-previousNod)/dt,-2,2):0;
      mane(t,dt,air,gust,nodRate);
      for(const panel of coat)panel(t,dt,air,gust,seatRate,p.roll);
      for(const update of cloth)update(t,dt,speed,turn,impact);
      for(const update of flow)update(t,dt,speed,turn,impact);
      return p.touchdowns;
    }};
}
