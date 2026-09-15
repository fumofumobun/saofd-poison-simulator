importScripts('./wasm-sim.js','./simulator.js');
let shared={base:null,skills:null,policies:null,rotations:null,compiledPolicies:null,compiledRotations:null};
const policyCache=new Map();
const rotationCache=new Map();
const scoreCache=new Map();
function cachedPolicyFromSpec(p){const k=[p.poisonThreshold,p.resistThreshold,p.urgent,p.highResist,p.defaultAction].join('|');let v=policyCache.get(k);if(v)return v;v={rules:[{type:'poison_le',value:p.poisonThreshold,action:p.urgent},{type:'resist_ge',value:p.resistThreshold,action:p.highResist}],defaultAction:p.defaultAction};policyCache.set(k,v);return v;}
function cachedRotation(rot){const k=(rot||[]).join(',');let v=rotationCache.get(k);if(v)return v;v=Object.freeze((rot||[]).slice());rotationCache.set(k,v);return v;}
// The custom WASM implementation is currently trusted only for hpmax.
// Crit/combo stay on the exact JS hot path until their bit-for-bit state/RNG
// behavior is proven against the reference implementation.
let wasmSafe={crit:false,combo:false,hpmax:false};
function policyFromSpec(p){return cachedPolicyFromSpec(p);}
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
async function scoreMany(cfgs){
  const out=new Array(cfgs.length);
  const misses=[];
  for(let i=0;i<cfgs.length;i++){
    const c=cfgs[i];
    const key=(c.trialStart?`range:${c.trialStart}|`:'')+JSON.stringify(c);
    const hit=scoreCache.get(key);if(hit){out[i]=hit;continue;}
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
          for(let k=0;k<misses.length;k++){out[misses[k].i]=r[k];scoreCache.set(misses[k].key,r[k]);}
          return out;
        }
        wasmSafe[effect]=false;
      }catch(e){ wasmSafe[effect]=false; }
    }
  }
  const rs=work.map(c=>runSimulationFast(c));
  if(rs.length!==work.length || rs.some(x=>!x || !Number.isFinite(x.uptime))) throw new Error('高速シミュレーション結果が不正です');
  for(let k=0;k<misses.length;k++){out[misses[k].i]=rs[k];scoreCache.set(misses[k].key,rs[k]);}
  return out;
}
self.onmessage=async function(ev){const d=ev.data||{};try{
 if(d.cmd==='init'){shared.base=d.base;shared.skills=d.skills;shared.policies=d.policies;shared.rotations=d.rotations;shared.compiledPolicies=(d.policies||[]).map(cachedPolicyFromSpec);shared.compiledRotations=(d.rotations||[]).map(cachedRotation);await ensureWasm();for(const ef of ['crit','combo','hpmax'])wasmSafe[ef]=await verifyWasmForEffect(ef);self.postMessage({cmd:'init-ok',wasmSafe});return;}
 if(d.cmd==='screen'){const eq=d.equipment,base=shared.base,rots=shared.compiledRotations||shared.rotations||[];const cfgs=rots.map(rot=>({...base,equipment:eq,rotation:rot,policy:null,duration:d.duration,trials:d.trials,seed:d.seed}));const rs=await scoreMany(cfgs);if(rs.length!==cfgs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('screen結果が不正です');let best=null,row=[];for(let i=0;i<rs.length;i++){const x={rotation:rots[i],score:rs[i].uptime};row.push(x);if(!best||x.score>best.score)best=x;}self.postMessage({cmd:'result',id:d.id,result:{best,row}});return;}
 if(d.cmd==='policyScreen'){const eq=d.equipment,base=shared.base,ps=shared.policies||[],fallback=cachedRotation(d.fallback);const cfgs=ps.map((p,i)=>({...base,equipment:eq,rotation:fallback,policy:(shared.compiledPolicies&&shared.compiledPolicies[i])||policyFromSpec(p),duration:d.duration,trials:d.trials,seed:d.seed}));const rs=await scoreMany(cfgs);if(rs.length!==cfgs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('policyScreen結果が不正です');const out=rs.map((r,i)=>({index:i,score:r.uptime}));out.sort((a,b)=>b.score-a.score);self.postMessage({cmd:'result',id:d.id,result:{top:out.slice(0,64)}});return;}
 if(d.cmd==='policyExpand'){const eq=d.equipment,base=shared.base,rots=shared.compiledRotations||shared.rotations||[],ps=shared.policies||[],leaders=d.leaders||[];const jobs=[];for(const leader of leaders){const p=ps[leader.index];for(const rot of rots)jobs.push({leader,rot,c:{...base,equipment:eq,rotation:rot,policy:policyFromSpec(p),duration:d.duration,trials:d.trials,seed:d.seed}});}const rs=await scoreMany(jobs.map(x=>x.c));if(rs.length!==jobs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('policyExpand結果が不正です');const bests=[];for(let i=0;i<leaders.length;i++){let best=null;for(let j=0;j<rots.length;j++){const z=jobs[i*rots.length+j],sc=rs[i*rots.length+j].uptime;if(!best||sc>best.score)best={index:z.leader.index,score:sc,rotation:z.rot};}bests.push(best);}self.postMessage({cmd:'result',id:d.id,result:{bests}});return;}
 if(d.cmd==='batchRun'){const list=d.candidates||[];const rs=await scoreMany(list);if(rs.length!==list.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('batchRun結果が不正です');self.postMessage({cmd:'batchResult',id:d.id,results:rs});return;}
 if(d.cmd==='run'){const rs=await scoreMany([d.cfg]);if(!rs[0]||!Number.isFinite(rs[0].uptime))throw new Error('run結果が不正です');self.postMessage({cmd:'result',id:d.id,result:rs[0]});return;}
}catch(error){self.postMessage({cmd:'error',id:d.id,error:String(error&&error.message||error)});}};
