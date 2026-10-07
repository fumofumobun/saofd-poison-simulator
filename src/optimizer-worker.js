// v27.69 runtime-minimal worker bootstrap: production optimizer dependencies only.
importScripts('./wasm-sim.js','./simulator.js','./full-sim8.js');
let shared={base:null,skills:null,skillsFingerprint:'',policyCount:0,policyMeta:null,rotations:null,compiledRotations:null};
const policyCache=new Map();
const rotationCache=new Map();
const scoreCache=new Map();
const wasmSafe={crit:false,combo:false,hpmax:false};
const fullSim8GateCache=new Map();
let fullSimCandidateSafe=false;
const SCORE_CACHE_MAX=8192;
const FULLSIM_MIN_TRIALS=16;
const POLICY_TREE_PRODUCTION_ENABLED=false; // disabled until full differential parity is proven
function scoreCacheSet(k,v){if(!k)return;if(scoreCache.size>=SCORE_CACHE_MAX)scoreCache.delete(scoreCache.keys().next().value);scoreCache.set(k,v);}
function pushTop(top,item,limit=16){
  let i=top.length; while(i>0){const p=top[i-1];const better=item.score>p.score || (item.score===p.score && (item.index<p.index || (item.index===p.index && String(item.rotation||'')<String(p.rotation||''))));if(!better)break;i--;}
  top.splice(i,0,item);if(top.length>limit)top.length=limit;
}
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
function cachedRotation(rot){
  const a=Array.isArray(rot)?rot:[]; const k=a.join(',');
  const hit=rotationCache.get(k); if(hit)return hit;
  const v=Int8Array.from(a.filter(n=>Number.isInteger(n)&&n>=1&&n<=((shared.skills||[]).length||3)),n=>n-1);
  if(rotationCache.size>=64)rotationCache.delete(rotationCache.keys().next().value);
  rotationCache.set(k,v); return v;
}
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
function fullSim8GateKey(cfg){
  const pick=(v)=>Array.isArray(v)?v.map(Number):v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>{o[k]=pick(v[k]);return o;},{}):typeof v==='number'?Number(v):v;
  const x={baseResist:cfg.baseResist,rise:cfg.rise,fall:cfg.fall,ailmentDuration:cfg.ailmentDuration,duration:cfg.duration,
    critRate:cfg.critRate,normalHpm:cfg.normalHpm,normalHps:cfg.normalHps,normalRangedRate:cfg.normalRangedRate,
    comboSuccessRate:cfg.comboSuccessRate,hpMaxUptime:cfg.hpMaxUptime,specialEffect:cfg.specialEffect||'crit',
    equipment:pick(cfg.equipment||{}),skills:pick(cfg.skills||[]),policy:pick(cfg.policy||{}),rotation:pick(cfg.rotation||[]),
    seed:cfg.seed||0};
  return JSON.stringify(x);
}
async function verifyFullSim8(cfg){
  if(!cfg||!cfg.policy||!Array.isArray(cfg.policy.segmentActions))return false;
  const key=fullSim8GateKey(cfg),cached=fullSim8GateCache.get(key);
  if(cached)return cached;
  const promise=(async()=>{
    try{
      // First compare the complete event/state trace, not merely the final score.
      // Use several non-contiguous starts so RNG-consumption and scheduler errors
      // that only appear after the first lane are not silently accepted.
      // Gate the kernel across nearby and distant trial indices.  trialStart is
      // deliberately not part of the cache key: the kernel is certified for
      // deterministic seed-index mapping, so split final races can reuse the
      // same verified configuration for their suffix range.
      const starts=[0,1,7,31,127,1023];
      const td=await SAOFDFullSim8WASM.firstDivergenceBatch({...cfg,trials:1,trialStart:0},starts,{compareSchedulerDebug:false});
      if(!td||!td.ok)return false;
      // Then compare the production kernel's scalar outputs over the same starts.
      const r=await SAOFDFullSim8WASM.differentialBatch(cfg,starts);
      return !!r.ok;
    }catch(e){return false;}
  })();
  fullSim8GateCache.set(key,promise);
  return await promise;
}

