/* v27.43 full one-call simulator bridge. The WASM kernel owns the event scheduler
 * and all deterministic state transitions for eight independent MC trials. */
(function(g){'use strict';
let inst=null,promise=null,traceInst=null,tracePromise=null;
const P={base:0,rise:64,fall:128,ailDur:192,duration:256,critRate:320,normalHpm:384,normalRanged:448,comboRate:512,hpMax:576,eqA:640,eqP:704,ctPromo:768,instantBonus:832,ct:896,execution:920,hits:944,interval:968,skillRanged:992,skillInstant:1016,skillPoisonType:1040,partialChance:1064,partialMask:1088,policyActions:1888,policyK:2208,rotation:2400,specialMode:2416,seeds:2448,rotation2:2496,outUptime:3000,outMaxRes:3064};
const BYTES=262144;
async function init(){if(promise)return promise;promise=(async()=>{try{const r=await fetch((typeof document==='undefined'?'../wasm/':'./wasm/')+'full-sim8.wasm',{cache:'force-cache'});if(!r.ok)throw Error('full-sim8 fetch');inst=(await WebAssembly.instantiate(await r.arrayBuffer(),{})).instance;return true;}catch(e){inst=null;return false;}})();return promise;}
async function initTrace(){if(tracePromise)return tracePromise;tracePromise=(async()=>{try{const r=await fetch((typeof document==='undefined'?'../wasm/':'./wasm/')+'full-sim8-trace-v2758.wasm',{cache:'force-cache'});if(!r.ok)throw Error('full-sim8-trace fetch');traceInst=(await WebAssembly.instantiate(await r.arrayBuffer(),{})).instance;return true;}catch(e){traceInst=null;return false;}})();return tracePromise;}
function ensureTrace(){if(!traceInst)throw Error('full-sim8-trace not initialized');const m=traceInst.exports.memory;const traceCountOff=4096, traceKindOff=8192, traceDataOff=140288, traceFields=32, traceReadyOff=8528896, traceRedOff=9315328, traceCdOff=10101760, traceRngOff=10888192;const need=11019264;if(m.buffer.byteLength<need)m.grow(Math.ceil((need-m.buffer.byteLength)/65536));return {f:new Float64Array(m.buffer),i:new Int32Array(m.buffer),u:new Uint32Array(m.buffer),traceCountOff,traceKindOff,traceDataOff,traceFields,traceReadyOff,traceRedOff,traceCdOff,traceRngOff};}
function decodeTrace(lane,tm){const n=Math.min(tm.i[(tm.traceCountOff>>2)+lane]||0,4096);const out=new Array(n);const kb=(tm.traceKindOff>>2)+lane*4096;const db=(tm.traceDataOff>>3)+lane*4096*tm.traceFields;const ab=(tm.traceReadyOff>>3)+lane*4096*3;const rb=(tm.traceRedOff>>3)+lane*4096*3;const cb=(tm.traceCdOff>>3)+lane*4096*3;const ub=tm.traceRngOff>>2;const names={1:'normal',2:'wait',3:'skill_start',4:'hit',5:'poison',6:'poison_fail',7:'sched',8:'sched_dispatch',9:'hp_tick'};for(let q=0;q<n;q++){const b=db+q*tm.traceFields;const a=ab+q*3;out[q]={kind:names[tm.i[kb+q]]||('event_'+tm.i[kb+q]),t:tm.f[b],resist:tm.f[b+1],poisonUntil:(tm.f[b+2]<-1e20?-Infinity:tm.f[b+2]),u:tm.f[b+3],busyUntil:tm.f[b+4],nextNormal:tm.f[b+5],rngState:tm.u[ub+lane*4096+q],comboHits:tm.f[b+7],special:!!tm.f[b+8],success:tm.i[kb+q]===5?(tm.f[b+26]===1):(tm.i[kb+q]===6?false:undefined),skill:tm.f[b+10],peak:tm.f[b+11],guard:tm.f[b+12],mode:tm.f[b+14],lastHpCheck:tm.f[b+16],hpMaxActive:!!tm.f[b+17],successStreak:tm.f[b+18],action:tm.f[b+19],idx:tm.f[b+20],rot0:tm.f[b+21],rot1:tm.f[b+22],rot2:tm.f[b+23],dbgChance:tm.f[b+24],dbgProb:tm.f[b+25],dbgOk:tm.f[b+26],dbgHit:tm.f[b+27],dbgPc:tm.f[b+28],dbgNextSkill:tm.f[b+29],dbgCandidate:tm.f[b+30],dbgDispatchIdx:tm.f[b+31],hitOrdinal:tm.f[b+13],ready:Array.from(tm.f.subarray(a,a+3)),cooldownReduction:Array.from(tm.f.subarray(rb+q*3,rb+q*3+3)),cooldownStart:Array.from(tm.f.subarray(cb+q*3,cb+q*3+3))};}return out;}
async function inspectInputs(cfg,start=0){
 if(!(await initTrace()))return null; const x=make(); fillFromCfg(x,cfg,start); const tm=ensureTrace(); const set8t=(off,a)=>tm.f.set(a.subarray(0,8),off>>3); const setNt=(off,a,n)=>tm.f.set(a.subarray(0,n),off>>3);
 for(const k of ['base','rise','fall','ailDur','duration','critRate','normalHpm','normalRanged','comboRate','hpMax','eqA','eqP','ctPromo','instantBonus'])set8t(P[k],x[k]);
 for(const k of ['ct','execution','hits','interval','skillRanged','skillInstant','skillPoisonType','partialChance'])setNt(P[k],x[k],3); setNt(P.partialMask,x.partialMask,96); setNt(P.policyActions,x.policyActions,40); tm.i.set(x.policyK.subarray(0,8),P.policyK>>2); tm.i.set(x.rotation.subarray(0,3),P.rotation>>2); tm.i.set(x.rotation.subarray(0,3),P.rotation2>>2); tm.i.set(x.specialMode.subarray(0,8),P.specialMode>>2); tm.u.set(x.seeds.subarray(0,8),P.seeds>>2);
 const scratch=P.outMaxRes; traceInst.exports.inspect_inputs(P.ct,P.execution,P.hits,P.interval,P.policyK,P.rotation,3,scratch); return {js:{hits:Array.from(x.hits),interval:Array.from(x.interval),execution:Array.from(x.execution),policyK:Array.from(x.policyK),rotation:Array.from(x.rotation)},wasm:Array.from(tm.f.subarray(scratch>>3,(scratch>>3)+14))};
}

async function traceRun(cfg,start){if(!(await initTrace()))return null;const x=make();fillFromCfg(x,cfg,start);const tm=ensureTrace();const set8t=(off,a)=>tm.f.set(a.subarray(0,8),off>>3);const setNt=(off,a,n)=>tm.f.set(a.subarray(0,n),off>>3);for(const k of ['base','rise','fall','ailDur','duration','critRate','normalHpm','normalRanged','comboRate','hpMax','eqA','eqP','ctPromo','instantBonus'])set8t(P[k],x[k]);for(const k of ['ct','execution','hits','interval','skillRanged','skillInstant','skillPoisonType','partialChance'])setNt(P[k],x[k],3);setNt(P.partialMask,x.partialMask,96);setNt(P.policyActions,x.policyActions,40);tm.i.set(x.policyK.subarray(0,8),P.policyK>>2);tm.i.set(x.rotation.subarray(0,3),P.rotation>>2);tm.i.set(x.rotation.subarray(0,3),P.rotation2>>2);tm.i.set(x.specialMode.subarray(0,8),P.specialMode>>2);tm.u.set(x.seeds.subarray(0,8),P.seeds>>2);const c=traceInst.exports; c.simulate_full8_trace(P.base,P.rise,P.fall,P.ailDur,P.duration,P.critRate,P.normalHpm,P.normalRanged,P.comboRate,P.hpMax,P.eqA,P.eqP,P.ctPromo,P.instantBonus,P.ct,P.execution,P.hits,P.interval,P.skillRanged,P.skillInstant,P.skillPoisonType,P.partialChance,P.partialMask,P.policyActions,P.policyK,P.rotation,P.specialMode,P.rotation2,P.seeds,3,P.outUptime,P.outMaxRes,P.outMaxRes,tm.traceCountOff,tm.traceKindOff,tm.traceDataOff,tm.traceReadyOff,tm.traceRedOff,tm.traceCdOff,tm.traceRngOff);return {trace:decodeTrace(0,tm),all:Array.from({length:8},(_,lane)=>decodeTrace(lane,tm)),uptime:Array.from(tm.f.subarray(P.outUptime>>3,(P.outUptime>>3)+8)),maxRes:Array.from(tm.f.subarray(P.outMaxRes>>3,(P.outMaxRes>>3)+8))};}
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
function runTrialRangePrepared(x,trials){
 if(!inst)throw Error('full-sim8 not initialized');
 const fn=inst.exports.simulate_full8_trial_range;if(typeof fn!=='function')return null;
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
 const align8=v=>(v+7)&~7;let off=2*1024*1024; // keep dense matrix workspace well above the native stack/static ABI
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
function runPolicyPairMatrix(baseCfg,equipment,pairs,policySpecs,duration,trials,trialStart,seed){
 if(!inst||!Array.isArray(pairs)||!pairs.length)return null;
 const fn=inst.exports.simulate_candidate_matrix;if(typeof fn!=='function')return null;
 const n=pairs.length,firstPair=pairs[0],firstPolicy=policySpecs[Number(firstPair.index)];if(!firstPolicy)return null;
 const first={...baseCfg,equipment,rotation:firstPair.rotation,policy:firstPolicy,duration,trials,trialStart,seed};
 const x=make();fillFromCfgs(x,[first],0);prepare(x);
 const align8=v=>(v+7)&~7;let off=2*1024*1024;
 const eqA=off;off=align8(off+n*8);const eqP=off;off=align8(off+n*8);const ctPromo=off;off=align8(off+n*8);const instant=off;off=align8(off+n*8);
 const actions=off;off=align8(off+n*5*8);const pks=off;off=align8(off+n*4);const seeds=off;off=align8(off+n*4);
 const outU=off;off=align8(off+n*8);const outM=off;off=align8(off+n*8);
 const {f,i,u}=ensureBytes(off+64),bEA=eqA>>3,bEP=eqP>>3,bCT=ctPromo>>3,bIN=instant>>3,bA=actions>>3,bPK=pks>>2,bS=seeds>>2;
 const e=equipment||{};f.fill(Number(e.ailment)||0,bEA,bEA+n);f.fill(Number(e.poisonHit)||0,bEP,bEP+n);f.fill(Number(e.ctPromo)||0,bCT,bCT+n);f.fill(Number(e.instant)||0,bIN,bIN+n);
 const skillCount=Math.max(1,Math.min(3,(baseCfg.skills||[]).length||3)),firstSeed=(((seed||1234567)+Math.max(0,Math.floor(trialStart||0))*1000003)>>>0);u.fill(firstSeed,bS,bS+n);
 for(let q=0;q<n;q++){
   const pair=pairs[q],pol=policySpecs[Number(pair.index)];if(!pol)return null;const acts=pol.segmentActions||[];
   for(let k=0;k<5;k++)f[bA+q*5+k]=Number(acts[k]??0);
   const K=Math.max(2,Math.min(5,Math.floor(Number(pol.segmentCount)||acts.length||2))),r=pair.rotation||[];
   const r0=Number.isInteger(r[0])&&r[0]>=1&&r[0]<=skillCount?r[0]:0,r1=Number.isInteger(r[1])&&r[1]>=1&&r[1]<=skillCount?r[1]:0,r2=Number.isInteger(r[2])&&r[2]>=1&&r[2]<=skillCount?r[2]:0;
   i[bPK+q]=(K&255)|((r0&15)<<8)|((r1&15)<<12)|((r2&15)<<16);
 }
 fn(P.base,P.rise,P.fall,P.ailDur,P.duration,P.critRate,P.normalHpm,P.normalRanged,P.comboRate,P.hpMax,
   P.ct,P.execution,P.hits,P.interval,P.skillRanged,P.skillInstant,P.skillPoisonType,P.partialChance,P.partialMask,P.specialMode,P.rotation,P.rotation2,
   eqA,eqP,ctPromo,instant,actions,pks,seeds,n,skillCount,Math.max(1,Math.floor(Number(trials)||1)),outU,outM);
 return new Float64Array(f.slice(outU>>3,(outU>>3)+n));
}

function run(x){prepare(x);return runPrepared(x,false);}
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
function fillFromCfgStarts(x,cfg,starts){
  const e=cfg.equipment||{},sd=(typeof __compileSkillData==='function'?__compileSkillData(cfg.skills):(cfg.skills||[]).map(s=>s));
  const rot=(cfg.rotation||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=sd.length).map(n=>n-1);
  for(let l=0;l<8;l++){
    const start=Number(starts[l]??0);
    x.base[l]=Number(cfg.baseResist)||0;x.rise[l]=Number(cfg.rise)||0;x.fall[l]=Number(cfg.fall)||0;x.ailDur[l]=Number(cfg.ailmentDuration)||0;x.duration[l]=Number(cfg.duration)||0;
    x.critRate[l]=((cfg.specialEffect||'crit')==='crit'?Math.max(0,Math.min(100,Number(cfg.critRate)||0))/100:0);
    x.normalHpm[l]=Math.max(0,Number(cfg.normalHpm??cfg.normalHps*60)||0);
    x.normalRanged[l]=((cfg.specialEffect||'crit')==='crit'?Math.max(0,Math.min(100,Number(cfg.normalRangedRate)||0)):0);
    x.comboRate[l]=Math.max(0,Math.min(100,Number(cfg.comboSuccessRate??100)||0))/100;
    x.hpMax[l]=Math.max(0,Math.min(100,Number(cfg.hpMaxUptime??100)||0))/100;
    x.eqA[l]=Number(e.ailment)||0;x.eqP[l]=Number(e.poisonHit)||0;x.ctPromo[l]=Number(e.ctPromo)||0;x.instantBonus[l]=Number(e.instant)||0;
    x.policyK[l]=Math.max(2,Math.min(5,Math.floor(Number(cfg.policy?.segmentCount)||cfg.policy?.segmentActions?.length||2)));
    const acts=cfg.policy?.segmentActions||[];for(let k=0;k<5;k++)x.policyActions[l*5+k]=Number(acts[k]??0);
    x.specialMode[l]=(cfg.specialEffect||'crit')==='combo'?1:((cfg.specialEffect||'crit')==='hpmax'?2:0);
    x.seeds[l]=(((cfg.seed||1234567)+(start)*1000003)>>>0);
    x.policyK[l]=(x.policyK[l]&255)|((((rot[0]??-1)+1)&15)<<8)|((((rot[1]??-1)+1)&15)<<12)|((((rot[2]??-1)+1)&15)<<16);
  }
  for(let j=0;j<3;j++){const sk=sd[j]||{};x.ct[j]=Number(sk.ct)||0;x.execution[j]=Number(sk.execution)||0;x.hits[j]=Math.max(0,Math.floor(Number(sk.hits)||0));x.interval[j]=Math.max(0,Number(sk.interval)||0);x.skillRanged[j]=Number(sk.rangedRate)||0;x.skillInstant[j]=Number(sk.instant)||0;x.skillPoisonType[j]=sk.type==='special'?2:(sk.poisonType==='partial'?1:0);x.partialChance[j]=Number(sk.partialChance)||0;x.partialMask.fill(0,j*32,j*32+32);if(sk.partialFlags)for(let h=0;h<Math.min(32,sk.partialFlags.length);h++)x.partialMask[j*32+h]=sk.partialFlags[h];}
  x.rotation.fill(-1);x.rotation2.fill(-1);for(let j=0;j<Math.min(3,rot.length);j++){x.rotation[j]=rot[j];x.rotation2[j]=rot[j];}
}
async function traceRunsForStarts(cfg,starts){
  if(!(await initTrace()))return null;
  const x=make();fillFromCfgStarts(x,cfg,starts);
  const tm=ensureTrace();const set8t=(off,a)=>tm.f.set(a.subarray(0,8),off>>3);const setNt=(off,a,n)=>tm.f.set(a.subarray(0,n),off>>3);
  for(const k of ['base','rise','fall','ailDur','duration','critRate','normalHpm','normalRanged','comboRate','hpMax','eqA','eqP','ctPromo','instantBonus'])set8t(P[k],x[k]);
  for(const k of ['ct','execution','hits','interval','skillRanged','skillInstant','skillPoisonType','partialChance'])setNt(P[k],x[k],3);
  setNt(P.partialMask,x.partialMask,96);setNt(P.policyActions,x.policyActions,40);tm.i.set(x.policyK.subarray(0,8),P.policyK>>2);tm.i.set(x.rotation.subarray(0,3),P.rotation>>2);tm.i.set(x.rotation.subarray(0,3),P.rotation2>>2);tm.i.set(x.specialMode.subarray(0,8),P.specialMode>>2);tm.u.set(x.seeds.subarray(0,8),P.seeds>>2);
  const c=traceInst.exports;c.simulate_full8_trace(P.base,P.rise,P.fall,P.ailDur,P.duration,P.critRate,P.normalHpm,P.normalRanged,P.comboRate,P.hpMax,P.eqA,P.eqP,P.ctPromo,P.instantBonus,P.ct,P.execution,P.hits,P.interval,P.skillRanged,P.skillInstant,P.skillPoisonType,P.partialChance,P.partialMask,P.policyActions,P.policyK,P.rotation,P.specialMode,P.rotation2,P.seeds,3,P.outUptime,P.outMaxRes,P.outMaxRes,tm.traceCountOff,tm.traceKindOff,tm.traceDataOff,tm.traceReadyOff,tm.traceRedOff,tm.traceCdOff,tm.traceRngOff);
  return {all:Array.from({length:Math.min(8,starts.length)},(_,lane)=>decodeTrace(lane,tm)),uptime:Array.from(tm.f.subarray(P.outUptime>>3,(P.outUptime>>3)+8)),maxRes:Array.from(tm.f.subarray(P.outMaxRes>>3,(P.outMaxRes>>3)+8))};
}
async function firstDivergenceBatch(cfg,starts=[0,1,7,13,31],opts={}){
  const ss=starts.slice(0,8).map(Number);const wr=await traceRunsForStarts({...cfg,trials:1,trialStart:0},ss);if(!wr)return {ok:false,reason:'trace-init'};
  for(let lane=0;lane<ss.length;lane++){
    const start=ss[lane],canonical=runSimulationFast({...cfg,trials:1,trialStart:start,__eventTrace:true}),tree=wr.all[lane]||[];const ca=canonical?.__eventTrace||[];const n=Math.max(ca.length,tree.length);
    for(let i=0;i<n;i++){
      if(i>=ca.length||i>=tree.length)return {ok:false,start,lane,reason:'trace-length',index:i,canonicalLength:ca.length,wasmLength:tree.length,canonical:ca[i]||null,wasm:tree[i]||null};
      const x=ca[i],y=tree[i];const keys=['kind','t','poisonUntil','resist','u','busyUntil','nextNormal','rngState','comboHits','skill','success','lastHpCheck','hpMaxActive','successStreak'];if(opts.compareSchedulerDebug===true)keys.push('dbgNextSkill','dbgCandidate','dbgDispatchIdx');
      for(const k of keys){let a=x?.[k],b=y?.[k];if(k==='skill'&&Number(b)===-1)b=undefined;if(a==null&&b==null)continue;if(k==='kind'||k==='hpMaxActive'?a!==b:!(Object.is(a,b)||Math.abs(Number(a)-Number(b))<=1e-12))return {ok:false,start,lane,index:i,key:k,canonical:x,wasm:y,canonicalPrefix:ca.slice(0,i+1),wasmPrefix:tree.slice(0,i+1)};}
      for(const k of ['ready','cooldownReduction','cooldownStart']){const aa=x?.[k]||[],bb=y?.[k]||[];if(aa.length!==bb.length)return {ok:false,start,lane,index:i,key:k+'#length',canonical:x,wasm:y};for(let j=0;j<aa.length;j++)if(!(Object.is(aa[j],bb[j])||Math.abs(Number(aa[j])-Number(bb[j]))<=1e-12))return {ok:false,start,lane,index:i,key:k+'['+j+']',canonical:x,wasm:y,canonicalPrefix:ca.slice(0,i+1),wasmPrefix:tree.slice(0,i+1)};}
    }
  }
  return {ok:true,checked:ss.length};
}
async function simulate(cfg,start){if(!(await init()))return null;if(!cfg.policy||!Array.isArray(cfg.policy.segmentActions))return null;const x=make();fillFromCfg(x,cfg,start);run(x);return {uptime:Array.from(x.outUptime),maxRes:Array.from(x.outMaxRes)};}
async function selfTest(){
 if(!(await init())||!inst)return false;
 // Structural WASM sanity: exported scheduler must be callable.
 return typeof inst.exports.simulate_full8==='function' && !!inst.exports.memory;
}
async function differentialBatch(cfg, starts=[0,1,7,13,31]){
 if(!(await init()))return {ok:false,reason:'wasm-init'};
 const failures=[];
 const modes=['crit','combo','hpmax'];
 const policies=[];
 const K=4;
 for(let a=0;a<4;a++){ const acts=new Array(K).fill(0); acts[0]=a; policies.push({segmentActions:acts,segmentCount:K,ailmentDuration:Number(cfg.ailmentDuration)||10}); }
 for(const mode of modes){
  for(const p of policies){
   for(const st of starts){
    const c={...cfg,specialEffect:mode,policy:p,trials:1,trialStart:st};
    const x=make(); fillFromCfg(x,c,st); run(x);
    for(let lane=0;lane<8;lane++){
      const ref=runSimulationFast({...c,trials:1,trialStart:st+lane});
      const du=Math.abs(Number(x.outUptime[lane])-Number(ref?.uptime||0));
      const hasMax=ref&&Number.isFinite(Number(ref.maxRes)); const dm=hasMax?Math.abs(Number(x.outMaxRes[lane])-Number(ref.maxRes)):0;
      if(du>1e-12||dm>1e-12) failures.push({mode,policy:p.segmentActions.join(''),start:st,lane,uptimeWasm:x.outUptime[lane],uptimeRef:ref?.uptime,maxResWasm:x.outMaxRes[lane],maxResRef:hasMax?ref.maxRes:null});
    }
   }
  }
 }
 return {ok:failures.length===0,checked:modes.length*policies.length*starts.length*8,failures:failures.slice(0,20)};
}

async function firstDivergence(cfg,start=0,opts={}){
  return firstDivergenceBatch(cfg,[start],opts);
}


async function parityAudit(cfg,opts={}){ return parityMatrix(cfg,opts); }

async function parityMatrix(cfg,opts={}){
  const modes=Array.isArray(opts.modes)&&opts.modes.length?opts.modes:['crit','combo','hpmax'];
  const rotations=Array.isArray(opts.rotations)&&opts.rotations.length?opts.rotations:[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];
  const starts=Array.isArray(opts.starts)&&opts.starts.length?opts.starts:[0,7,31];
  const maxCases=Math.max(1,Math.floor(opts.maxCases||1000));
  const policies=[];
  for(let k=2;k<=5;k++){
    for(let a=0;a<4;a++){
      policies.push({segmentActions:new Array(k).fill(a),segmentCount:k,ailmentDuration:Number(cfg.ailmentDuration)||10,label:`K${k}:${a}`});
    }
    for(let a=0;a<4;a++)for(let b=0;b<4;b++)if(a!==b){const x=new Array(k).fill(a);x[k-1]=b;policies.push({segmentActions:x,segmentCount:k,ailmentDuration:Number(cfg.ailmentDuration)||10,label:`K${k}:${a}->${b}`});}
  }
  const counts={},examples=[];let checked=0,ok=0;
  outer:for(const mode of modes)for(const rotation of rotations)for(const policy of policies){
    const remaining=maxCases-checked;if(remaining<=0)break outer;
    const ss=starts.slice(0,Math.min(8,remaining));
    const batch=await firstDivergenceBatch({...cfg,specialEffect:mode,rotation,policy},ss);
    // firstDivergenceBatch returns the first failing lane; recover per-start diagnostics
    // only when a failure exists, so the common all-pass case stays one WASM call.
    if(batch&&batch.ok){ok+=ss.length;checked+=ss.length;continue;}
    for(const start of ss){
      if(checked>=maxCases)break;
      const d=await firstDivergence({...cfg,specialEffect:mode,rotation,policy},start); checked++;
      if(d.ok){ok++;continue;}
      const cls=(typeof g.SAOFDEParityRepair!=='undefined'&&g.SAOFDEParityRepair.classify)?g.SAOFDEParityRepair.classify(d):{area:d.key||'unknown',key:d.key};
      const key=cls.area||d.key||'unknown'; counts[key]=(counts[key]||0)+1;
      if(examples.length<20)examples.push({mode,rotation,policy:policy.label,start,index:d.index,key:d.key,area:key});
    }
  }
  const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([area,count])=>({area,count,ratio:checked?count/checked:0}));
  return {checked,ok,failures:checked-ok,ranked,examples};
}

g.SAOFDFullSim8WASM={init,make,prepare,runPrepared,runCandidateTrialsPrepared,runTrialRangePrepared,runCandidateMatrix,runPolicyPairMatrix,run,simulate,fillFromCfg,fillFromCfgs,setCandidateTrialSeeds,setTrialLaneSeeds,selfTest,differentialBatch,firstDivergence,firstDivergenceBatch,parityMatrix,parityAudit,inspectInputs};
})(typeof self!=='undefined'?self:window);
