import * as T from 'three';
import {at,wrap,segmentAt,random,CHUNK,COUNT} from './route.js';
import {buildTerrain,addFarGround} from './terrain.js';
import {buildTown} from '../scenes/town.js';
import {buildMeadow} from '../scenes/meadow.js';
import {buildRidge} from '../scenes/ridge.js';

const builders=[buildTown,buildMeadow,buildRidge];
const mod=n=>(n+COUNT)%COUNT;
export function createChunks(scene){
  const chunks=new Map(),windTime={value:0};
  let current=-1,created=0,disposed=0;
  addFarGround(scene);
  function build(index){
    const group=new T.Group(),start=index*CHUNK,owned=new Set();
    group.name='route-chunk-'+index;
    const ctx={group,start,end:start+CHUNK,index,at,random:random(1919+index*9781),windTime,
      own:resource=>{owned.add(resource);return resource;}};
    buildTerrain(ctx);builders[segmentAt(start)](ctx);
    scene.add(group);chunks.set(index,{group,owned});created++;
  }
  function update(s,t){
    windTime.value=t;
    const index=Math.floor(wrap(s)/CHUNK);
    if(index===current)return;
    const wanted=new Set();
    for(let k=-3;k<=5;k++)wanted.add(mod(index+k));
    // Drop old chunks before adding new ones so live geometry stays bounded.
    for(const [id,{group,owned}] of chunks)if(!wanted.has(id)){
      scene.remove(group);
      group.traverse(o=>{if(o.isInstancedMesh&&!owned.has(o))o.dispose();});
      for(const disposable of owned)disposable.dispose();
      chunks.delete(id);disposed++;
    }
    for(const k of wanted)if(!chunks.has(k))build(k);
    current=index;
  }
  update.inspect=()=>({current,live:chunks.size,created,disposed,indices:[...chunks.keys()].sort((a,b)=>a-b)});
  return update;
}
