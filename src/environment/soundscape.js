import {blendAt,random,smooth} from '../world/route.js';

const surfaces=['stone','dirt','gravel'];
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

// The samples are offline, but their timing is not baked into a gait loop.
export const mixForSpeed=speed=>{
  const moving=smooth(1.75,7.4,speed),trot=smooth(1.75,3.85,speed);
  return {wind:.014+.125*moving,hoof:.22+.40*trot+.34*moving};
};
export function createSoundscape(bankElement,debug=false){
  let ctx,master,wind,rainGain,birdBus,compressor,sprite,cues,loading,on=false,paused=false;
  let encounter=null,lastFlock=null,birdVoice=null,request=0,lastMix=mixForSpeed(1.65);
  const latest=[];
  const roll=random(2913349),lastSample={},voices=new Set();
  const counts={hoof:[0,0,0,0],birds:0,bySurface:{stone:0,dirt:0,gravel:0}};
  function init(){
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain();master.gain.value=0;
    compressor=ctx.createDynamicsCompressor();
    compressor.threshold.value=-13;compressor.knee.value=16;compressor.ratio.value=3;
    compressor.attack.value=.003;compressor.release.value=.13;
    master.connect(compressor).connect(ctx.destination);
    birdBus=ctx.createGain();birdBus.gain.value=1;birdBus.connect(master);
    const noise=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate),data=noise.getChannelData(0);
    let brown=0;
    for(let i=0;i<data.length;i++){
      brown=.94*brown+.06*(roll()*2-1);
      // A little high-frequency grain gives the rain highpass something to pass.
      data[i]=brown*2.3+(roll()*2-1)*.12;
    }
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter();
    src.buffer=noise;src.loop=true;
    wind=ctx.createGain();wind.gain.value=.014;
    filter.type='lowpass';filter.frequency.value=740;
    src.connect(filter).connect(wind).connect(master);
    const rainTone=ctx.createBiquadFilter();
    rainTone.type='highpass';rainTone.frequency.value=1150;
    rainGain=ctx.createGain();rainGain.gain.value=0;
    src.connect(rainTone).connect(rainGain).connect(master);
    src.start();
    const bank=JSON.parse(bankElement.textContent), b64=atob(bank.audio),bytes=new Uint8Array(b64.length);
    for(let i=0;i<b64.length;i++)bytes[i]=b64.charCodeAt(i);
    cues=bank.cues;
    loading=ctx.decodeAudioData(bytes.buffer).then(buffer=>{
      sprite=buffer;bankElement.remove();return true;
    }).catch(error=>{console.warn('Field recordings unavailable:',error);return false;});
  }
  function gains(newPaused){
    paused=newPaused;
    if(!ctx)return;
    const now=ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(on&&!paused?.78:0,now,.065);
    if(!on||paused){
      encounter=null;stopBird(now);
      // Do not revive queued contacts after a quick mute/pause/resume.
      for(const voice of voices){
        try{voice.stop(now+.045);}catch{}
      }
    }
  }
  async function toggle(newPaused){
    const call=++request;
    if(on){on=false;gains(newPaused);return false;}
    try{
      if(!ctx)init();
      await ctx.resume();await loading;
      if(request!==call)return on;
      on=true;gains(paused);
    }catch(error){console.warn('Game audio unavailable:',error);return false;}
    return on;
  }
  function stopBird(now){
    if(birdVoice){
      const v=birdVoice;birdVoice=null;
      v.gain.gain.setTargetAtTime(0,now,.014);
      try{v.source.stop(now+.065);}catch{}
    }
  }
  function reset(){
    encounter=null;
    if(!ctx)return;
    stopBird(ctx.currentTime);
    for(const voice of voices)try{voice.stop(ctx.currentTime+.045);}catch{}
  }
  function record(event){
    if(debug){latest.push(event);if(latest.length>40)latest.shift();}
  }
  function clip(key,when,volume,pan,rate,cutoff,bus,drift=0,trim=0){
    const table=cues[key];
    let k=Math.min(table.length-1,Math.floor(roll()*table.length));
    if(k===lastSample[key])k=(k+1)%table.length;
    lastSample[key]=k;
    const [start,length]=table[k],source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=sprite;source.playbackRate.value=rate;
    filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.5;
    gain.gain.value=volume;
    source.connect(filter).connect(gain);
    if(ctx.createStereoPanner){
      const panner=ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan,when);
      if(drift)panner.pan.linearRampToValueAtTime(clamp(pan+drift,-.94,.94),when+length/rate);
      gain.connect(panner).connect(bus);
    }else gain.connect(bus);
    voices.add(source);
    source.onended=()=>{voices.delete(source);if(birdVoice?.source===source)birdVoice=null;};
    source.start(when,start+trim,length-trim);
    return {source,gain};

  }
  function tick(contacts,state){
    if(!on||paused||ctx?.state!=='running')return;
    const {speed,t,s,hour,rain,camera,visible}=state,now=ctx.currentTime;
    lastMix=mixForSpeed(speed);
    rainGain.gain.setTargetAtTime(rain*.24,now,.34);
    wind.gain.setTargetAtTime(lastMix.wind*(1+.16*rain),now,.32);
    const day=smooth(5.3,7,hour)*(1-smooth(18.2,20.5,hour));
    const birdWeight=day*(1-.93*rain);
    birdBus.gain.setTargetAtTime(birdWeight,now,.18);
    if(!sprite)return;
    const [a,b,blend]=blendAt(s);
    function panOf(x,y,z){
      const dx=x-camera.position.x,dy=y-camera.position.y,dz=z-camera.position.z;
      const distance=Math.max(1,Math.hypot(dx,dy,dz)),m=camera.matrixWorld.elements;
      return {distance,pan:clamp((dx*m[0]+dy*m[1]+dz*m[2])/distance,-.94,.94)};
    }
    // These are the contacts from the frame just drawn, not a metronome.
    // Keep diagonal pairs distinct, but never queue an old backlog when a frame stalls.
    contacts.sort((a,b)=>a.at-b.at);
    for(const hit of contacts){
      const {distance,pan}=panOf(hit.x,hit.y,hit.z);
      const surface=surfaces[roll()<blend?b:a];
      const rate=.96+.13*roll()+(hit.hoof<2?.015:-.031);
      const volume=(.24+.46*hit.force)*clamp(1.17-distance*.037,.57,.98)*(1-.17*rain)*(.92+.16*roll())*lastMix.hoof;
      const cutoff=(surface==='stone'?8250:surface==='gravel'?6300:4900)*(1-.39*rain);
      const lead=.003+clamp(hit.at-contacts[0].at,0,.016);
      clip(surface,now+lead,volume,clamp(.71*pan+hit.side*.105,-.90,.90),rate,cutoff,master,0,.012);
      counts.hoof[hit.hoof]++;counts.bySurface[surface]++;
      record({kind:'hoof',hoof:hit.hoof,at:hit.at,frame:t,queuedIn:lead,gain:volume,surface});
    }
    if(!visible||birdWeight<.13){
      encounter=null;stopBird(now);return;
    }
    if(lastFlock!==visible.id){
      lastFlock=visible.id;
      encounter=Math.random()<.74?{id:visible.id,due:t+.11+Math.random()**1.6*.81}:null;
    }
    if(encounter?.id===visible.id&&t>=encounter.due){
      const {x,y,z}=visible.point,{distance,pan}=panOf(x,y,z);
      const near=clamp(1-distance/155,.28,.81);
      birdVoice=clip('birds',now+.006,(.15+.08*roll())*near,pan,.97+.065*roll(),3600+3800*near,
        birdBus,Math.sign(pan||1)*(.05+.105*roll()));
      counts.birds++;
      record({kind:'bird',flock:visible.id,frame:t,visible:true});
      encounter=null;
    }
  }
  return {toggle,gains,tick,reset,active:()=>Boolean(on&&!paused&&ctx?.state==='running'),
    inspect:()=>({on,ready:!!sprite,paused,hoof:[...counts.hoof],birds:counts.birds,
      bySurface:{...counts.bySurface},mix:{...lastMix},birdPlaying:!!birdVoice,latest:[...latest]})};
}
