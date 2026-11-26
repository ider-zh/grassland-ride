import * as T from 'three';
import {surfacePoint,wrap,segmentAt,sections,LENGTH,FRAME_SPAN,smooth} from './world/route.js';
import {createChunks} from './world/chunks.js';
import {createFrame} from './world/frame.js';
import {createSky} from './environment/sky.js';
import {createTrailAir,createShutter} from './environment/atmosphere.js';
import {createRain} from './environment/rain.js';
import {createMount} from './rider/mount.js';
import {createSoundscape} from './environment/soundscape.js';

const byId=id=>document.getElementById(id),card=byId('msgCard'),canvas=byId('view');
const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
function run(){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,1,.08,790);
  const sky=createSky(scene),chunks=createChunks(scene),mount=createMount(false),sound=createSoundscape(byId('field-audio'));scene.add(mount.root);
  const air=createTrailAir(scene),rainEffect=createRain(scene),renderRide=createShutter(renderer,scene,camera,mount.root);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const ctx=shadowCanvas.getContext('2d'),grad=ctx.createRadialGradient(64,64,4,64,64,63);
  grad.addColorStop(0,'rgba(28,24,17,.68)');grad.addColorStop(.48,'rgba(30,30,17,.42)');grad.addColorStop(1,'rgba(40,35,21,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const shadow=new T.Mesh(new T.PlaneGeometry(1.52,2.85),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));shadow.rotation.x=-Math.PI/2;
  const shadowPivot=new T.Group();shadowPivot.add(shadow);scene.add(shadowPivot);
  const speeds=[1.65,3.75,7.4],names=['慢步','小跑','疾驰'],held=new Set();
  let gait=0,speed=speeds[0],s=0,meters=0,t=0,hour=7.33,lane=0,sideV=0,touch=0,paused=false;
  let orbit=-.47,height=.075,zoom=5.85,drag=null,head=0,camReady=false,freeCamera=false;
  let dayBlend=0,skipHours=0,steerLean=0;
  let rain=0,rainTarget=0;
  const debug=new URLSearchParams(location.search).has('inspect');
  const headDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
  const aim=new T.Vector3(),eye=new T.Vector3(),camLook=new T.Vector3(),forward=new T.Vector3();
  const rebase=new T.Matrix4();
  let frameId=NaN,frame;
  function frameFor(distance){
    const id=Math.floor(distance/FRAME_SPAN);
    if(id===frameId)return;
    const next=createFrame((id+.5)*FRAME_SPAN);
    if(frame&&camReady){
      rebase.multiplyMatrices(next.fromPlanet,frame.toPlanet);
      camera.position.applyMatrix4(rebase);camLook.applyMatrix4(rebase);
      forward.set(-Math.sin(head),0,-Math.cos(head)).transformDirection(rebase);
      head=Math.atan2(-forward.x,-forward.z);
      mount.rebase(rebase);air.rebase(rebase);
    }
    renderRide.resetHistory?.();frameId=id;frame=next;chunks.frame(frame);
  }
  function setGait(step){gait=clamp(gait+step,0,2);byId('gait').textContent=names[gait];document.querySelectorAll('#marks i').forEach((el,i)=>el.classList.toggle('on',i<=gait));}
  function setPause(value){
    paused=value;held.clear();touch=0;drag=null;sound.gains(paused);
    byId('pauseMark').setAttribute('d',paused?'M6 4l14 8-14 8z':'M6 5h4v14H6zm8 0h4v14h-4z');
    card.hidden=!paused;if(paused){card.innerHTML='旅途暂歇<br><button id="resume">继续骑行</button>';byId('resume').onclick=()=>setPause(false);}
  }
  function nextTime(){
    const target=[6.5,12,18.5,22].find(h=>h>hour+.35)??30.5;
    skipHours=target-hour;dayBlend=1.5;
  }
  async function audio(){const on=await sound.toggle(paused);byId('audioBtn').setAttribute('aria-label',on?'关闭环境声':'开启环境声');
    byId('soundMark').setAttribute('d',on?'M15 8q5 4 0 8m3-11q8 7 0 14':'m16 9 6 6m0-6-6 6');}
  byId('rainBtn').onclick=()=>{
    rainTarget=1-rainTarget;byId('rainBtn').textContent=rainTarget?'雨天':'晴天';
    byId('rainBtn').setAttribute('aria-pressed',String(Boolean(rainTarget)));
  };
  byId('timeBtn').onclick=nextTime;byId('audioBtn').onclick=audio;byId('pauseBtn').onclick=()=>setPause(!paused);
  byId('routeGuide').querySelectorAll('[data-stop]').forEach(button=>button.onclick=()=>{
    s=Number(button.dataset.stop);meters=s;camReady=false;frameId=NaN;freeCamera=false;
    byId('routeGuide').open=false;
    world(.016);renderRide(s,t,speed,frame);
  });
  const keys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','Space','KeyT','KeyM'];
  addEventListener('keydown',e=>{
    if(!keys.includes(e.code)||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.code==='Space'&&e.target instanceof HTMLButtonElement)return;
    e.preventDefault();held.add(e.code);if(e.repeat)return;
    if(e.code==='Space')setPause(!paused);if(e.code==='KeyM')audio();if(paused)return;
    if(['KeyW','ArrowUp'].includes(e.code))setGait(1);
    if(['KeyS','ArrowDown'].includes(e.code))setGait(-1);
    if(e.code==='KeyT')nextTime();
  });
  addEventListener('keyup',e=>held.delete(e.code));addEventListener('blur',()=>{held.clear();touch=0;drag=null;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true);});
  canvas.onpointerdown=e=>{if(paused)return;canvas.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY];};
  canvas.onpointermove=e=>{if(!drag)return;if(Math.abs(e.clientX-drag[0])+Math.abs(e.clientY-drag[1])>1)freeCamera=true;orbit-=(e.clientX-drag[0])*.006;height=clamp(height+(e.clientY-drag[1])*.003,-.13,.74);drag=[e.clientX,e.clientY];};
  canvas.onpointercancel=canvas.onpointerup=()=>drag=null;
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom+Math.sign(e.deltaY)*.35,3.1,9);},{passive:false});
  document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{if(!paused)setGait(+b.dataset.speed);});
  document.querySelectorAll('[data-dir]').forEach(b=>{
    b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);touch=+b.dataset.dir;};b.onlostpointercapture=b.onpointerup=b.onpointercancel=()=>touch=0;
  });
  let lastW=0,lastH=0,scale=Math.min(1.4,window.devicePixelRatio||1),frameCost=0,sampleN=0;
  function resize(){
    const w=innerWidth,h=innerHeight;if(w===lastW&&h===lastH)return;lastW=w;lastH=h;
    renderer.setPixelRatio(scale);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  function world(dt){
    t+=dt;speed=lerp(speed,speeds[gait],1-Math.exp(-dt*1.7));
    const steer=touch||Number(held.has('KeyD')||held.has('ArrowRight'))-Number(held.has('KeyA')||held.has('ArrowLeft'));
    sideV=lerp(sideV,steer*Math.min(1.5,.52+speed*.14),1-Math.exp(-dt*4));lane=clamp(lane+sideV*dt,-1.40,1.40);
    const travel=speed*dt;
    if(travel){
      const a=surfacePoint(s,lane),b=surfacePoint(s+1,lane),metresPerArc=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
      s+=travel/metresPerArc;meters+=travel;
    }
    if(dayBlend>0){const part=Math.min(dt,dayBlend);hour+=skipHours*part/dayBlend;skipHours*=1-part/dayBlend;dayBlend-=part;}
    hour=(hour+dt/16)%24;
    rain=lerp(rain,rainTarget,1-Math.exp(-dt*1.15));
    frameFor(s);const {at,ground}=frame;
    const p=at(s,lane),prev=at(s-.45,lane),next=at(s+.45,lane);
    const {x,y,z}=p,pitch=Math.atan2(next.y-prev.y,Math.hypot(next.x-prev.x,next.z-prev.z));
    const actualV=Math.abs(lane)>=1.399&&Math.sign(sideV)===Math.sign(lane)?0:sideV;
    steerLean=camReady?lerp(steerLean,actualV,1-Math.exp(-dt*6.5)):actualV;
    const yaw=p.yaw-Math.atan2(steerLean,speed)*.7;
    mount.root.position.set(x,y,z);mount.root.rotation.set(pitch,yaw,0,'YXZ');
    const contacts=mount.update(t,dt,speed,steerLean,s,(x,negativeZ)=>ground(x,-negativeZ));
    shadowPivot.position.set(x+.09,y+.047,z+.03);shadowPivot.rotation.copy(mount.root.rotation);
    shadow.material.opacity=.82-.28*rain;
    head=camReady?head+headDelta(head,p.yaw)*(1-Math.exp(-dt*2.8)):p.yaw;
    const w=wrap(s);
    const ledge=smooth(3050,3160,w)*(1-smooth(3345,3540,w));
    const lakeshore=smooth(4220,4290,w)*(1-smooth(4370,4450,w));
    const framePan=freeCamera?0:.89*ledge-.25*lakeshore;
    const angle=head+orbit+framePan,dist=zoom*(1+.025*gait);
    eye.set(x+dist*Math.sin(angle)*Math.cos(height),y+2.05+dist*Math.sin(height)+(freeCamera?0:ledge*.62),z+dist*Math.cos(angle)*Math.cos(height));
    eye.y=Math.max(eye.y,ground(eye.x,eye.z)+.48);
    aim.set(x-1.20*Math.sin(head),y+1.83,z-1.20*Math.cos(head));
    if(!camReady){camera.position.copy(eye);camLook.copy(aim);camReady=true;}
    camera.position.lerp(eye,1-Math.exp(-dt*8.0));camLook.lerp(aim,1-Math.exp(-dt*8.8));camera.lookAt(camLook);
    chunks(s,t);const flock=sky(hour,t,s,camera,mount.root.position,rain);
    air(dt,t,s,speed,mount.feet,frame);rainEffect(t,camera.position,rain);
    if(dt>0)sound.tick(contacts,{speed,t,dt,s,hour,rain,camera,flock});
    const section=sections[segmentAt(s)].label,lap=Math.floor(s/LENGTH)+1;
    if(byId('section').textContent!==section)byId('section').textContent=section;
    if(byId('lap').textContent!==String(lap))byId('lap').textContent=lap;
    byId('clock').textContent=[Math.floor(hour),Math.floor((hour%1)*60)].map(v=>String(v).padStart(2,'0')).join(':');
    byId('時').textContent=hour<5?'星夜':hour<9?'清晨':hour<16?'白昼':hour<20?'薄暮':'星夜';
    byId('distance').textContent=meters<1000?Math.floor(meters):(meters/1000).toFixed(2);byId('unit').textContent=meters<1000?'m':'km';
  }
  card.hidden=true;setGait(0);resize();world(0);
  let previous=performance.now();
  function draw(now){
    const elapsed=Math.max(0,(now-previous)/1000);previous=now;
    if(!paused){
      resize();const dt=Math.min(.15,elapsed),steps=Math.max(1,Math.ceil(dt/.034));
      for(let i=0;i<steps;i++)world(dt/steps);
      renderRide(s,t,speed,frame);
      if(elapsed<1){frameCost+=elapsed;sampleN++;if(sampleN===45){if(frameCost/sampleN>.038&&scale>.65){scale=Math.max(.65,scale*.82);lastW=0;}frameCost=sampleN=0;}}
    }
    requestAnimationFrame(draw);
  }
  if(debug){
    window.rideInspect={state:()=>({s,route:wrap(s),section:segmentAt(s),lap:Math.floor(s/LENGTH)+1,meters,lane,speed,gait,hour,t,rain,rainTarget,paused,orbit,
        position:mount.root.position.toArray(),mountYaw:mount.root.rotation.y,camera:camera.position.toArray(),
        planet:surfacePoint(s,lane),planetCamera:camera.position.clone().applyMatrix4(frame.toPlanet).toArray(),planetFrame:frameId,length:LENGTH,
        chunks:chunks.inspect(),objects:scene.children.length,geometries:renderer.info.memory.geometries}),
      motion:mount.inspect,audio:sound.inspect,
      advance(seconds,render=true){const steps=Math.max(1,Math.ceil(seconds*30));for(let i=0;i<steps;i++)world(seconds/steps);if(render)renderRide(s,t,speed,frame);},
      setView(yaw,elevation=height,distance=zoom){orbit=yaw;height=elevation;zoom=distance;freeCamera=true;camReady=false;world(0);renderRide(s,t,speed,frame);},
      jump(k,h){s=k;meters=k;hour=h;camReady=false;freeCamera=false;world(.016);renderRide(s,t,speed,frame);}};
  }
  if(!debug||!new URLSearchParams(location.search).has('manual'))requestAnimationFrame(draw);
}
try{run();}catch(err){card.hidden=false;card.textContent='场景未能启动。请在启用硬件加速的 Chrome 或 Edge 中打开。 '+err.message;console.error(err);}