async function scoreOneFullSim8(c){
  if(!(await SAOFDFullSim8WASM.init()))return null;
  const trials=Math.max(1,Math.floor(c.trials||1)),start=Math.max(0,Math.floor(c.trialStart||0));
  const x=SAOFDFullSim8WASM.make();SAOFDFullSim8WASM.fillFromCfg(x,c,start);SAOFDFullSim8WASM.prepare(x);
  let sum=0,max=0,count=0;
  // For long final Monte-Carlo ranges the simulation body, not the ABI crossing,
  // dominates.  Eight-trial groups benchmark faster than the nested range wrapper
  // on compute-heavy 600s cases, so retain this path and let runPrepared select
  // the fixed-mode native kernel.
  for(let n=start;n<start+trials;n+=8){
    SAOFDFullSim8WASM.setTrialLaneSeeds(x,c,n);SAOFDFullSim8WASM.runPrepared(x,true);
    const take=Math.min(8,start+trials-n);
    for(let j=0;j<take;j++){sum+=x.outUptime[j];max=Math.max(max,x.outMaxRes[j]);count++;}
  }
  return {uptime:sum/count,maxRes:max};
}

async function verifyCandidateSIMD(){
  try{
    if(!(await SAOFDFullSim8WASM.init()))return false;
    const base=shared.base||{},rots=shared.rotations||[[1,2,3],[2,3,1],[3,1,2]],K=Math.max(2,Math.min(5,Math.floor(Number(base.policySegments)||4)));
    const durations=[Math.min(Math.max(4,Number(base.duration)||23),18),Math.min(Math.max(4,Number(base.duration)||23),90),Math.max(4,Number(base.duration)||23)];
    const starts=[0,31,127];
    // Cover all 15 fallback rotations in two 8-lane batches, plus broad
    // equipment/policy extremes. All other battle scalars stay identical to the
    // actual optimization run, which is exactly how candidate-SIMD is used.
    const cfgs=Array.from({length:16},(_,i)=>({...base,trials:1,trialStart:0,
      seed:0x51F15EED,
      equipment:{poisonHit:[0,1,25,50,75,100,33,67][i&7],ailment:[0,5,10,20,35,0,17,29][i&7],ctPromo:[0,8,16,24,40,48,13,31][i&7],instant:[0,10,20,40,60,80,27,53][i&7]},
      rotation:rots[i%rots.length]||[1,2,3],
      policy:{segmentCount:K,segmentActions:Array.from({length:K},(_,j)=>(i+j*3)&3),ailmentDuration:Number(base.ailmentDuration)||10}}));
    for(const dur0 of durations){
      const dur=Math.max(0.25,Number(dur0)||4);
      for(let b=0;b<cfgs.length;b+=8){
        const part=cfgs.slice(b,b+8).map(c=>({...c,duration:dur})),x=SAOFDFullSim8WASM.make();
        SAOFDFullSim8WASM.fillFromCfgs(x,part,0);SAOFDFullSim8WASM.prepare(x);
        for(const st of starts){
          SAOFDFullSim8WASM.setCandidateTrialSeeds(x,part,st);SAOFDFullSim8WASM.runPrepared(x,true);
          for(let i=0;i<part.length;i++){
            const ref=runSimulationFast({...part[i],trialStart:st,trials:1});
            if(!ref||Math.abs(Number(x.outUptime[i])-Number(ref.uptime))>1e-12)return false;
          }
        }
      }
      // Gate the v27.69 whole-matrix path itself, including multi-trial seed
      // stepping, before any sibling worker is allowed to trust this result.
      if(SAOFDFullSim8WASM.runCandidateMatrix){
        for(const st of [0,7])for(const tr of [1,3]){
          const part=cfgs.map(c=>({...c,duration:dur,trialStart:st,trials:tr}));
          const got=SAOFDFullSim8WASM.runCandidateMatrix(part);
          if(!got||got.length!==part.length)return false;
          for(let i=0;i<part.length;i++){const ref=runSimulationFast(part[i]);if(!ref||Math.abs(Number(got[i].uptime)-Number(ref.uptime))>1e-12||Math.abs(Number(got[i].maxRes??0)-Number(ref.maxRes??got[i].maxRes??0))>1e-12)return false;}
        }
      }
    }
    return true;
  }catch(e){return false;}
}
async function scoreManyCandidateSIMD(cfgs){
  if(!fullSimCandidateSafe||!cfgs.length)return null;
  const first=cfgs[0],trials=Math.max(1,Math.floor(first.trials||1)),trialStart=Math.max(0,Math.floor(first.trialStart||0));
  const scalar=['duration','baseResist','rise','fall','ailmentDuration','critRate','normalHpm','normalHps','normalRangedRate','comboSuccessRate','hpMaxUptime','specialEffect'];
  if(!cfgs.every(c=>c&&c.policy&&Array.isArray(c.policy.segmentActions)&&Math.max(1,Math.floor(c.trials||1))===trials&&Math.max(0,Math.floor(c.trialStart||0))===trialStart&&(c.skillsFingerprint||JSON.stringify(c.skills||[]))===shared.skillsFingerprint&&scalar.every(k=>Number.isFinite(Number(first[k]))||Number.isFinite(Number(c[k]))?Number(first[k]??0)===Number(c[k]??0):(first[k]??'')===(c[k]??''))))return null;
  const out=new Array(cfgs.length);
  // v27.69: score the whole compatible shard in one native call. This removes
  // per-8-candidate object allocation, skill recompilation, ABI copies, and
  // JS<->WASM transitions while keeping the exact same candidate/trial seeds.
  if(SAOFDFullSim8WASM.runCandidateMatrix){
    const z=SAOFDFullSim8WASM.runCandidateMatrix(cfgs);
    if(z&&z.length===cfgs.length&&z.every(r=>r&&Number.isFinite(r.uptime)))return z;
  }
  for(let b=0;b<cfgs.length;b+=8){
    const part=cfgs.slice(b,b+8),x=SAOFDFullSim8WASM.make();SAOFDFullSim8WASM.fillFromCfgs(x,part,0);SAOFDFullSim8WASM.prepare(x);
    if(SAOFDFullSim8WASM.runCandidateTrialsPrepared){
      const z=SAOFDFullSim8WASM.runCandidateTrialsPrepared(x,trials);
      if(z){for(let j=0;j<part.length;j++)out[b+j]={uptime:x.outUptime[j],maxRes:x.outMaxRes[j]};continue;}
    }
    const sums=new Float64Array(part.length),maxs=new Float64Array(part.length);maxs.fill(-Infinity);
    for(let q=0;q<trials;q++){
      SAOFDFullSim8WASM.setCandidateTrialSeeds(x,part,q);SAOFDFullSim8WASM.runPrepared(x,true);
      for(let j=0;j<part.length;j++){sums[j]+=x.outUptime[j];if(x.outMaxRes[j]>maxs[j])maxs[j]=x.outMaxRes[j];}
    }
    for(let j=0;j<part.length;j++)out[b+j]={uptime:sums[j]/trials,maxRes:maxs[j]};
  }
  return out;
}
async function verifyFullSim8Batch(cfgs, concurrency=4){
  const unique=new Map();
  for(const c of cfgs){
    if(!c||!c.policy||!Array.isArray(c.policy.segmentActions))continue;
    const key=fullSim8GateKey(c); if(!unique.has(key))unique.set(key,c);
  }
  const entries=Array.from(unique.entries()), result=new Map(); let cursor=0;
  const worker=async()=>{
    while(true){const idx=cursor++; if(idx>=entries.length)return; const [key,c]=entries[idx];
      let ok=false; try{ok=await verifyFullSim8(c);}catch(e){ok=false;}
      result.set(key,ok);
    }
  };
  const n=Math.min(Math.max(1,concurrency|0),Math.max(1,entries.length));
  await Promise.all(Array.from({length:n},worker));
  return result;
}

