importScripts('./wasm-sim.js','./simulator.js');
let shared={base:null,skills:null,policyCount:0,policyMeta:null,rotations:null,compiledRotations:null};
const policyCache=new Map();
const rotationCache=new Map();
const scoreCache=new Map();
const wasmSafe={crit:false,combo:false,hpmax:false};
function cachedPolicyFromSpec(p){
  const k=[p.poisonThreshold,p.successStreak,p.urgent,p.highSuccess,p.defaultAction].join('|');
  let v=policyCache.get(k); if(v)return v;
  v={rules:[{type:'poison_le',value:p.poisonThreshold,action:p.urgent},{type:'success_streak_ge',value:p.successStreak,action:p.highSuccess}],defaultAction:p.defaultAction};
  if(policyCache.size>=4096)policyCache.delete(policyCache.keys().next().value); policyCache.set(k,v); return v;
}
function buildPolicyMeta(){
  const base=shared.base||{}, D=Math.max(0,Number(base.ailmentDuration)||0), duration=Math.max(0,Number(base.duration)||0), q=v=>Math.round(v*1e9)/1e9;
  const ps=[...new Set([0,0.5,1,2,3,5,7,9,Math.min(D,duration)].map(q))];
  const specs=[];
  for(const P of ps) for(let successStreak=1;successStreak<=3;successStreak++)
    for(let urgent=0;urgent<=3;urgent++) for(let highSuccess=0;highSuccess<=3;highSuccess++)
      for(let def=0;def<=3;def++) specs.push({poisonThreshold:P,successStreak,urgent,highSuccess,defaultAction:def});
  shared.policyMeta={specs}; shared.policyCount=specs.length;
}
function policySpecAt(i){
  const m=shared.policyMeta; if(!m||i<0||i>=m.specs.length)throw new Error('policy index out of range');
  return m.specs[i];
}
function policyAt(i){return cachedPolicyFromSpec(policySpecAt(i));}
async function ensureWasm(){return await initWasmBatch();}
function sameScore(a,b){return Math.abs((a?.uptime??0)-(b?.uptime??0))<1e-12;}
async function verifyWasmForEffect(effect){
  if(!await ensureWasm()) return false;
  const b={...shared.base,duration:Math.min(6,Number(shared.base.duration)||6),trials:4,seed:0x1234ABCD,specialEffect:effect,rotation:[1,2,3],policy:null};
  const cases=[
    {...b},
    {...b,equipment:{poisonHit:52,ailment:17.5,ctPromo:24,instant:44}},
    {...b,equipment:{poisonHit:0,ailment:35,ctPromo:0,instant:0}},
    {...b,rotation:[3,1,2]},
    {...b,rotation:[2,3,1]},
    {...b,trials:7,trialStart:3},
    {...b,trials:11,trialStart:17,equipment:{poisonHit:31,ailment:8,ctPromo:12,instant:22}},
    {...b,duration:13,trials:5,seed:0x89ABCDEF,rotation:[3,2,1],equipment:{poisonHit:73,ailment:0,ctPromo:36,instant:66}},
    {...b,duration:2.25,trials:9,seed:0x10203040,equipment:{poisonHit:13,ailment:7,ctPromo:12,instant:22}},
    {...b,duration:19,trials:6,seed:0x55667788,rotation:[1,3,2],equipment:{poisonHit:100,ailment:25,ctPromo:0,instant:0}}
  ];
  // Do not enable known-problematic custom implementations. This is a
  // correctness gate, not a performance heuristic.
  if(effect!=='hpmax') return false;
  try{
    // Each case is isolated because the WASM batch ABI shares scalar settings
    // from candidate 0.  Also compare a deterministic family of cases rather
    // than only one happy-path sample.
    for(const c of cases){
      const got=wasmBatchScores([c]);
      const ref=runSimulation(c);
      if(!got||got.length!==1||!got[0]||!Number.isFinite(got[0].uptime)||!sameScore(got[0],ref))return false;
    }
    for(let i=0;i<64;i++){
      const c={...b, duration:1.5+(i%17)*1.25, trials:3+(i%9), trialStart:i%23,
        seed:(0x9E3779B9 + Math.imul(i,0x6D2B79F5))>>>0,
        equipment:{poisonHit:(i*13)%101,ailment:(i*7)%31,ctPromo:(i*11)%49,instant:(i*17)%67},
        rotation:[[1,2,3],[2,3,1],[3,1,2]][i%3], hpMaxUptime:(i*19)%101};
      const got=wasmBatchScores([c]);
      const ref=runSimulation(c);
      if(!got||got.length!==1||!got[0]||!Number.isFinite(got[0].uptime)||!sameScore(got[0],ref))return false;
    }
    return true;
  }catch(e){return false;}
}
function wasmCompatible(work,effect){
  if(!work.length)return false;
  const first=work[0];
  const scalar=['duration','trials','baseResist','rise','fall','ailmentDuration','critRate','normalHpm','normalHps','normalRangedRate','comboSuccessRate','hpMaxUptime','seed'];
  return work.every(c=>{
    if(c.policy)return false;
    if((c.specialEffect||'crit')!==effect)return false;
    for(const k of scalar){
      const a=k==='normalHps'?first.normalHps:first[k], b=k==='normalHps'?c.normalHps:c[k];
      if(Number(a??0)!==Number(b??0))return false;
    }
    return JSON.stringify(c.skills||[])===JSON.stringify(first.skills||[]);
  });
}
async function scoreMany(cfgs,useCache=true){
  const out=new Array(cfgs.length);
  const misses=[];
  for(let i=0;i<cfgs.length;i++){
    const c=cfgs[i];
    const key=useCache?((c.trialStart?`range:${c.trialStart}|`:'')+JSON.stringify(c)):'';
    const hit=useCache?scoreCache.get(key):null;if(hit){out[i]=hit;continue;}
    misses.push({i,c,key});
  }
  if(!misses.length)return out;
  const work=misses.map(x=>x.c);
  if(work.length && await ensureWasm()){
    const effect=work[0].specialEffect||'crit';
    if(wasmSafe[effect] && wasmCompatible(work,effect)){
      try{
        const r=wasmBatchScores(work);
        if(r && r.length===work.length && r.every(x=>x && Number.isFinite(x.uptime))){
          for(let k=0;k<misses.length;k++){out[misses[k].i]=r[k];if(useCache)scoreCache.set(misses[k].key,r[k]);}
          return out;
        }
        wasmSafe[effect]=false;
      }catch(e){ wasmSafe[effect]=false; }
    }
  }
  const rs=work.map(c=>runSimulationFast(c));
  if(rs.length!==work.length || rs.some(x=>!x || !Number.isFinite(x.uptime))) throw new Error('高速シミュレーション結果が不正です');
  for(let k=0;k<misses.length;k++){out[misses[k].i]=rs[k];if(useCache)scoreCache.set(misses[k].key,rs[k]);}
  return out;
}
self.onmessage=async function(ev){const d=ev.data||{};try{
 if(d.cmd==='init'){shared.base=d.base;shared.skills=d.skills;shared.rotations=d.rotations;buildPolicyMeta();shared.compiledRotations=(d.rotations||[]).map(cachedRotation);await ensureWasm();for(const ef of ['crit','combo','hpmax'])wasmSafe[ef]=await verifyWasmForEffect(ef);self.postMessage({cmd:'init-ok',wasmSafe});return;}
 if(d.cmd==='screen'){const eq=d.equipment,base=shared.base,rots=shared.compiledRotations||shared.rotations||[];const cfgs=rots.map(rot=>({...base,equipment:eq,rotation:rot,policy:null,duration:d.duration,trials:d.trials,seed:d.seed}));const rs=await scoreMany(cfgs);if(rs.length!==cfgs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('screen結果が不正です');let best=null,row=[];for(let i=0;i<rs.length;i++){const x={rotation:rots[i],score:rs[i].uptime};row.push(x);if(!best||x.score>best.score)best=x;}self.postMessage({cmd:'result',id:d.id,result:{best,row}});return;}
 if(d.cmd==='policyScreen'){
  const eq=d.equipment,base=shared.base,fallback=cachedRotation(d.fallback),count=shared.policyCount;
  // Deterministic coarse screening: evaluate a bounded, evenly stratified set of
  // policy indices. This stage is only a screen; finalists are re-evaluated with
  // the full-precision race. No random sampling is used.
  const budget=Math.max(512,Math.min(8192,Number(d.policyBudget)||4096));
  const top=[];let minIndex=-1,minScore=Infinity;
  const addTop=(index,score)=>{if(top.length<64){top.push({index,score});if(score<minScore){minScore=score;minIndex=top.length-1;}}else if(score>minScore){top[minIndex]={index,score};minIndex=0;minScore=top[0].score;for(let k=1;k<top.length;k++)if(top[k].score<minScore){minScore=top[k].score;minIndex=k;}}};
  const seen=new Set(),indices=[];
  const push=i=>{if(i>=0&&i<count&&!seen.has(i)){seen.add(i);indices.push(i);}};
  // Always include the first/last policy and boundaries of each metadata block.
  push(0);push(count-1);
  // buildPolicyMeta stores the complete flat policy list; it does not expose
  // block metadata. Keep the screen independent of optional block data so
  // mobile/desktop workers use the same deterministic policy set.
  push(0);push(count-1);
  // Then fill the remaining budget by a deterministic uniform stride.
  const stride=Math.max(1,Math.ceil(count/Math.max(1,budget-indices.length)));
  for(let i=0;i<count&&indices.length<budget;i+=stride)push(i);
  // If the stride left a gap because of duplicate boundary indices, fill from the
  // tail deterministically.
  for(let i=count-1;i>=0&&indices.length<budget;i--)push(i);
  const chunk=128;
  for(let begin=0;begin<indices.length;begin+=chunk){
    const ids=indices.slice(begin,begin+chunk),cfgs=ids.map(i=>({...base,equipment:eq,rotation:fallback,policy:policyAt(i),duration:d.duration,trials:d.trials,seed:d.seed}));
    const rs=await scoreMany(cfgs,false);
    if(rs.length!==cfgs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('policyScreen結果が不正です');
    for(let j=0;j<rs.length;j++)addTop(ids[j],rs[j].uptime);
    if(((begin/chunk)&7)===0)await Promise.resolve();
  }
  top.sort((a,b)=>b.score-a.score);
  self.postMessage({cmd:'result',id:d.id,result:{top:top.slice(0,64),evaluated:indices.length,total:count}});return;}
 if(d.cmd==='policyExpand'){const eq=d.equipment,base=shared.base,rots=shared.compiledRotations||shared.rotations||[],leaders=d.leaders||[];const jobs=[];for(const leader of leaders){if(leader.index<0||leader.index>=shared.policyCount)throw new Error('policy index out of range');const p=policySpecAt(leader.index);for(const rot of rots)jobs.push({leader,rot,c:{...base,equipment:eq,rotation:rot,policy:policyFromSpec(p),duration:d.duration,trials:d.trials,seed:d.seed}});}const rs=await scoreMany(jobs.map(x=>x.c));if(rs.length!==jobs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('policyExpand結果が不正です');const bests=[];for(let i=0;i<leaders.length;i++){let best=null;for(let j=0;j<rots.length;j++){const z=jobs[i*rots.length+j],sc=rs[i*rots.length+j].uptime;if(!best||sc>best.score)best={index:z.leader.index,score:sc,rotation:z.rot};}bests.push(best);}self.postMessage({cmd:'result',id:d.id,result:{bests}});return;}
 if(d.cmd==='batchRun'){const list=d.candidates||[];const rs=await scoreMany(list);if(rs.length!==list.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('batchRun結果が不正です');self.postMessage({cmd:'batchResult',id:d.id,results:rs});return;}
 if(d.cmd==='run'){const rs=await scoreMany([d.cfg]);if(!rs[0]||!Number.isFinite(rs[0].uptime))throw new Error('run結果が不正です');self.postMessage({cmd:'result',id:d.id,result:rs[0]});return;}
}catch(error){self.postMessage({cmd:'error',id:d.id,error:String(error&&error.message||error)});}};
