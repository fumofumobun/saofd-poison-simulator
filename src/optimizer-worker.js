// v27.71 GitHub Pages worker: low-GC packed races + verified native kernels only.
importScripts('./wasm-sim.js','./simulator-fast.js','./full-sim8.js');
let shared={base:null,skills:null,skillsFingerprint:'',policyCount:0,policyK:4,rotations:null,strategyCodes:null};
const policyCache=new Map();
const wasmSafe={crit:false,combo:false,hpmax:false};
let fullSimCandidateSafe=false;
const FULLSIM_MIN_TRIALS=16;
function pushTop(top,item,limit=16){
  let i=top.length; while(i>0){const p=top[i-1];const better=item.score>p.score || (item.score===p.score && Number(item.sid)<Number(p.sid));if(!better)break;i--;}
  top.splice(i,0,item);if(top.length>limit)top.length=limit;
}
function materializeTop(top){return top.map(z=>{const q=strategyMetaAt(z.sid);return {sid:z.sid,index:q.index,rotation:q.rotation,score:z.score};});}

function cachedPolicyFromSpec(p){
  const k=Array.isArray(p.segmentActions)?`K${p.segmentCount}|${p.segmentActions.join(',')}`:[p.poisonThreshold,p.successStreak,p.urgent,p.highSuccess,p.defaultAction].join('|');
  let v=policyCache.get(k); if(v)return v;
  v=Array.isArray(p.segmentActions)
    ? {segmentActions:p.segmentActions,segmentCount:p.segmentCount,ailmentDuration:p.ailmentDuration}
    : {rules:[{type:'poison_le',value:p.poisonThreshold,action:p.urgent},{type:'success_streak_ge',value:p.successStreak,action:p.highSuccess}],defaultAction:p.defaultAction};
  if(policyCache.size>=4096)policyCache.delete(policyCache.keys().next().value); policyCache.set(k,v); return v;
}
function buildPolicyMeta(){
  const base=shared.base||{};shared.policyK=Math.max(2,Math.min(5,Math.floor(Number(base.policySegments)||4)));shared.policyCount=Math.pow(4,shared.policyK);
}
function policySpecAt(i){
  const n=Number(i);if(!Number.isInteger(n)||n<0||n>=shared.policyCount)throw new Error('policy index out of range');
  let x=n;const K=shared.policyK,actions=new Array(K);for(let k=0;k<K;k++){actions[k]=x&3;x>>=2;}
  return {segmentCount:K,segmentActions:actions,ailmentDuration:Math.max(0,Number(shared.base?.ailmentDuration)||0)};
}
function policyAt(i){return cachedPolicyFromSpec(policySpecAt(i));}
function strategyMetaAt(id){
  const sid=Number(id);if(!Number.isInteger(sid)||sid<0||!shared.strategyCodes||sid>=shared.strategyCodes.length)throw new Error('strategy id out of range');
  const c=shared.strategyCodes[sid]>>>0,pi=c&1023,K=Math.max(2,Math.min(5,(c>>>22)&7)),rotation=[];
  for(const sh of [10,14,18]){const v=(c>>>sh)&15;if(v)rotation.push(v);}
  return {sid,index:pi,rotation,K};
}
function strategyIds(input){
  if(input instanceof Uint32Array)return input;
  if(input&&typeof input.length==='number'){const out=[];for(let j=0;j<input.length;j++){const v=Number(input[j]);if(Number.isInteger(v)&&v>=0&&shared.strategyCodes&&v<shared.strategyCodes.length)out.push(v);}return out;}
  return shared.strategyCodes?Array.from({length:shared.strategyCodes.length},(_,i)=>i):[];
}
function strategyCodesForIds(ids){
  if(!shared.strategyCodes)return null;if(!ids)return shared.strategyCodes;
  if(ids.length){const first=Number(ids[0]);let contiguous=Number.isInteger(first)&&first>=0&&first+ids.length<=shared.strategyCodes.length;for(let j=1;contiguous&&j<ids.length;j++)if(Number(ids[j])!==first+j)contiguous=false;if(contiguous)return shared.strategyCodes.subarray(first,first+ids.length);}
  const out=new Uint32Array(ids.length);for(let j=0;j<ids.length;j++)out[j]=shared.strategyCodes[ids[j]];return out;
}
function sameSkills(c){return !!c&&(c.skills===shared.skills || (c.skillsFingerprint&&c.skillsFingerprint===shared.skillsFingerprint) || JSON.stringify(c.skills||[])===shared.skillsFingerprint);}
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
      const ref=runSimulationFast(c);
      if(!got||got.length!==1||!got[0]||!Number.isFinite(got[0].uptime)||!sameScore(got[0],ref))return false;
    }
    for(let i=0;i<64;i++){
      const c={...b, duration:1.5+(i%17)*1.25, trials:3+(i%9), trialStart:i%23,
        seed:(0x9E3779B9 + Math.imul(i,0x6D2B79F5))>>>0,
        equipment:{poisonHit:(i*13)%101,ailment:(i*7)%31,ctPromo:(i*11)%49,instant:(i*17)%67},
        rotation:[[1,2,3],[2,3,1],[3,1,2]][i%3], hpMaxUptime:(i*19)%101};
      const got=wasmBatchScores([c]);
      const ref=runSimulationFast(c);
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
    return sameSkills(c);
  });
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
    const bd=Math.max(4,Number(base.duration)||23);
    const durations=[...new Set([Math.min(bd,18),bd])];
    const starts=[0,31];
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
        for(const st of [7])for(const tr of [3]){
          const part=cfgs.map(c=>({...c,duration:dur,trialStart:st,trials:tr}));
          const got=SAOFDFullSim8WASM.runCandidateMatrix(part);
          if(!got||got.length!==part.length)return false;
          for(let i=0;i<part.length;i++){const ref=runSimulationFast(part[i]);if(!ref||Math.abs(Number(got[i].uptime)-Number(ref.uptime))>1e-12||Math.abs(Number(got[i].maxRes??0)-Number(ref.maxRes??got[i].maxRes??0))>1e-12)return false;}
        }
      }
    }
    // v27.70 regression gate: with no normal-attack clock, a policy may reject
    // every currently-ready skill. The native scheduler must advance to the next
    // cooldown wake-up instead of terminating the trial early.
    const edge={...base,duration:Math.max(12,Math.min(45,Number(base.duration)||30)),trials:1,trialStart:68,seed:0x9E3779B9,normalHpm:0,
      equipment:{poisonHit:37,ailment:19,ctPromo:23,instant:41},rotation:[1],
      policy:{segmentCount:2,segmentActions:[1,2],ailmentDuration:Number(base.ailmentDuration)||10}};
    const eg=SAOFDFullSim8WASM.runCandidateMatrix?.([edge]),er=runSimulationFast(edge);
    if(!eg||eg.length!==1||!er||Math.abs(Number(eg[0].uptime)-Number(er.uptime))>1e-12)return false;
    return true;
  }catch(e){return false;}
}
async function scoreManyCandidateSIMD(cfgs){
  if(!fullSimCandidateSafe||!cfgs.length)return null;
  const first=cfgs[0],trials=Math.max(1,Math.floor(first.trials||1)),trialStart=Math.max(0,Math.floor(first.trialStart||0));
  const scalar=['duration','baseResist','rise','fall','ailmentDuration','critRate','normalHpm','normalHps','normalRangedRate','comboSuccessRate','hpMaxUptime','specialEffect'];
  if(!cfgs.every(c=>c&&c.policy&&Array.isArray(c.policy.segmentActions)&&Math.max(1,Math.floor(c.trials||1))===trials&&Math.max(0,Math.floor(c.trialStart||0))===trialStart&&sameSkills(c)&&scalar.every(k=>Number.isFinite(Number(first[k]))||Number.isFinite(Number(c[k]))?Number(first[k]??0)===Number(c[k]??0):(first[k]??'')===(c[k]??''))))return null;
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
function scorePolicyIdsNative(eq,ids,duration,trials,trialStart,seed){
  if(!fullSimCandidateSafe||!ids?.length||!SAOFDFullSim8WASM.runPolicyCodeMatrix)return null;
  try{const codes=strategyCodesForIds(ids);return SAOFDFullSim8WASM.runPolicyCodeMatrix(shared.base,eq,codes,duration,trials,trialStart,seed);}catch(e){return null;}
}

async function scoreMany(cfgs,_useCache=false,allowFullSim8=true){
  const out=new Array(cfgs.length);
  let misses=cfgs.map((c,i)=>({i,c}));
  if(!misses.length)return out;

  // v27.67: coarse policy search is candidate-parallel SIMD. Eight different
  // policy/equipment/rotation candidates occupy the eight native lanes while
  // sharing the exact same trial index (common random numbers). This is exact,
  // differential-gated once per worker, and avoids eight separate JS event loops.
  if(allowFullSim8 && fullSimCandidateSafe && misses.length>=2){
    try{
      const got=await scoreManyCandidateSIMD(misses.map(x=>x.c));
      if(got&&got.length===misses.length&&got.every(x=>x&&Number.isFinite(x.uptime))){
        for(let k=0;k<misses.length;k++){out[misses[k].i]=got[k];}
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
          if(r&&Number.isFinite(r.uptime)){out[x.i]=r;}
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
          for(let k=0;k<misses.length;k++){out[misses[k].i]=r[k];}
          return out;
        }
        wasmSafe[effect]=false;
      }catch(e){wasmSafe[effect]=false;}
    }
  }

  const rs=work.map(c=>runSimulationFast(c));
  if(rs.length!==work.length || rs.some(x=>!x || !Number.isFinite(x.uptime)))throw new Error('高速シミュレーション結果が不正です');
  for(let k=0;k<misses.length;k++){out[misses[k].i]=rs[k];}
  return out;
}


