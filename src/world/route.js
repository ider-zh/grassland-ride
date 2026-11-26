// Longitude is measured in metres of equator arc. The path follows one full
// revolution of a 3D sphere with occasional smooth lateral bends, not a flat oval.
export const CHUNK=32, LENGTH=6912, COUNT=LENGTH/CHUNK, ROAD_HALF=2.4, TAU=2*Math.PI;
export const RADIUS=LENGTH/TAU, FRAME_SPAN=128;
export const TARN={s:4320,l:48,length:86,width:29,level:14.6};
export const tarnShape=(s,l)=>Math.hypot((s-TARN.s+.19*(l-TARN.l))/TARN.length,
  (l-TARN.l+4*Math.sin((s-TARN.s)*.029))/TARN.width);
export const sections=[
 {start:0,label:'驿镇',scenery:0,sound:0},
 {start:192,label:'长风草原',scenery:1,sound:1},
 {start:2304,label:'雪山峡谷',scenery:3,sound:2},
 {start:2944,label:'雪岭山脊',scenery:2,sound:2},
 {start:3840,label:'山后高原',scenery:4,sound:2},
 {start:4992,label:'回程草甸',scenery:1,sound:1},
 {start:6720,label:'归途',scenery:1,sound:1}
];
export const wrap=s=>((s%LENGTH)+LENGTH)%LENGTH;
export const smooth=(a,b,n)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);};
export function random(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
export function segmentAt(s){
  const w=wrap(s);let i=sections.length-1;
  while(i>0&&w<sections[i].start)i--;
  return i;
}
function zoneBlend(s,key){
  const w=wrap(s),i=segmentAt(w),a=sections[i],j=(i+1)%sections.length;
  const end=j?sections[j].start:LENGTH,from=w-a.start,to=end-w,range=22;
  if(from<range)return [sections[(i+sections.length-1)%sections.length][key],a[key],smooth(-range,range,from)];
  if(to<range)return [a[key],sections[j][key],smooth(-range,range,-to)];
  return [a[key],a[key],0];
}
export const blendAt=s=>zoneBlend(s,'sound');
export const terrainBlend=s=>zoneBlend(s,'scenery');
const signed=(s,m)=>wrap(s-m+LENGTH/2)-LENGTH/2;
const bell=(x,span)=>Math.exp(-Math.pow(x/span,2));
function bend(s){
  // Flat stretches between these isolated, C1-smooth turns. No global sine
  // steering or large continuous heading changes.
  let x=0;
  for(const [start,hold,end,d] of [[440,625,865,38],[1350,1520,1700,-34],
      [2120,2350,2640,-26],[2670,3060,3640,130],[3810,4000,4360,55],
      [5120,5330,5650,-58],[5860,6090,6380,31]]){
    const w=wrap(s);
    if(w>start&&w<end)x+=d*(w<hold?smooth(start,hold,w):1-smooth(hold,end,w));
  }
  return x;
}
export function relief(s,l){
  s=wrap(s);
  const a=s/RADIUS;
  const townFade=.19+.81*smooth(70,250,Math.abs(signed(s,70)));
  const blanket=(2.8*Math.sin(a*13+.2)+1.9*Math.cos(a*29+l*.019)+1.35*Math.sin(a*61-l*.045))*townFade;
  const texture=(.42*Math.sin(Math.sin(a)*152+l*.095)+.32*Math.sin(Math.cos(a)*130-l*.104))*townFade;
  const foot=8*bell(signed(s,2960),650)*bell(l-10,300);
  // Fixed mountain massif. The valley lies between the two actual summits;
  // the later route climbs its eastern shoulder as the road bends right.
  const massif=
    157*bell(signed(s,2400),183)*bell(l+114,83)+
    118*bell(signed(s,2510),158)*bell(l-121,92)+
    173*bell(signed(s,2730),252)*bell(l+178,81)+
    137*bell(signed(s,2900),265)*bell(l-191,104)+
    95*bell(signed(s,3300),244)*bell(l-180,140)+
    131*bell(signed(s,3420),159)*bell(l+84,94)+
    69*bell(signed(s,3390),147)*bell(l-5,52)+
    127*bell(signed(s,3110),319)*bell(l+221,104);
  const spurs=(12+8*Math.sin(l*.069+a*96)+4.5*Math.sin(l*.11-a*116))*
    bell(signed(s,2880),630)*smooth(39,129,Math.abs(l));
  // Behind the pass an open elevated basin with low tablelands, not a second fake snowy skybox.
  const table=20*bell(signed(s,4390),560)*(1-.72*bell(l,91))+
    37*bell(signed(s,4660),190)*bell(l+167,130)+
    34*bell(signed(s,4160),215)*bell(l-172,138)+
    27*bell(signed(s,4500),91)*bell(l-84,51)+
    13*bell(signed(s,4465),58)*bell(l-95,45);
  const spill=(24+14*bell(l-28,127))*smooth(2950,3120,s)*(1-smooth(3450,3670,s))*
    smooth(9,58,bend(s)-l)*bell(l-40,225);
  const natural=2+blanket+texture+foot+massif+spurs+table-spill;
  const mountainRoad=smooth(2230,2620,s)*13
    +smooth(2740,3195,s)*63
    -smooth(3350,4015,s)*64
    -smooth(4410,5050,s)*12
    +11*smooth(3980,4170,s)*(1-smooth(4245,4405,s));
  const mainRoad=2+blanket*.48+mountainRoad;
  // A graded shelf follows the trail in the mountain, then blends back into
  // the real slopes. This keeps sharp rock details from becoming road ramps.
  const gradeWeight=(1-smooth(6,38,Math.abs(l-bend(s))))*
    smooth(2020,2300,s)*(1-smooth(4750,5070,s));
  const apron=natural+(mainRoad-natural)*gradeWeight;
  const left=bend(s)-l;
  const ledge=smooth(3060,3150,s)*(1-smooth(3335,3485,s))*
    smooth(3.85,11,left)*(1-smooth(62,112,left));
  const below=mainRoad-2 - 30*smooth(4.25,32,left) - 15*smooth(20,61,left);
  const terrain=apron+(Math.min(apron,below)-apron)*ledge;
  const basin=tarnShape(s,l);
  const shore=(1-smooth(.63,1.12,basin))*smooth(13,25,l);
  const basinFloor=9.1+.7*Math.cos(l*.19+s*.06);
  const outlet=smooth(4210,4260,s)*(1-smooth(4360,4410,s))*smooth(9,21,l-bend(s))*(1-smooth(25,42,l));
  const openTerrain=terrain+(12.8+.55*Math.cos(s*.072+l*.08)-terrain)*outlet*.82;
  const raisedBank=5.2*smooth(.88,1.05,basin)*(1-smooth(1.08,1.24,basin))*smooth(24,44,l);
  return openTerrain+(basinFloor-openTerrain)*shore+raisedBank;
}
export function arcPoint(s,l,altitude){
  const a=wrap(s)/RADIUS,lat=l/RADIUS,cos=Math.cos(lat);
  const radius=RADIUS+altitude;
  return {x:radius*Math.sin(a)*cos,y:-radius*Math.sin(lat),z:radius*Math.cos(a)*cos};
}
export const globePoint=(s,l,down=0)=>arcPoint(s,l,relief(s,l)-down);
export const surfacePoint=(s,lateral=0,down=0)=>globePoint(s,bend(s)+lateral,down);
export const roadLateral=(s)=>bend(s);
export function geographic(x,y,z){
  const r=Math.hypot(x,y,z);
  return {s:wrap(Math.atan2(x,z)*RADIUS),l:-Math.asin(Math.max(-1,Math.min(1,y/r)))*RADIUS,r};
}
export function trailWidth(s){return ROAD_HALF+.21*Math.sin(wrap(s)*TAU/32)+.10*Math.cos(wrap(s)*TAU/(LENGTH/384));}
export function windTravel(t){return 2.05*t+1.75*Math.sin(t*.50)+.58*Math.sin(t*1.12);}
export function meadowWind(x,s,t){
  const phase=x*.17+s*.092-windTravel(t)*.67+.82*Math.sin(s*.081+t*.25);
  const front=smooth(-.27,.89,Math.sin(phase)+.28*Math.sin(phase*1.9+s*.10));
  return .08+front*(.93+.20*Math.sin(x*.46-s*.28-t*3.4));
}
