import * as T from 'three';
import {wrap,segmentAt,sections,random,CHUNK,COUNT} from './route.js';
import {buildTerrain,addFarGround,addTarn} from './terrain.js';
import {buildTown} from '../scenes/town.js';
import {buildMeadow} from '../scenes/meadow.js';
import {buildRidge} from '../scenes/ridge.js';
import {buildValley,buildPlateau} from '../scenes/pass.js';
import {createFrame} from './frame.js';

const builders=[buildTown,buildMeadow,buildRidge,buildValley,buildPlateau];
const mod=n=>(n+COUNT)%COUNT;
export function createChunks(scene){
  const chunks=new Map(),windTime={value:0};
  let current=-1,created=0,disposed=0;
  const planet=new T.Group();planet.name="planet";planet.matrixAutoUpdate=false;scene.add(planet);
  const far=addFarGround(planet);addTarn(planet,windTime);
  function build(index){
    const group=new T.Group(),start=index*CHUNK,owned=new Set();
    group.name='route-chunk-'+index;
    const frame=createFrame(start+CHUNK/2);
    group.matrixAutoUpdate=false;group.matrix.copy(frame.toPlanet);
    const ctx={group,start,end:start+CHUNK,index,frame,at:frame.at,ground:frame.ground,random:random(1919+index*9781),windTime,
      own:resource=>{owned.add(resource);return resource;}};
    buildTerrain(ctx);builders[sections[segmentAt(start)].scenery](ctx);
    far[index].visible=false;planet.add(group);chunks.set(index,{group,owned});created++;
  }
  function update(s,t){
    windTime.value=t;
    const index=Math.floor(wrap(s)/CHUNK);
    if(index===current)return;
    const wanted=new Set();
    for(let k=-3;k<=5;k++)wanted.add(mod(index+k));
    // Drop old chunks before adding new ones so live geometry stays bounded.
    for(const [id,{group,owned}] of chunks)if(!wanted.has(id)){
      planet.remove(group);far[id].visible=true;
      group.traverse(o=>{if(o.isInstancedMesh&&!owned.has(o))o.dispose();});
      for(const disposable of owned)disposable.dispose();
      chunks.delete(id);disposed++;
    }
    for(const k of wanted)if(!chunks.has(k))build(k);
    current=index;
  }
  update.frame=frame=>{planet.matrix.copy(frame.fromPlanet);planet.matrixWorldNeedsUpdate=true;};
  update.inspect=()=>({current,live:chunks.size,farHidden:far.filter(m=>!m.visible).length,created,disposed,indices:[...chunks.keys()].sort((a,b)=>a-b)});
  return update;
}