self.onmessage=async function(ev){const d=ev.data||{};try{
 if(d.cmd==='init'){policyCache.clear();shared.base=d.base;shared.skills=d.skills;shared.skillsFingerprint=d.skillsFingerprint||JSON.stringify(d.skills||[]);shared.rotations=d.rotations;shared.strategyCodes=d.strategyCodes?(d.strategyCodes instanceof Uint32Array?d.strategyCodes:Uint32Array.from(d.strategyCodes)):null;if(d.fullSimModule&&SAOFDFullSim8WASM.setModule)SAOFDFullSim8WASM.setModule(d.fullSimModule);if(d.batchWasmModule&&typeof setWasmBatchModule==='function')setWasmBatchModule(d.batchWasmModule);buildPolicyMeta();
   // Validate only the active no-policy effect at startup. v27.65 validated all
   // three effects in every worker, tripling startup work even though one effect
   // is selected per optimization run.
   wasmSafe.crit=false;wasmSafe.combo=false;wasmSafe.hpmax=false;
   fullSimCandidateSafe=false;
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
     // The legacy no-policy batch kernel no longer matches the current crit/combo
     // scheduler, so do not spend hundreds of canonical checks proving a known
     // negative on every page load. hpmax remains eligible and is still gated.
     if(ef==='hpmax'){await ensureWasm();wasmSafe.hpmax=await verifyWasmForEffect('hpmax');}
     fullSimCandidateSafe=await verifyCandidateSIMD();
   }
   self.postMessage({cmd:'init-ok',wasmSafe,fullSimCandidateSafe,mobile:d.mobile===true,policyTree:false,trustedInit:d.trustedInit===true});return;}
 if(d.cmd==='screen'){
  const eq=d.equipment,base=shared.base,rots=d.rotationsOverride||shared.rotations||[];
  const cfgs=rots.map(rot=>({...base,equipment:eq,rotation:rot,policy:null,duration:d.duration,trials:d.trials,seed:d.seed}));
  const rs=await scoreMany(cfgs,false,false);if(rs.length!==cfgs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('screen結果が不正です');
  let best=null,row=[];for(let i=0;i<rs.length;i++){const x={rotation:rots[i],score:rs[i].uptime};row.push(x);if(!best||x.score>best.score)best=x;}
  self.postMessage({cmd:'result',id:d.id,result:{best,row}});return;
 }
 if(d.cmd==='screenBatch'){
  const eqs=Array.isArray(d.equipments)?d.equipments:[],base=shared.base,rots=d.rotationsOverride||shared.rotations||[];
  const cfgs=[];for(const eq of eqs)for(const rot of rots)cfgs.push({...base,equipment:eq,rotation:rot,policy:null,duration:d.duration,trials:d.trials,seed:d.seed});
  const rs=await scoreMany(cfgs,false,false);if(rs.length!==cfgs.length||rs.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('screenBatch結果が不正です');
  const results=new Array(eqs.length);let pos=0;for(let e=0;e<eqs.length;e++){let best=null,row=[];for(let r=0;r<rots.length;r++){const x={rotation:rots[r],score:rs[pos++].uptime};row.push(x);if(!best||x.score>best.score)best=x;}results[e]={best,row};}
  self.postMessage({cmd:'result',id:d.id,result:results});return;
 }
 if(d.cmd==='policyExhaustive'){
  const eq=d.equipment,base=shared.base,ids=strategyIds(d.pairIds);const top=[];let evaluated=0;const CH=16384;
  for(let b=0;b<ids.length;b+=CH){
    const part=ids.slice(b,b+CH);let scores=scorePolicyIdsNative(eq,part,d.duration,d.trials,0,d.seed);
    if(!scores){const meta=Array.from(part,strategyMetaAt),cfgs=meta.map(q=>({...base,equipment:eq,rotation:q.rotation,policy:policyAt(q.index),duration:d.duration,trials:d.trials,seed:d.seed}));const got=await scoreMany(cfgs,false,true);scores=Float64Array.from(got,r=>r.uptime);}
    evaluated+=scores.length;for(let j=0;j<scores.length;j++)pushTop(top,{sid:Number(part[j]),score:scores[j]},16);
  }
  self.postMessage({cmd:'result',id:d.id,result:{top:materializeTop(top),evaluated,total:ids.length}});return;
 }
 if(d.cmd==='policyRace'){
  const eq=d.equipment,base=shared.base,ids=strategyIds(d.pairIds);
  let alive=Array.from(ids,sid=>({sid:Number(sid),score:-Infinity,sum:0,count:0,lastDuration:-1}));
  const stages=Array.isArray(d.stages)&&d.stages.length?d.stages:[{duration:d.duration,totalTrials:1,keep:0.5,cumulative:true},{duration:d.duration,totalTrials:d.trials,keep:16,cumulative:true}];
  let evaluated=0;
  for(let si=0;si<stages.length&&alive.length;si++){
    const st=stages[si]||{},dur=Math.max(0.25,Number(st.duration)||Number(d.duration)||30),target=Math.max(1,Math.floor(Number(st.totalTrials??st.trials)||1)),cumulative=st.cumulative!==false;
    const same=cumulative&&alive.every(q=>q.lastDuration===dur),already=same?(alive[0]?.count||0):0,add=Math.max(0,target-already);const CH=16384;
    if(add>0){
      for(let b=0;b<alive.length;b+=CH){
        const part=alive.slice(b,b+CH),partIds=Uint32Array.from(part,q=>q.sid);let scores=scorePolicyIdsNative(eq,partIds,dur,add,already,d.seed);
        if(!scores){const meta=Array.from(partIds,strategyMetaAt),cfgs=meta.map(q=>({...base,equipment:eq,rotation:q.rotation,policy:policyAt(q.index),duration:dur,trials:add,trialStart:already,seed:d.seed}));const got=await scoreMany(cfgs,false,true);scores=Float64Array.from(got,r=>r.uptime);}evaluated+=scores.length;
        for(let j=0;j<part.length;j++){const q=part[j];if(!same){q.sum=0;q.count=0;}q.sum+=scores[j]*add;q.count+=add;q.lastDuration=dur;q.score=q.count?q.sum/q.count:q.score;}
      }
    }else for(const q of alive)q.lastDuration=dur;
    alive.sort((a,b)=>b.score-a.score || a.sid-b.sid);
    let keep=st.keep;if(Number(keep)>0&&Number(keep)<1)keep=Math.ceil(alive.length*Number(keep));else keep=Math.floor(Number(keep)||16);
    keep=Math.max(Math.min(Math.max(16,Number(d.topN)||16),alive.length),Math.min(alive.length,keep));alive.length=keep;
  }
  const limit=Math.max(1,Math.min(64,Number(d.topN)||16));self.postMessage({cmd:'result',id:d.id,result:{top:materializeTop(alive.slice(0,limit)),evaluated,total:ids.length,fullSimCandidateSafe}});return;
 }
 if(d.cmd==='policyPairs'){
  const eq=d.equipment,base=shared.base,ids=strategyIds(d.pairIds),trials=Math.max(1,Math.floor(Number(d.trials)||1)),trialStart=Math.max(0,Math.floor(Number(d.trialStart)||0));
  let scores=scorePolicyIdsNative(eq,ids,d.duration,trials,trialStart,d.seed);
  if(!scores){const meta=Array.from(ids,strategyMetaAt),cfgs=meta.map(q=>({...base,equipment:eq,rotation:q.rotation,policy:policyAt(q.index),duration:d.duration,trials,trialStart,seed:d.seed}));const got=await scoreMany(cfgs,false,true);if(got.length!==cfgs.length||got.some(x=>!x||!Number.isFinite(x.uptime)))throw new Error('policyPairs結果が不正です');scores=Float64Array.from(got,x=>x.uptime);}
  if(scores.length!==ids.length)throw new Error('policyPairs結果が不正です');self.postMessage({cmd:'result',id:d.id,result:{scores,evaluated:ids.length}},[scores.buffer]);return;
 }
 if(d.cmd==='policyBeam'){
  const eq=d.equipment,base=shared.base,ids=strategyIds(d.pairIds),top=[];let scores=scorePolicyIdsNative(eq,ids,d.duration,d.trials,0,d.seed);
  if(!scores){const meta=Array.from(ids,strategyMetaAt),cfgs=meta.map(q=>({...base,equipment:eq,rotation:q.rotation,policy:policyAt(q.index),duration:d.duration,trials:d.trials,seed:d.seed}));const got=await scoreMany(cfgs,false,true);scores=Float64Array.from(got,r=>r.uptime);}
  const lim=Math.max(1,Math.min(16,d.topN||3));for(let j=0;j<scores.length;j++)pushTop(top,{sid:Number(ids[j]),score:scores[j]},lim);
  self.postMessage({cmd:'result',id:d.id,result:{top:materializeTop(top),evaluated:ids.length,total:ids.length}});return;
 }
 if(d.cmd==='policyBeamBatch'){
  const eqs=Array.isArray(d.equipments)?d.equipments:[],ids=strategyIds(d.pairIds),base=shared.base,lim=Math.max(1,Math.min(16,d.topN||3)),results=new Array(eqs.length);
  for(let ei=0;ei<eqs.length;ei++){
    const eq=eqs[ei],top=[];let scores=scorePolicyIdsNative(eq,ids,d.duration,d.trials,0,d.seed);
    if(!scores){const meta=Array.from(ids,strategyMetaAt),cfgs=meta.map(q=>({...base,equipment:eq,rotation:q.rotation,policy:policyAt(q.index),duration:d.duration,trials:d.trials,seed:d.seed}));const got=await scoreMany(cfgs,false,true);scores=Float64Array.from(got,r=>r.uptime);}
    for(let j=0;j<scores.length;j++)pushTop(top,{sid:Number(ids[j]),score:scores[j]},lim);results[ei]={top:materializeTop(top),evaluated:ids.length,total:ids.length};
  }
  self.postMessage({cmd:'result',id:d.id,result:results});return;
 }
 if(d.cmd==='run'){const rs=await scoreMany([d.cfg],false,true);if(!rs[0]||!Number.isFinite(rs[0].uptime))throw new Error('run結果が不正です');self.postMessage({cmd:'result',id:d.id,result:rs[0]});return;}
}catch(error){self.postMessage({cmd:'error',id:d.id,error:String(error&&error.message||error)});}};
