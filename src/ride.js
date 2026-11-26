import * as T from 'three';
import {at,ground,wrap,segmentAt,LENGTH} from './world/route.js';
import {createChunks} from './world/chunks.js';
import {createSky} from './environment/sky.js';
import {createTrailAir,createShutter} from './environment/atmosphere.js';
import {createRain} from './environment/rain.js';
import {createMount} from './rider/mount.js';

const byId=id=>document.getElementById(id),card=byId('msgCard'),canvas=byId('view');
const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
function soundscape(){
  let ctx,master,noise,wind,rainGain,on=false;
  function init(){
    ctx=new AudioContext();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const d=noise.getChannelData(0);
    let brown=0;for(let i=0;i<d.length;i++){brown=.94*brown+.06*(Math.random()*2-1);d[i]=brown*2.6;}
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter();src.buffer=noise;src.loop=true;
    wind=ctx.createGain();wind.gain.value=.11;filter.type='lowpass';filter.frequency.value=760;
    src.connect(filter).connect(wind).connect(master);
    const rainTone=ctx.createBiquadFilter();rainTone.type='highpass';rainTone.frequency.value=1200;
    rainGain=ctx.createGain();rainGain.gain.value=0;
    src.connect(rainTone).connect(rainGain).connect(master);src.start();
  }
  function gains(paused){if(ctx)master.gain.setTargetAtTime(on&&!paused?.65:0,ctx.currentTime,.06);}
  return {async toggle(paused){if(!ctx)init();await ctx.resume();on=!on;gains(paused);return on;},gains,
    tick(impacts,s,t,rain){
      if(!on||!ctx)return;const now=ctx.currentTime;
      rainGain.gain.setTargetAtTime(rain*.26,now,.3);
      wind.gain.setTargetAtTime(.09+s*.006+.035*Math.sin(t*.73),now,.25);
      if(impacts){
        const osc=ctx.createOscillator(),g=ctx.createGain();osc.frequency.setValueAtTime(132+Math.random()*36,now);osc.frequency.exponentialRampToValueAtTime(44,now+.10);
        g.gain.setValueAtTime(.10+.013*s,now);g.gain.exponentialRampToValueAtTime(.0002,now+.13);osc.connect(g).connect(master);osc.start(now);osc.stop(now+.14);
        const src=ctx.createBufferSource(),ng=ctx.createGain();src.buffer=noise;src.playbackRate.value=2.4;
        ng.gain.setValueAtTime(.22,now);ng.gain.exponentialRampToValueAtTime(.001,now+.09);
        src.connect(ng).connect(master);src.start(now,Math.random());src.stop(now+.10);
      }
    }};
}
function run(){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,1,.08,790);
  const sky=createSky(scene),chunks=createChunks(scene),mount=createMount(false),sound=soundscape();scene.add(mount.root);
  const air=createTrailAir(scene),rainEffect=createRain(scene),renderRide=createShutter(renderer,scene,camera,mount.root);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const ctx=shadowCanvas.getContext('2d'),grad=ctx.createRadialGradient(64,64,4,64,64,63);
  grad.addColorStop(0,'rgba(28,24,17,.68)');grad.addColorStop(.48,'rgba(30,30,17,.42)');grad.addColorStop(1,'rgba(40,35,21,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const shadow=new T.Mesh(new T.PlaneGeometry(1.52,2.85),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));shadow.rotation.x=-Math.PI/2;
  const shadowPivot=new T.Group();shadowPivot.add(shadow);scene.add(shadowPivot);
  const speeds=[1.65,3.75,7.4],names=['慢步','小跑','疾驰'],held=new Set();
  let gait=0,speed=speeds[0],s=0,meters=0,t=0,hour=7.33,lane=0,sideV=0,touch=0,paused=false;
  let orbit=-.60,height=.045,zoom=5.30,drag=null,head=0,camReady=false;
  let dayBlend=0,skipHours=0,steerLean=0;
  let rain=0,rainTarget=0;
  const sections=['驿镇','草原','山脊'],debug=new URLSearchParams(location.search).has('inspect');
  const headDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
  const aim=new T.Vector3(),eye=new T.Vector3(),camLook=new T.Vector3();
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
  canvas.onpointermove=e=>{if(!drag)return;orbit-=(e.clientX-drag[0])*.006;height=clamp(height+(e.clientY-drag[1])*.003,-.13,.74);drag=[e.clientX,e.clientY];};
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
    s+=speed*dt;meters+=speed*dt;
    if(dayBlend>0){const part=Math.min(dt,dayBlend);hour+=skipHours*part/dayBlend;skipHours*=1-part/dayBlend;dayBlend-=part;}
    hour=(hour+dt/16)%24;
    rain=lerp(rain,rainTarget,1-Math.exp(-dt*1.15));
    const p=at(s,lane),prev=at(s-.45,lane),next=at(s+.45,lane);
    const {x,y,z}=p,pitch=Math.atan2(next.y-prev.y,Math.hypot(next.x-prev.x,next.z-prev.z));
    const actualV=Math.abs(lane)>=1.399&&Math.sign(sideV)===Math.sign(lane)?0:sideV;
    steerLean=camReady?lerp(steerLean,actualV,1-Math.exp(-dt*6.5)):actualV;
    const yaw=p.yaw-Math.atan2(steerLean,speed)*.7;
    mount.root.position.set(x,y,z);mount.root.rotation.set(pitch,yaw,0,'YXZ');
    const impacts=mount.update(t,dt,speed,steerLean,s,(x,negativeZ)=>ground(x,-negativeZ));
    shadowPivot.position.set(x+.09,y+.047,z+.03);shadowPivot.rotation.copy(mount.root.rotation);
    shadow.material.opacity=.82-.28*rain;
    head=camReady?head+headDelta(head,p.yaw)*(1-Math.exp(-dt*2.8)):p.yaw;
    const angle=head+orbit,dist=zoom*(1+.025*gait);
    eye.set(x+dist*Math.sin(angle)*Math.cos(height),y+2.05+dist*Math.sin(height),z+dist*Math.cos(angle)*Math.cos(height));
    eye.y=Math.max(eye.y,ground(eye.x,eye.z)+.48);
    aim.set(x-.67*Math.sin(head),y+1.72,z-.67*Math.cos(head));
    if(!camReady){camera.position.copy(eye);camLook.copy(aim);camReady=true;}
    camera.position.lerp(eye,1-Math.exp(-dt*8.0));camLook.lerp(aim,1-Math.exp(-dt*8.8));camera.lookAt(camLook);
    chunks(s,t);sky(hour,t,s,camera,mount.root.position,rain);
    air(dt,t,s,speed,mount.feet);rainEffect(t,camera.position,rain);
    sound.tick(impacts,speed,t,rain);
    const section=sections[segmentAt(s)],lap=Math.floor(s/LENGTH)+1;
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
      renderRide(s,t,speed);
      if(elapsed<1){frameCost+=elapsed;sampleN++;if(sampleN===45){if(frameCost/sampleN>.038&&scale>.65){scale=Math.max(.65,scale*.82);lastW=0;}frameCost=sampleN=0;}}
    }
    requestAnimationFrame(draw);
  }
  if(debug){
    window.rideInspect={state:()=>({s,route:wrap(s),section:segmentAt(s),lap:Math.floor(s/LENGTH)+1,meters,lane,speed,gait,hour,t,rain,rainTarget,paused,orbit,
        position:mount.root.position.toArray(),mountYaw:mount.root.rotation.y,camera:camera.position.toArray(),
        snowline:scene.getObjectByName('fixed-snowline').position.toArray(),
        chunks:chunks.inspect(),objects:scene.children.length,geometries:renderer.info.memory.geometries}),
      motion:mount.inspect,
      advance(seconds,render=true){const steps=Math.max(1,Math.ceil(seconds*30));for(let i=0;i<steps;i++)world(seconds/steps);if(render)renderRide(s,t,speed);},
      setView(yaw,elevation=height,distance=zoom){orbit=yaw;height=elevation;zoom=distance;camReady=false;world(0);renderRide(s,t,speed);},
      jump(k,h){s=k;meters=k;hour=h;camReady=false;world(.016);renderRide(s,t,speed);}};
  }
  if(!debug||!new URLSearchParams(location.search).has('manual'))requestAnimationFrame(draw);
}
try{run();}catch(err){card.hidden=false;card.textContent='场景未能启动。请在启用硬件加速的 Chrome 或 Edge 中打开。 '+err.message;console.error(err);}
