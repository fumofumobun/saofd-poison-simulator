importScripts('./wasm-sim.js','./simulator.js');
let shared={base:null,skills:null,skillsFingerprint:'',policyCount:0,policyMeta:null,rotations:null,compiledRotations:null};
const policyCache=new Map();
const rotationCache=new Map();
const scoreCache=new Map();
const wasmSafe={crit:false,combo:false,hpmax:false};
function cachedPolicyFromSpec(p){
  const k=Array.isArray(p.segmentActions)?`K${p.segmentCount}|${p.segmentActions.join(',')}`:[p.poisonThreshold,p.successStreak,p.urgent,p.highSuccess,p.defaultAction].join('|');
  let v=policyCache.get(k); if(v)return v;
  v=Array.isArray(p.segmentActions)
    ? {segmentActions:p.segmentActions,segmentCount:p.segmentCount,ailmentDuration:p.ailmentDuration}
    : {rules:[{type:'poison_le',value:p.poisonThreshold,action:p.urgent},{type:'success_streak_ge',value:p.successStreak,action:p.highSuccess}],defaultAction:p.defaultAction};
  if(policyCache.size>=4096)policyCache.delete(policyCache.keys().next().value); policyCache.set(k,v); return v;
}
function buildPolicyMeta(){
  const base=shared.base||{}, D=Math.max(0,Number(base.ailmentDuration)||0);
  const K=Math.max(2,Math.min(5,Math.floor(Number(base.policySegments)||4)));
  const specs=[]; const total=Math.pow(4,K);
  for(let n=0;n<total;n++){let x=n;const actions=new Array(K);for(let i=0;i<K;i++){actions[i]=x&3;x>>=2;}specs.push({segmentCount:K,segmentActions:actions,ailmentDuration:D});}
  shared.policyMeta={specs}; shared.policyCount=specs.length;
}
function policySpecAt(i){
  const m=shared.policyMeta; if(!m||i<0||i>=m.specs.length)throw new Error('policy index out of range');
  return m.specs[i];
}
function policyAt(i){return cachedPolicyFromSpec(policySpecAt(i));}
let wasmInitDone=false;
async function ensureWasm(){if(wasmInitDone)return !!wasmBatchInstance; wasmInitDone=true; return await initWasmBatch();}
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
  // Correctness gate: enable an effect only when the WASM implementation
  // matches the reference simulator across the deterministic test suite.
  // This is intentionally an exactness check, not a performance heuristic.
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
    return (c.skillsFingerprint||JSON.stringify(c.skills||[]))===shared.skillsFingerprint;
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
  if(work.length && !work[0].policy && await ensureWasm()){
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

function psIndex(v){
  const D=Math.max(0,Number(shared.base?.ailmentDuration)||0), duration=Math.max(0,Number(shared.base?.duration)||0);
  const ps=[...new Set([0,0.5,1,2,3,5,7,9,Math.min(D,duration)].map(x=>Math.round(x*1e9)/1e9))];
  return ps.indexOf(Math.round(Number(v)*1e9)/1e9);
}
self.onmessage=async function(ev){const d=ev.data||{};try{
 if(d.cmd==='init'){shared.base=d.base;shared.skills=d.skills;shared.skillsFingerprint=JSON.stringify(d.skills||[]);shared.rotations=d.rotations;buildPolicyMeta();shared.compiledRotations=(d.rotations||[]).map(cachedRotation);await ensureWasm();for(const ef of ['crit','combo','hpmax'])wasmSafe[ef]=await verifyWasmForEffect(ef);self.postMessage({cmd:'init-ok',wasmSafe});return;}
 if(d.cmd==='screen'){const eq=d.equipment,base=shared.base,rots=d.rotationsOverride||shared.compiledRotations||shared.rotations||[];const cfgs=rots.map(rot=>({...base,equipment:eq,rotation:rot,policy:null,duration:d.duration,trials:d.trials,seed:d.seed}));const rs=await scoreMany(cfgs);if(rs.length!==cfgs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('screen結果が不正です');let best=null,row=[];for(let i=0;i<rs.length;i++){const x={rotation:rots[i],score:rs[i].uptime};row.push(x);if(!best||x.score>best.score)best=x;}self.postMessage({cmd:'result',id:d.id,result:{best,row}});return;}
 if(d.cmd==='policyScreen'){
  const eq=d.equipment,base=shared.base,fallback=cachedRotation(d.fallback),count=shared.policyCount;
  // Two modes:
  //  1) policyIndices: evaluate an explicit small beam selected globally.
  //  2) exhaustive: evaluate the complete 1536-policy lattice for a few
  //     representative equipment states.  This moves the expensive search
  //     from "every equipment × every policy" to "few representatives × all
  //     policies", then tests the resulting beam against all equipment.
  const explicit=Array.isArray(d.policyIndices)?d.policyIndices.filter(i=>Number.isInteger(i)&&i>=0&&i<count):null;
  let indices=[];
  const seen=new Set();
  const push=i=>{if(i>=0&&i<count&&!seen.has(i)){seen.add(i);indices.push(i);}};
  if(explicit && explicit.length){for(const i of explicit)push(i);}
  else if(d.exhaustive===true){for(let i=0;i<count;i++)push(i);}
  else{
    const budget=Math.max(32,Math.min(count,Number(d.policyBudget)||96));
    push(0);push(count-1);
    const anchorBudget=Math.min(budget,Math.max(24,Math.floor(budget*0.58)));
    const stride=Math.max(1,Math.ceil(count/anchorBudget));
    for(let i=0;i<count&&indices.length<anchorBudget;i+=stride)push(i);
    for(let i=count-1;i>=0&&indices.length<anchorBudget;i-=stride)push(i);
    const refineBudget=Math.min(count,Math.max(0,budget-indices.length));
    if(refineBudget>0 && indices.length){
      // Add deterministic one-coordinate neighbours around the best sampled
      // anchors. This is retained only for legacy callers.
      const provisional=indices.slice(0,Math.min(8,indices.length));
      const ranges=[
        [0,0.5,1,2,3,5,7,9], [1,2,3], [0,1,2,3], [0,1,2,3], [0,1,2,3]
      ];
      for(const idx of provisional){
        const pp=policySpecAt(idx), vals=[pp.poisonThreshold,pp.successStreak,pp.urgent,pp.highSuccess,pp.defaultAction];
        for(let dim=0;dim<5;dim++)for(const v of ranges[dim]){
          if(v===vals[dim])continue;
          const q=vals.slice();q[dim]=v;
          const ps=shared.base?psIndex(q[0]):-1;
          if(ps<0)continue;
          const pi=((((ps*3+(q[1]-1))*4+q[2])*4+q[3])*4+q[4]);
          push(pi); if(indices.length>=budget)break;
        }
        if(indices.length>=budget)break;
      }
    }
  }
  const scoreIndices=async(ids)=>{
    const all=[]; const chunk=128;
    for(let begin=0;begin<ids.length;begin+=chunk){
      const part=ids.slice(begin,begin+chunk);
      const cfgs=part.map(i=>({...base,equipment:eq,rotation:fallback,policy:policyAt(i),duration:d.duration,trials:d.trials,seed:d.seed}));
      const rs=await scoreMany(cfgs,false);
      if(rs.length!==cfgs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('policyScreen結果が不正です');
      for(let j=0;j<rs.length;j++)all.push({index:part[j],score:rs[j].uptime});
    }
    return all;
  };
  let out=await scoreIndices(indices);
  out.sort((a,b)=>b.score-a.score);
  self.postMessage({cmd:'result',id:d.id,result:{top:out.slice(0,64),evaluated:seen.size,total:count}});return;
}
 if(d.cmd==='policyExpand'){const eq=d.equipment,base=shared.base,rots=shared.compiledRotations||shared.rotations||[],leaders=d.leaders||[];const jobs=[];for(const leader of leaders){if(leader.index<0||leader.index>=shared.policyCount)throw new Error('policy index out of range');const p=policySpecAt(leader.index);for(const rot of rots)jobs.push({leader,rot,c:{...base,equipment:eq,rotation:rot,policy:policyFromSpec(p),duration:d.duration,trials:d.trials,seed:d.seed}});}const rs=await scoreMany(jobs.map(x=>x.c));if(rs.length!==jobs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('policyExpand結果が不正です');const bests=[];for(let i=0;i<leaders.length;i++){let best=null;for(let j=0;j<rots.length;j++){const z=jobs[i*rots.length+j],sc=rs[i*rots.length+j].uptime;if(!best||sc>best.score)best={index:z.leader.index,score:sc,rotation:z.rot};}bests.push(best);}self.postMessage({cmd:'result',id:d.id,result:{bests}});return;}
 if(d.cmd==='batchRun'){const list=d.candidates||[];const rs=await scoreMany(list);if(rs.length!==list.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('batchRun結果が不正です');self.postMessage({cmd:'batchResult',id:d.id,results:rs});return;}
 if(d.cmd==='run'){const rs=await scoreMany([d.cfg]);if(!rs[0]||!Number.isFinite(rs[0].uptime))throw new Error('run結果が不正です');self.postMessage({cmd:'result',id:d.id,result:rs[0]});return;}
}catch(error){self.postMessage({cmd:'error',id:d.id,error:String(error&&error.message||error)});}};