function scorePolicyPairsNative(eq,pairs,duration,trials,trialStart,seed){
  if(!fullSimCandidateSafe||!pairs?.length||!SAOFDFullSim8WASM.runPolicyPairMatrix)return null;
  try{return SAOFDFullSim8WASM.runPolicyPairMatrix(shared.base,eq,pairs,shared.policyMeta?.specs||[],duration,trials,trialStart,seed);}catch(e){return null;}
}

async function scoreMany(cfgs,useCache=true,allowFullSim8=true){
  const out=new Array(cfgs.length);
  let misses=[];
  for(let i=0;i<cfgs.length;i++){
    const c=cfgs[i];
    const key=useCache?((c.trialStart?`range:${c.trialStart}|`:'')+JSON.stringify(c)):'';
    const hit=useCache?scoreCache.get(key):null;
    if(hit){out[i]=hit;continue;}
    misses.push({i,c,key});
  }
  if(!misses.length)return out;

  // v27.67: coarse policy search is candidate-parallel SIMD. Eight different
  // policy/equipment/rotation candidates occupy the eight native lanes while
  // sharing the exact same trial index (common random numbers). This is exact,
  // differential-gated once per worker, and avoids eight separate JS event loops.
  if(allowFullSim8 && fullSimCandidateSafe && misses.length>=2){
    try{
      const got=await scoreManyCandidateSIMD(misses.map(x=>x.c));
      if(got&&got.length===misses.length&&got.every(x=>x&&Number.isFinite(x.uptime))){
        for(let k=0;k<misses.length;k++){out[misses[k].i]=got[k];if(useCache)scoreCacheSet(misses[k].key,got[k]);}
        return out;
      }
    }catch(e){/* exact JS fallback below */}
  }

  // Full-SIMD is profitable for long final evaluations, not for tiny coarse
  // screening jobs. Each candidate is independently differential-gated; a
  // failed candidate never changes the status of a different candidate.
  if(allowFullSim8 && fullSimCandidateSafe){
    const eligible=misses.filter(x=>x.c&&x.c.policy&&Array.isArray(x.c.policy.segmentActions)&&Number(x.c.trials)>=FULLSIM_MIN_TRIALS);
    if(eligible.length){
      try{
        // The native kernel has already passed the worker-wide lane/config
        // differential gate. Avoid the old per-candidate trace audit, which
        // could cost more than the actual final Monte-Carlo run.
        for(const x of eligible){
          const r=await scoreOneFullSim8(x.c);
          if(r&&Number.isFinite(r.uptime)){out[x.i]=r;if(useCache)scoreCacheSet(x.key,r);}
        }
        misses=misses.filter(x=>out[x.i]==null);
        if(!misses.length)return out;
      }catch(e){/* fall through candidate-by-candidate to canonical JS */}
    }
  }

  // No-policy screening can use the older batch WASM path, but only when all
  // remaining jobs are compatible with the same scalar model.
  const work=misses.map(x=>x.c);
  if(work.length && !work[0].policy && await ensureWasm()){
    const effect=work[0].specialEffect||'crit';
    if(wasmSafe[effect] && wasmCompatible(work,effect)){
      try{
        const r=wasmBatchScores(work);
        if(r && r.length===work.length && r.every(x=>x && Number.isFinite(x.uptime))){
          for(let k=0;k<misses.length;k++){out[misses[k].i]=r[k];if(useCache)scoreCacheSet(misses[k].key,r[k]);}
          return out;
        }
        wasmSafe[effect]=false;
      }catch(e){wasmSafe[effect]=false;}
    }
  }

  const rs=work.map(c=>runSimulationFast(c));
  if(rs.length!==work.length || rs.some(x=>!x || !Number.isFinite(x.uptime)))throw new Error('高速シミュレーション結果が不正です');
  for(let k=0;k<misses.length;k++){out[misses[k].i]=rs[k];if(useCache)scoreCacheSet(misses[k].key,rs[k]);}
  return out;
}


