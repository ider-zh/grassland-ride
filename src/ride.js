import * as T from 'three';
import {road,ground,createLand} from './land.js';
import {createSky} from './sky.js';
import {createTrailAir,createShutter} from './weather.js';
import {createMount} from './mount.js';

const byId=id=>document.getElementById(id),card=byId('msgCard'),canvas=byId('view');
const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
function soundscape(){
  let ctx,master,noise,wind,on=false;
  function init(){
    ctx=new AudioContext();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const d=noise.getChannelData(0);
    let brown=0;for(let i=0;i<d.length;i++){brown=.94*brown+.06*(Math.random()*2-1);d[i]=brown*2.6;}
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter();src.buffer=noise;src.loop=true;
    wind=ctx.createGain();wind.gain.value=.11;filter.type='lowpass';filter.frequency.value=760;
    src.connect(filter).connect(wind).connect(master);src.start();
  }
  function gains(paused){if(ctx)master.gain.setTargetAtTime(on&&!paused?.65:0,ctx.currentTime,.06);}
  return {async toggle(paused){if(!ctx)init();await ctx.resume();on=!on;gains(paused);return on;},gains,
    tick(impacts,s,t){
      if(!on||!ctx)return;const now=ctx.currentTime;
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
  const sky=createSky(scene),land=createLand(scene),mount=createMount(),sound=soundscape();scene.add(mount.root);
  const air=createTrailAir(scene),renderRide=createShutter(renderer,scene,camera,mount.root);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const ctx=shadowCanvas.getContext('2d'),grad=ctx.createRadialGradient(64,64,4,64,64,63);
  grad.addColorStop(0,'rgba(28,24,17,.68)');grad.addColorStop(.48,'rgba(30,30,17,.42)');grad.addColorStop(1,'rgba(40,35,21,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const shadow=new T.Mesh(new T.PlaneGeometry(1.52,2.85),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));shadow.rotation.x=-Math.PI/2;
  const shadowPivot=new T.Group();shadowPivot.add(shadow);scene.add(shadowPivot);
  const speeds=[1.65,3.75,7.4],names=['慢步','小跑','疾驰'],held=new Set();
  let gait=0,speed=speeds[0],s=0,meters=0,t=0,hour=7.33,lane=0,sideV=0,touch=0,paused=false;
  let orbit=-.60,height=.045,zoom=5.30,drag=null,head=0,camReady=false;
  let dayBlend=0,skipHours=0,steerLean=0;
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
    const tangent=(road(s+.5)-road(s-.5));s+=speed*dt/Math.hypot(1,tangent);meters+=speed*dt;
    if(dayBlend>0){const part=Math.min(dt,dayBlend);hour+=skipHours*part/dayBlend;skipHours*=1-part/dayBlend;dayBlend-=part;}
    hour=(hour+dt/16)%24;
    const x=road(s)+lane,y=ground(x,s),grade=(ground(road(s+.5)+lane,s+.5)-ground(road(s-.5)+lane,s-.5))/Math.hypot(1,tangent);
    const theta=-Math.atan(tangent),pitch=Math.atan(grade),actualV=Math.abs(lane)>=1.399&&Math.sign(sideV)===Math.sign(lane)?0:sideV;
    steerLean=camReady?lerp(steerLean,actualV,1-Math.exp(-dt*6.5)):actualV;
    const yaw=theta-Math.atan2(steerLean,speed)*.7;
    mount.root.position.set(x,y,0);mount.root.rotation.order='YXZ';mount.root.rotation.set(pitch,yaw,0,'YXZ');
    const impacts=mount.update(t,dt,speed,steerLean,s,ground);
    shadowPivot.position.set(x+.09,y+.052,.03);shadowPivot.rotation.copy(mount.root.rotation);
    shadow.material.opacity=.82;
    head=camReady?lerp(head,theta,1-Math.exp(-dt*2.8)):theta;
    const angle=head+orbit,dist=zoom*(1+.025*gait);
    eye.set(x+dist*Math.sin(angle)*Math.cos(height),y+2.05+dist*Math.sin(height),dist*Math.cos(angle)*Math.cos(height));
    eye.y=Math.max(eye.y,ground(eye.x,s-eye.z)+.48);
    // Look slightly above the saddle so that the snowline stays in the rider's field of view.
    aim.set(x-.67*Math.sin(head),y+1.72,-.67*Math.cos(head));
    if(!camReady){camera.position.copy(eye);camLook.copy(aim);camReady=true;}
    camera.position.lerp(eye,1-Math.exp(-dt*8.0));camLook.lerp(aim,1-Math.exp(-dt*8.8));camera.lookAt(camLook);
    land(s,t,Math.min(1,scale));sky(hour,t,s,camera,mount.root.position);air(dt,t,s,speed,mount.feet);sound.tick(impacts,speed,t);
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
      if(elapsed<.25){frameCost+=elapsed;sampleN++;if(sampleN===90){if(frameCost/sampleN>.038&&scale>.70){scale=Math.max(.70,scale*.84);lastW=0;}frameCost=sampleN=0;}}
    }
    requestAnimationFrame(draw);
  }
  if(new URLSearchParams(location.search).has('inspect')){
    window.rideInspect={state:()=>({s,meters,lane,speed,gait,hour,t,paused,orbit,objects:scene.children.length,geometries:renderer.info.memory.geometries}),
      motion:mount.inspect,
      advance(seconds){const steps=Math.max(1,Math.ceil(seconds*30));for(let i=0;i<steps;i++)world(seconds/steps);renderRide(s,t,speed);},
      jump(k,h){s=k;meters=k;hour=h;camReady=false;world(.016);renderRide(s,t,speed);}};
  }
  requestAnimationFrame(draw);
}
try{run();}catch(err){card.hidden=false;card.textContent='场景未能启动。请在启用硬件加速的 Chrome 或 Edge 中打开。 '+err.message;console.error(err);}
