/* v27.43 full one-call simulator bridge. The WASM kernel owns the event scheduler
 * and all deterministic state transitions for eight independent MC trials. */
(function(g){'use strict';
let inst=null,promise=null,providedModule=null;
const P={base:0,rise:64,fall:128,ailDur:192,duration:256,critRate:320,normalHpm:384,normalRanged:448,comboRate:512,hpMax:576,eqA:640,eqP:704,ctPromo:768,instantBonus:832,ct:896,execution:920,hits:944,interval:968,skillRanged:992,skillInstant:1016,skillPoisonType:1040,partialChance:1064,partialMask:1088,policyActions:1888,policyK:2208,rotation:2400,specialMode:2416,seeds:2448,rotation2:2496,outUptime:3000,outMaxRes:3064};
const BYTES=262144;
function setModule(m){if(typeof WebAssembly!=='undefined'&&m instanceof WebAssembly.Module){providedModule=m;inst=null;promise=null;return true;}return false;}
async function init(){if(promise)return promise;promise=(async()=>{try{if(providedModule){inst=(await WebAssembly.instantiate(providedModule,{}));return true;}const url=(typeof document==='undefined'?'../wasm/':'./wasm/')+'full-sim8.wasm';const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw Error('full-sim8 fetch');let obj=null;if(WebAssembly.instantiateStreaming&&r.clone){try{obj=await WebAssembly.instantiateStreaming(Promise.resolve(r.clone()),{});}catch(_e){}}if(!obj)obj=await WebAssembly.instantiate(await r.arrayBuffer(),{});inst=obj.instance;return true;}catch(e){inst=null;return false;}})();return promise;}
function ensure(){const m=inst.exports.memory;if(m.buffer.byteLength<BYTES)m.grow(Math.ceil((BYTES-m.buffer.byteLength)/65536));return {f:new Float64Array(m.buffer),i:new Int32Array(m.buffer),u:new Uint32Array(m.buffer)};}
function ensureBytes(bytes){const m=inst.exports.memory;const need=Math.max(BYTES,Math.ceil(Number(bytes)||0));if(m.buffer.byteLength<need)m.grow(Math.ceil((need-m.buffer.byteLength)/65536));return {f:new Float64Array(m.buffer),i:new Int32Array(m.buffer),u:new Uint32Array(m.buffer)};}
function set8(f,off,a){f.set(a.subarray(0,8),off>>3);} function setN(f,off,a,n){f.set(a.subarray(0,n),off>>3);}
function make(){return {base:new Float64Array(8),rise:new Float64Array(8),fall:new Float64Array(8),ailDur:new Float64Array(8),duration:new Float64Array(8),critRate:new Float64Array(8),normalHpm:new Float64Array(8),normalRanged:new Float64Array(8),comboRate:new Float64Array(8),hpMax:new Float64Array(8),eqA:new Float64Array(8),eqP:new Float64Array(8),ctPromo:new Float64Array(8),instantBonus:new Float64Array(8),ct:new Float64Array(3),execution:new Float64Array(3),hits:new Float64Array(3),interval:new Float64Array(3),skillRanged:new Float64Array(3),skillInstant:new Float64Array(3),skillPoisonType:new Float64Array(3),partialChance:new Float64Array(3),partialMask:new Float64Array(3*32),policyActions:new Float64Array(8*5),policyK:new Int32Array(8),rotation:new Int32Array(3),specialMode:new Int32Array(8),rotation2:new Int32Array(3),seeds:new Uint32Array(8),outUptime:new Float64Array(8),outMaxRes:new Float64Array(8)};}
function prepare(x){
 if(!inst)throw Error('full-sim8 not initialized');
 const {f,i,u}=ensure();
 const laneKeys=['base','rise','fall','ailDur','duration','critRate','normalHpm','normalRanged','comboRate','hpMax','eqA','eqP','ctPromo','instantBonus'];
 for(const k of laneKeys)set8(f,P[k],x[k]);
 for(const k of ['ct','execution','hits','interval','skillRanged','skillInstant','skillPoisonType','partialChance'])setN(f,P[k],x[k],3);
 setN(f,P.partialMask,x.partialMask,96); setN(f,P.policyActions,x.policyActions,40);
 i.set(x.policyK.subarray(0,8),P.policyK>>2); i.set(x.rotation.subarray(0,3),P.rotation>>2); i.set(x.specialMode.subarray(0,8),P.specialMode>>2); u.set(x.seeds.subarray(0,8),P.seeds>>2);
 return x;
}
function runPrepared(x,updateSeeds=true){
 if(!inst)throw Error('full-sim8 not initialized');
 const {f,u}=ensure();
 if(updateSeeds)u.set(x.seeds.subarray(0,8),P.seeds>>2);
 inst.exports.simulate_full8(P.base,P.rise,P.fall,P.ailDur,P.duration,P.critRate,P.normalHpm,P.normalRanged,P.comboRate,P.hpMax,P.eqA,P.eqP,P.ctPromo,P.instantBonus,P.ct,P.execution,P.hits,P.interval,P.skillRanged,P.skillInstant,P.skillPoisonType,P.partialChance,P.partialMask,P.policyActions,P.policyK,P.rotation,P.specialMode,P.rotation2,P.seeds,3,P.outUptime,P.outMaxRes);
 x.outUptime.set(f.subarray(P.outUptime>>3,(P.outUptime>>3)+8));x.outMaxRes.set(f.subarray(P.outMaxRes>>3,(P.outMaxRes>>3)+8));return x;
}
function runCandidateTrialsPrepared(x,trials){
 if(!inst)throw Error('full-sim8 not initialized');
 const fn=inst.exports.simulate_full8_candidate_trials;if(typeof fn!=='function')return null;
 const {f,u}=ensure();u.set(x.seeds.subarray(0,8),P.seeds>>2);
 fn(P.base,P.rise,P.fall,P.ailDur,P.duration,P.critRate,P.normalHpm,P.normalRanged,P.comboRate,P.hpMax,P.eqA,P.eqP,P.ctPromo,P.instantBonus,P.ct,P.execution,P.hits,P.interval,P.skillRanged,P.skillInstant,P.skillPoisonType,P.partialChance,P.partialMask,P.policyActions,P.policyK,P.rotation,P.specialMode,P.rotation2,P.seeds,3,Math.max(1,trials|0),P.outUptime,P.outMaxRes);
 x.outUptime.set(f.subarray(P.outUptime>>3,(P.outUptime>>3)+8));x.outMaxRes.set(f.subarray(P.outMaxRes>>3,(P.outMaxRes>>3)+8));return x;
}
function runCandidateMatrix(cfgs){
 if(!inst||!Array.isArray(cfgs)||!cfgs.length)return null;
 const fn=inst.exports.simulate_candidate_matrix;if(typeof fn!=='function')return null;
 const first=cfgs[0]
 const trials=Math.max(1,Math.floor(Number(first.trials)||1)),n=cfgs.length;
 // Populate the fixed ABI region once with the shared battle/skill model.
 const x=make();fillFromCfgs(x,[first],0);prepare(x);
 const align8=v=>(v+7)&~7;let off=512*1024; // keep dense matrix workspace well above the native stack/static ABI
 const eqA=off;off=align8(off+n*8);const eqP=off;off=align8(off+n*8);const ctPromo=off;off=align8(off+n*8);const instant=off;off=align8(off+n*8);
 const actions=off;off=align8(off+n*5*8);const pks=off;off=align8(off+n*4);const seeds=off;off=align8(off+n*4);
 const outU=off;off=align8(off+n*8);const outM=off;off=align8(off+n*8);
 const {f,i,u}=ensureBytes(off+64);
 const bEA=eqA>>3,bEP=eqP>>3,bCT=ctPromo>>3,bIN=instant>>3,bA=actions>>3,bPK=pks>>2,bS=seeds>>2;
 const skillCount=Math.max(1,Math.min(3,(first.skills||[]).length||3));
 for(let q=0;q<n;q++){
   const c=cfgs[q],e=c.equipment||{},acts=c.policy?.segmentActions||[];
   f[bEA+q]=Number(e.ailment)||0;f[bEP+q]=Number(e.poisonHit)||0;f[bCT+q]=Number(e.ctPromo)||0;f[bIN+q]=Number(e.instant)||0;
   for(let k=0;k<5;k++)f[bA+q*5+k]=Number(acts[k]??0);
   const K=Math.max(2,Math.min(5,Math.floor(Number(c.policy?.segmentCount)||acts.length||2))),r=c.rotation||[];
   const r0=Number.isInteger(r[0])&&r[0]>=1&&r[0]<=skillCount?r[0]:0,r1=Number.isInteger(r[1])&&r[1]>=1&&r[1]<=skillCount?r[1]:0,r2=Number.isInteger(r[2])&&r[2]>=1&&r[2]<=skillCount?r[2]:0;
   i[bPK+q]=(K&255)|((r0&15)<<8)|((r1&15)<<12)|((r2&15)<<16);
   u[bS+q]=(((c.seed||1234567)+Math.max(0,Math.floor(c.trialStart||0))*1000003)>>>0);
 }
 fn(P.base,P.rise,P.fall,P.ailDur,P.duration,P.critRate,P.normalHpm,P.normalRanged,P.comboRate,P.hpMax,
   P.ct,P.execution,P.hits,P.interval,P.skillRanged,P.skillInstant,P.skillPoisonType,P.partialChance,P.partialMask,P.specialMode,P.rotation,P.rotation2,
   eqA,eqP,ctPromo,instant,actions,pks,seeds,n,skillCount,trials,outU,outM);
 const ou=outU>>3,om=outM>>3,res=new Array(n);for(let q=0;q<n;q++)res[q]={uptime:f[ou+q],maxRes:f[om+q]};return res;
}
function decodeStrategyCode(code,ailmentDuration){
 const c=Number(code)>>>0,pi=c&1023,K=Math.max(2,Math.min(5,(c>>>22)&7));
 const actions=new Array(K);for(let k=0;k<K;k++)actions[k]=(pi>>>(2*k))&3;
 const rotation=[];for(const sh of [10,14,18]){const v=(c>>>sh)&15;if(v)rotation.push(v);}
 return {index:pi,rotation,policy:{segmentCount:K,segmentActions:actions,ailmentDuration:Number(ailmentDuration)||0}};
}
function runPolicyCodeMatrix(baseCfg,equipment,codes,duration,trials,trialStart,seed){
 if(!inst||!codes||!codes.length)return null;
 const fn=inst.exports.simulate_policy_code_matrix;if(typeof fn!=='function')return null;
 const ca=codes instanceof Uint32Array?codes:Uint32Array.from(codes),n=ca.length,dec=decodeStrategyCode(ca[0],baseCfg.ailmentDuration);
 const first={...baseCfg,equipment,rotation:dec.rotation,policy:dec.policy,duration,trials,trialStart,seed};
 const x=make();fillFromCfgs(x,[first],0);prepare(x);
 const align8=v=>(v+7)&~7;let off=512*1024;
 const codeOff=off;off=align8(off+n*4);const outU=off;off=align8(off+n*8);const outM=off;off=align8(off+n*8);
 const {f,u}=ensureBytes(off+64);u.set(ca,codeOff>>2);
 const e=equipment||{},firstSeed=(((seed||1234567)+Math.max(0,Math.floor(trialStart||0))*1000003)>>>0),skillCount=Math.max(1,Math.min(3,(baseCfg.skills||[]).length||3));
 fn(P.base,P.rise,P.fall,P.ailDur,P.duration,P.critRate,P.normalHpm,P.normalRanged,P.comboRate,P.hpMax,
   P.ct,P.execution,P.hits,P.interval,P.skillRanged,P.skillInstant,P.skillPoisonType,P.partialChance,P.partialMask,P.specialMode,P.rotation,P.rotation2,
   Number(e.ailment)||0,Number(e.poisonHit)||0,Number(e.ctPromo)||0,Number(e.instant)||0,codeOff,firstSeed,n,skillCount,Math.max(1,Math.floor(Number(trials)||1)),outU,outM);
 return f.slice(outU>>3,(outU>>3)+n);
}

function fillFromCfg(x,cfg,start){const e=cfg.equipment||{},sd=(typeof __compileSkillData==='function'?__compileSkillData(cfg.skills):(cfg.skills||[]).map(s=>s));for(let l=0;l<8;l++){x.base[l]=Number(cfg.baseResist)||0;x.rise[l]=Number(cfg.rise)||0;x.fall[l]=Number(cfg.fall)||0;x.ailDur[l]=Number(cfg.ailmentDuration)||0;x.duration[l]=Number(cfg.duration)||0;x.critRate[l]=((cfg.specialEffect||'crit')==='crit'?Math.max(0,Math.min(100,Number(cfg.critRate)||0))/100:0);x.normalHpm[l]=Math.max(0,Number(cfg.normalHpm??cfg.normalHps*60)||0);x.normalRanged[l]=((cfg.specialEffect||'crit')==='crit'?Math.max(0,Math.min(100,Number(cfg.normalRangedRate)||0)):0);x.comboRate[l]=Math.max(0,Math.min(100,Number(cfg.comboSuccessRate??100)||0))/100;x.hpMax[l]=Math.max(0,Math.min(100,Number(cfg.hpMaxUptime??100)||0))/100;x.eqA[l]=Number(e.ailment)||0;x.eqP[l]=Number(e.poisonHit)||0;x.ctPromo[l]=Number(e.ctPromo)||0;x.instantBonus[l]=Number(e.instant)||0;x.policyK[l]=Math.max(2,Math.min(5,Math.floor(Number(cfg.policy.segmentCount)||cfg.policy.segmentActions.length)));const acts=cfg.policy.segmentActions||[];for(let k=0;k<5;k++)x.policyActions[l*5+k]=Number(acts[k]??0);x.specialMode[l]=(cfg.specialEffect||'crit')==='combo'?1:((cfg.specialEffect||'crit')==='hpmax'?2:0);x.seeds[l]=(((cfg.seed||1234567)+(start+l)*1000003)>>>0);}
for(let j=0;j<3;j++){const s=sd[j]||{};x.ct[j]=Number(s.ct)||0;x.execution[j]=Number(s.execution)||0;x.hits[j]=Math.max(0,Math.floor(Number(s.hits)||0));x.interval[j]=Math.max(0,Number(s.interval)||0);x.skillRanged[j]=Number(s.rangedRate)||0;x.skillInstant[j]=Number(s.instant)||0;x.skillPoisonType[j]=s.type==='special'?2:(s.poisonType==='partial'?1:0);x.partialChance[j]=Number(s.partialChance)||0;x.partialMask.fill(0,j*32,j*32+32);if(s.partialFlags)for(let h=0;h<Math.min(32,s.partialFlags.length);h++)x.partialMask[j*32+h]=s.partialFlags[h];}
const rot=(cfg.rotation||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=sd.length).map(n=>n-1);x.rotation.fill(-1);x.rotation2.fill(-1);for(let j=0;j<Math.min(3,rot.length);j++){x.rotation[j]=rot[j];x.rotation2[j]=rot[j];}
for(let l=0;l<8;l++) x.policyK[l]=(x.policyK[l]&255)|((((rot[0]??-1)+1)&15)<<8)|((((rot[1]??-1)+1)&15)<<12)|((((rot[2]??-1)+1)&15)<<16);return x;}

// v27.67: fill eight SIMD lanes with eight *different* candidates. Skills are
// shared by the optimizer, while equipment, policy, rotation and scalar battle
// settings are lane-local. This turns the full-sim8 kernel into an 8-candidate
// coarse-search engine without changing the canonical equations or RNG stream.
function fillFromCfgs(x,cfgs,trialIndex=0){
  if(!Array.isArray(cfgs)||!cfgs.length)throw Error('fillFromCfgs requires candidates');
  const first=cfgs[0], sd=(typeof __compileSkillData==='function'?__compileSkillData(first.skills):(first.skills||[]).map(s=>s));
  for(let l=0;l<8;l++){
    const cfg=cfgs[Math.min(l,cfgs.length-1)]||first, e=cfg.equipment||{};
    x.base[l]=Number(cfg.baseResist)||0;x.rise[l]=Number(cfg.rise)||0;x.fall[l]=Number(cfg.fall)||0;x.ailDur[l]=Number(cfg.ailmentDuration)||0;x.duration[l]=Number(cfg.duration)||0;
    x.critRate[l]=((cfg.specialEffect||'crit')==='crit'?Math.max(0,Math.min(100,Number(cfg.critRate)||0))/100:0);
    x.normalHpm[l]=Math.max(0,Number(cfg.normalHpm??cfg.normalHps*60)||0);
    x.normalRanged[l]=((cfg.specialEffect||'crit')==='crit'?Math.max(0,Math.min(100,Number(cfg.normalRangedRate)||0)):0);
    x.comboRate[l]=Math.max(0,Math.min(100,Number(cfg.comboSuccessRate??100)||0))/100;
    x.hpMax[l]=Math.max(0,Math.min(100,Number(cfg.hpMaxUptime??100)||0))/100;
    x.eqA[l]=Number(e.ailment)||0;x.eqP[l]=Number(e.poisonHit)||0;x.ctPromo[l]=Number(e.ctPromo)||0;x.instantBonus[l]=Number(e.instant)||0;
    const acts=cfg.policy?.segmentActions||[];const K=Math.max(2,Math.min(5,Math.floor(Number(cfg.policy?.segmentCount)||acts.length||2)));
    for(let k=0;k<5;k++)x.policyActions[l*5+k]=Number(acts[k]??0);
    const rot=(cfg.rotation||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=sd.length).map(n=>n-1);
    x.policyK[l]=(K&255)|((((rot[0]??-1)+1)&15)<<8)|((((rot[1]??-1)+1)&15)<<12)|((((rot[2]??-1)+1)&15)<<16);
    x.specialMode[l]=(cfg.specialEffect||'crit')==='combo'?1:((cfg.specialEffect||'crit')==='hpmax'?2:0);
    x.seeds[l]=(((cfg.seed||1234567)+(Math.max(0,Math.floor(cfg.trialStart||0))+trialIndex)*1000003)>>>0);
  }
  for(let j=0;j<3;j++){
    const sk=sd[j]||{};x.ct[j]=Number(sk.ct)||0;x.execution[j]=Number(sk.execution)||0;x.hits[j]=Math.max(0,Math.floor(Number(sk.hits)||0));x.interval[j]=Math.max(0,Number(sk.interval)||0);
    x.skillRanged[j]=Number(sk.rangedRate)||0;x.skillInstant[j]=Number(sk.instant)||0;x.skillPoisonType[j]=sk.type==='special'?2:(sk.poisonType==='partial'?1:0);x.partialChance[j]=Number(sk.partialChance)||0;
    x.partialMask.fill(0,j*32,j*32+32);if(sk.partialFlags)for(let h=0;h<Math.min(32,sk.partialFlags.length);h++)x.partialMask[j*32+h]=sk.partialFlags[h];
  }
  // The native v27.58+ kernel reads per-lane rotations from packed policyK.
  x.rotation.fill(-1);x.rotation2.fill(-1);
  return x;
}
function setCandidateTrialSeeds(x,cfgs,trialIndex){
  for(let l=0;l<8;l++){const cfg=cfgs[Math.min(l,cfgs.length-1)]||cfgs[0];x.seeds[l]=(((cfg.seed||1234567)+(Math.max(0,Math.floor(cfg.trialStart||0))+trialIndex)*1000003)>>>0);}return x;
}
function setTrialLaneSeeds(x,cfg,start){for(let l=0;l<8;l++)x.seeds[l]=(((cfg.seed||1234567)+(start+l)*1000003)>>>0);return x;}
g.SAOFDFullSim8WASM={setModule,init,make,prepare,runPrepared,runCandidateTrialsPrepared,runCandidateMatrix,runPolicyCodeMatrix,decodeStrategyCode,fillFromCfg,fillFromCfgs,setCandidateTrialSeeds,setTrialLaneSeeds};
})(typeof self!=='undefined'?self:window);