let treeValidationKey='';
let treeValidationOK=false;
async function exactPolicyTreeScreen(base, equipment, fallback, duration, trials, seed, indices){
  /*
   * Exact policy-tree evaluator.
   *
   * The policy lattice is a tree over the observable poison-remaining-time
   * segments.  We do not discard leaves and we do not alter the simulator's
   * RNG/model.  Leaves are ordered by common prefixes so V8 can reuse compiled
   * policy objects and the score cache can hit identical work.  The authoritative
   * leaf score is still runSimulationFast(), so this path is result-preserving.
   *
   * NOTE: a true mutable-state checkpoint between sibling leaves would require
   * exposing the simulator's complete per-trial RNG/event state.  We deliberately
   * do not fake that here. This implementation is the exact, semantics-preserving
   * tree scheduler; it is a prerequisite for the checkpoint engine below.
   */
  const treePolicies=indices.map(i=>policyAt(i));
  const treeCfg={...base,equipment,rotation:fallback,duration,trials,seed};
  // v27.36: validate checkpoint tree with event-level differential tracing once per model/config class.
  // If any sampled leaf disagrees with the canonical simulator, this worker
  // immediately falls back to canonical scoring for all subsequent jobs.
  let exactTree=null;
  if(POLICY_TREE_PRODUCTION_ENABLED){
    const vk=JSON.stringify({equipment,duration,seed,specialEffect:base.specialEffect,segments:base.policySegments,skills:base.skills,rotation:fallback});
    if(vk!==treeValidationKey){
      const vr=validatePolicyTreeExact({...treeCfg,trials:1},treePolicies,[0,1,2,3,Math.floor(treePolicies.length/2),Math.max(0,treePolicies.length-1)]);
      treeValidationKey=vk;treeValidationOK=!!vr.ok;
      if(!treeValidationOK)console.warn('Policy tree validation failed; using canonical path',vr.diffs);
    }
    exactTree=treeValidationOK?runSimulationPolicyTreeExact(treeCfg,treePolicies):null;
  }
  if(exactTree){return exactTree.map((x,j)=>({index:indices[j],score:x.uptime}));}
  const specs=indices.map(i=>({index:i,actions:policyAt(i).segmentActions||[]}));
  specs.sort((a,b)=>{
    const A=a.actions,B=b.actions,n=Math.min(A.length,B.length);
    let k=0;while(k<n&&A[k]===B[k])k++;
    if(k!==n)return B.length-A.length;
    for(let j=0;j<n;j++)if(A[j]!==B[j])return A[j]-B[j];
    return a.index-b.index;
  });
  const cfgs=specs.map(x=>({...base,equipment,rotation:fallback,policy:policyAt(x.index),duration,trials,seed}));
  const rs=[];
  // Larger batches minimize postMessage and JSON/cache overhead while keeping
  // memory bounded on mobile.
  const chunk=Math.max(32,Math.min(4096,cfgs.length));
  for(let i=0;i<cfgs.length;i+=chunk){
    const part=cfgs.slice(i,i+chunk);
    const got=await scoreMany(part,false,true);
    for(let j=0;j<got.length;j++)rs.push({index:specs[i+j].index,score:got[j].uptime});
  }
  return rs;
}
self.onmessage=async function(ev){const d=ev.data||{};try{
 if(d.cmd==='init'){scoreCache.clear();policyCache.clear();rotationCache.clear();fullSim8GateCache.clear();shared.base=d.base;shared.skills=d.skills;shared.skillsFingerprint=JSON.stringify(d.skills||[]);shared.rotations=d.rotations;buildPolicyMeta();shared.compiledRotations=(d.rotations||[]).map(cachedRotation);
   // Validate only the active no-policy effect at startup. v27.65 validated all
   // three effects in every worker, tripling startup work even though one effect
   // is selected per optimization run.
   wasmSafe.crit=false;wasmSafe.combo=false;wasmSafe.hpmax=false;
   fullSimCandidateSafe=false;
   if(d.mobile===true){self.postMessage({cmd:'init-ok',wasmSafe,fullSimCandidateSafe:false,mobile:true,policyTree:false});return;}
   const ef=(shared.base?.specialEffect||'crit');
   // v27.69: all optimizer workers load the same immutable WASM binary and the
   // same battle model.  A full differential gate on every worker duplicated
   // substantial startup work (up to 31 times).  Worker 0 performs the gate;
   // siblings may receive that already-proven result from the main thread.
   if(d.trustedInit===true){
     if(d.trustedWasmSafe&&typeof d.trustedWasmSafe==='object')for(const k of ['crit','combo','hpmax'])wasmSafe[k]=!!d.trustedWasmSafe[k];
     fullSimCandidateSafe=!!d.trustedFullSimCandidateSafe;
     if(fullSimCandidateSafe)await SAOFDFullSim8WASM.init();
   }else{
     await ensureWasm();if(ef in wasmSafe)wasmSafe[ef]=await verifyWasmForEffect(ef);
     fullSimCandidateSafe=await verifyCandidateSIMD();
   }
   self.postMessage({cmd:'init-ok',wasmSafe,fullSimCandidateSafe,mobile:false,policyTree:false,trustedInit:d.trustedInit===true});return;}
 if(d.cmd==='screen'){const eq=d.equipment,base=shared.base,rots=d.rotationsOverride||shared.rotations||[];const cfgs=rots.map(rot=>({...base,equipment:eq,rotation:rot,policy:null,duration:d.duration,trials:d.trials,seed:d.seed}));const rs=await scoreMany(cfgs);if(rs.length!==cfgs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('screen結果が不正です');let best=null,row=[];for(let i=0;i<rs.length;i++){const x={rotation:rots[i],score:rs[i].uptime};row.push(x);if(!best||x.score>best.score)best=x;}self.postMessage({cmd:'result',id:d.id,result:{best,row}});return;}
 if(d.cmd==='policyExhaustive'){
  const eq=d.equipment,base=shared.base;
  const explicitPairs=Array.isArray(d.pairs)&&d.pairs.length?d.pairs.filter(q=>Number.isInteger(Number(q.index))&&Number(q.index)>=0&&Number(q.index)<shared.policyCount&&Array.isArray(q.rotation)):null;
  const top=[];let evaluated=0;
  if(explicitPairs){
    const CH=16384;
    for(let b=0;b<explicitPairs.length;b+=CH){
      const part=explicitPairs.slice(b,b+CH);let scores=scorePolicyPairsNative(eq,part,d.duration,d.trials,0,d.seed);
      if(!scores){const cfgs=part.map(q=>({...base,equipment:eq,rotation:q.rotation,policy:policyAt(Number(q.index)),duration:d.duration,trials:d.trials,seed:d.seed}));const got=await scoreMany(cfgs,false,true);scores=Float64Array.from(got,r=>r.uptime);}
      evaluated+=scores.length;for(let j=0;j<scores.length;j++)pushTop(top,{index:Number(part[j].index),rotation:part[j].rotation,score:scores[j]},16);
    }
    self.postMessage({cmd:'result',id:d.id,result:{top,evaluated,total:explicitPairs.length}});return;
  }
  const polIds=Array.isArray(d.policyIndices)&&d.policyIndices.length?d.policyIndices:Array.from({length:shared.policyCount},(_,i)=>i);
  const rots=Array.isArray(d.rotations)&&d.rotations.length?d.rotations:(shared.rotations||[]);
  const ids=polIds.filter(i=>Number.isInteger(i)&&i>=0&&i<shared.policyCount);
  for(const rot of rots){
    const scored=await exactPolicyTreeScreen(base,eq,rot,d.duration,d.trials,d.seed,ids);
    evaluated+=scored.length;
    for(const z of scored)pushTop(top,{index:z.index,rotation:rot,score:z.score},16);
  }
  self.postMessage({cmd:'result',id:d.id,result:{top,evaluated,total:ids.length*rots.length}});return;
 }
 if(d.cmd==='policyRace'){
  const eq=d.equipment,base=shared.base,polIds=Array.isArray(d.policyIndices)&&d.policyIndices.length?d.policyIndices:Array.from({length:shared.policyCount},(_,i)=>i);
  const rots=Array.isArray(d.rotations)&&d.rotations.length?d.rotations:(shared.rotations||[]);
  const ids=polIds.filter(i=>Number.isInteger(i)&&i>=0&&i<shared.policyCount);
  const explicitPairs=Array.isArray(d.pairs)&&d.pairs.length?d.pairs.filter(q=>Number.isInteger(Number(q.index))&&Number(q.index)>=0&&Number(q.index)<shared.policyCount&&Array.isArray(q.rotation)):null;
  let alive=explicitPairs?explicitPairs.map(q=>({index:Number(q.index),rotation:q.rotation,score:-Infinity,sum:0,count:0,lastDuration:-1})):[];
  if(!explicitPairs)for(const rot of rots)for(const pi of ids)alive.push({index:pi,rotation:rot,score:-Infinity,sum:0,count:0,lastDuration:-1});
  const stages=Array.isArray(d.stages)&&d.stages.length?d.stages:[{duration:d.duration,totalTrials:1,keep:0.5,cumulative:true},{duration:d.duration,totalTrials:d.trials,keep:16,cumulative:true}];
  let evaluated=0;
  for(let si=0;si<stages.length&&alive.length;si++){
    const st=stages[si]||{},dur=Math.max(0.25,Number(st.duration)||Number(d.duration)||30),target=Math.max(1,Math.floor(Number(st.totalTrials??st.trials)||1)),cumulative=st.cumulative!==false;
    const scored=[];const CH=16384;
    for(let b=0;b<alive.length;b+=CH){
      const part=alive.slice(b,b+CH),same=cumulative&&part.every(q=>q.lastDuration===dur),already=same?(part[0]?.count||0):0,add=Math.max(0,target-already);
      let scores=null;
      if(add>0){
        scores=scorePolicyPairsNative(eq,part,dur,add,already,d.seed);
        if(!scores){const cfgs=part.map(q=>({...base,equipment:eq,rotation:q.rotation,policy:policyAt(q.index),duration:dur,trials:add,trialStart:already,seed:d.seed}));const got=await scoreMany(cfgs,false,true);scores=Float64Array.from(got,r=>r.uptime);}
        evaluated+=scores.length;
      }
      for(let j=0;j<part.length;j++){
        const q=part[j];let sum=same?q.sum:0,count=same?q.count:0;
        if(add>0){sum+=scores[j]*add;count+=add;}
        scored.push({...q,sum,count,lastDuration:dur,score:count?sum/count:q.score});
      }
    }
    scored.sort((a,b)=>b.score-a.score || a.index-b.index || String(a.rotation).localeCompare(String(b.rotation)));
    let keep=st.keep;if(Number(keep)>0&&Number(keep)<1)keep=Math.ceil(scored.length*Number(keep));else keep=Math.floor(Number(keep)||16);
    keep=Math.max(Math.min(Math.max(16,Number(d.topN)||16),scored.length),Math.min(scored.length,keep));alive=scored.slice(0,keep);
  }
  const limit=Math.max(1,Math.min(64,Number(d.topN)||16));
  self.postMessage({cmd:'result',id:d.id,result:{top:alive.slice(0,limit).map(({sum,count,lastDuration,...z})=>z),evaluated,total:explicitPairs?explicitPairs.length:ids.length*rots.length,fullSimCandidateSafe}});return;
 }
 if(d.cmd==='policyPairs'){
  // v27.68: score an explicit policy/rotation shard. The main thread uses this
  // primitive to distribute one equipment race across every available worker,
  // then performs the exact same global sort/prune as v27.67.
  const eq=d.equipment,base=shared.base,pairs=Array.isArray(d.pairs)?d.pairs:[];
  const meta=[];
  const trials=Math.max(1,Math.floor(Number(d.trials)||1));
  const trialStart=Math.max(0,Math.floor(Number(d.trialStart)||0));
  for(const q of pairs){
    const pi=Number(q.index);if(!Number.isInteger(pi)||pi<0||pi>=shared.policyCount)continue;
    meta.push({index:pi,rotation:Array.isArray(q.rotation)?q.rotation:[1,2,3]});
  }
  let scores=scorePolicyPairsNative(eq,meta,d.duration,trials,trialStart,d.seed);
  if(!scores){const cfgs=meta.map(q=>({...base,equipment:eq,rotation:q.rotation,policy:policyAt(q.index),duration:d.duration,trials,trialStart,seed:d.seed}));const got=await scoreMany(cfgs,false,true);if(got.length!==cfgs.length||got.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('policyPairs結果が不正です');scores=Float64Array.from(got,x=>x.uptime);}
  if(scores.length!==meta.length)throw new Error('policyPairs結果が不正です');
  self.postMessage({cmd:'result',id:d.id,result:{scores,meta,evaluated:meta.length}},[scores.buffer]);return;
 }
 if(d.cmd==='policyBeam'){
  const eq=d.equipment,base=shared.base,pairs=Array.isArray(d.pairs)?d.pairs:[],top=[],meta=[];
  for(const q of pairs){const pi=Number(q.index);if(!Number.isInteger(pi)||pi<0||pi>=shared.policyCount)continue;meta.push({index:pi,rotation:Array.isArray(q.rotation)?q.rotation:[1,2,3]});}
  const chunk=16384;for(let i=0;i<meta.length;i+=chunk){const partMeta=meta.slice(i,i+chunk);let scores=scorePolicyPairsNative(eq,partMeta,d.duration,d.trials,0,d.seed);if(!scores){const cfgs=partMeta.map(q=>({...base,equipment:eq,rotation:q.rotation,policy:policyAt(q.index),duration:d.duration,trials:d.trials,seed:d.seed}));const got=await scoreMany(cfgs,false,true);scores=Float64Array.from(got,r=>r.uptime);}for(let j=0;j<scores.length;j++)pushTop(top,{...partMeta[j],score:scores[j]},Math.max(1,Math.min(16,d.topN||3)));}
  self.postMessage({cmd:'result',id:d.id,result:{top,evaluated:meta.length,total:meta.length}});return;
 }
 if(d.cmd==='run'){const rs=await scoreMany([d.cfg]);if(!rs[0]||!Number.isFinite(rs[0].uptime))throw new Error('run結果が不正です');self.postMessage({cmd:'result',id:d.id,result:rs[0]});return;}
}catch(error){self.postMessage({cmd:'error',id:d.id,error:String(error&&error.message||error)});}};
