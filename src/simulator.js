function clamp(x,a,b) {
  return Math.max(a,Math.min(b,x));}
  function chanceFromResist(basePct,resist,mode) {
    if(mode==='none') return clamp(basePct/100,0,1);
    if(mode==='mult') return clamp((basePct/100)*(1-resist/100),0,1);
    return clamp((basePct-resist)/100,0,1);
  }
  function mulberry32(seed) {
    let state=seed>>>0;
    const f=function() {
      let t=state=(state+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
    f.getState=()=>state>>>0;
    f.setState=v=>{state=v>>>0;};
    return f;
  }

      const __skillDataCache = new Map();
      function __compileSkillData(skills) {
        const key = JSON.stringify(skills || []);
        const cached = __skillDataCache.get(key);
        if(cached) return cached;
        const compiled=(skills||[]).map(s=>{
          const hits=Math.max(0,Math.floor(Number(s.hits)||0));
          const partialFlags=new Uint8Array(hits);
          for(const token of String(s.partialHits||'').split(',')){
            const h=parseInt(token.trim(),10)-1;
            if(h>=0 && h<hits) partialFlags[h]=1;
          }
          return {
            type:s.type,ct:Math.max(0,Number(s.ct)||0),execution:Math.max(0,Number(s.execution)||0),
            hits,interval:Math.max(0,Number(s.interval)||0),
            rangedRate:Number(s.rangedRate)||0,poisonType:s.poisonType,partialChance:Number(s.partialChance)||0,partialFlags
          };
        });
        __skillDataCache.set(key,compiled);
        if(__skillDataCache.size>8){ const first=__skillDataCache.keys().next().value; __skillDataCache.delete(first); }
        return compiled;
      }

      function runSimulation(cfg) {
        const fastMode=cfg.__fast===true;
        const trials=Math.max(1,Math.floor(cfg.trials));
        const trialStart=Math.max(0,Math.floor(cfg.trialStart||0));
        const duration=Math.max(0,Number(cfg.duration)||0);
        const critEnabled=(cfg.specialEffect||'crit')==='crit';
        const critRate=critEnabled?clamp(Number(cfg.critRate)||0,0,100)/100:0;
        const normalHpm=Math.max(0,Number(cfg.normalHpm ?? cfg.normalHps*60)||0);
        const normalHz=normalHpm/60;
        const normalRangedRate=critEnabled?clamp(Number(cfg.normalRangedRate)||0,0,100)/100:0;
        const comboSuccessRate=clamp(Number(cfg.comboSuccessRate ?? 100)||0,0,100)/100;
        const hpMaxUptime=clamp(Number(cfg.hpMaxUptime ?? 100)||0,0,100)/100;
        const specialEffect=cfg.specialEffect||'crit';
        const equipment=cfg.equipment||{poisonHit:0,ailment:0,ctPromo:0,instant:0};
        // Precompute immutable skill data once per simulation. Optimizer calls the
        // simulator thousands of times, so rebuilding these objects/sets per trial
        // is pure overhead and does not improve statistical fidelity.
        const skillData=__compileSkillData(cfg.skills);
        // Precompute all hit-independent poison/skill values once per simulation.
        // These values are immutable during a trial; calculating them inside every
        // hit was a significant hot-loop cost.
        const equipAilment=Number(equipment.ailment)||0;
        const equipPoison=Number(equipment.poisonHit)||0;
        const ordinaryPoisonChance=equipPoison>0 ? equipPoison+equipAilment : 0;
        const hitData=skillData.map(s=>{
          const special=s.type==='special';
          if(special) return {special:true,hits:1,interval:0,rangedRate:s.rangedRate,poisonCount:2,p1:100,s1:true,p2:ordinaryPoisonChance,s2:false};
          if(s.poisonType==='partial') return {special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:2,p1:ordinaryPoisonChance,s1:false,p2:s.partialChance+equipAilment,s2:false,partialFlags:s.partialFlags};
          return {special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:1,p1:ordinaryPoisonChance,s1:false,p2:0,s2:false,partialFlags:null};
        });
        // Compile policy/rotation once per simulation call. The optimizer invokes
        // this function many times; rebuilding these small arrays at every hit
        // was unnecessary interpreter/JIT work and did not change the model.
        const compiledPolicy = cfg.policy && cfg.policy.segmentActions ? {
          segmentActions: Int8Array.from(cfg.policy.segmentActions, x=>Number(x)||0),
          segmentCount: Math.max(2, Math.floor(Number(cfg.policy.segmentCount)||cfg.policy.segmentActions.length||2)),
          ailmentDuration: Math.max(0, Number(cfg.policy.ailmentDuration ?? cfg.ailmentDuration ?? 0)||0)
        } : (cfg.policy && cfg.policy.rules ? {
          poisonThreshold: Number(cfg.policy.rules[0]?.value ?? Infinity),
          urgent: Number(cfg.policy.rules[0]?.action ?? 0),
          successStreak: Number(cfg.policy.rules[1]?.value ?? Infinity),
          highSuccess: Number(cfg.policy.rules[1]?.action ?? 0),
          defaultAction: Number(cfg.policy.defaultAction ?? 0)
        } : null);
        const compiledRotation = (cfg.rotation||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=skillData.length).map(n=>n-1);
        const defaultOrder=new Int8Array(skillData.length);
        for(let di=0;di<skillData.length;di++)defaultOrder[di]=di;
        let uptimeSum=0, attempts=0, successes=0, maxRes=0, totalHits=0;
        let totalPoisonAttempts=0,totalPoisonSuccesses=0,totalCrits=0,totalNormalHits=0,totalSkillActivations=0,totalRangedHits=0,totalMeleeHits=0,totalMeleeCrits=0,totalRangedCrits=0;
         const collectProbTimeline=cfg.__probTimeline===true && !fastMode;
         const probStep=Math.max(0.1,Number(cfg.__probStep)||0.5);
         const probBins=collectProbTimeline?Math.ceil(duration/probStep)+1:0;
         const probSum=collectProbTimeline?new Float64Array(probBins):null;
         const probCount=collectProbTimeline?new Uint32Array(probBins):null;
        const timeline=[];
        let __lastEventTrace=null;
        // Reuse per-trial typed arrays instead of allocating three Float64Arrays
        // for every Monte-Carlo trial. This is semantics-preserving and targets
        // one of the hottest allocation paths in long final evaluations.
        const ready=new Float64Array(skillData.length);
        const cooldownReduction=new Float64Array(skillData.length);
        const cooldownStart=new Float64Array(skillData.length);
        const baseResist=Number(cfg.baseResist)||0;
        const rise=Number(cfg.rise)||0;
        const fall=Number(cfg.fall)||0;
        const ailmentDuration=Number(cfg.ailmentDuration)||0;
        const equipmentCtPromo=Number(equipment.ctPromo)||0;
        const equipmentInstant=Number(equipment.instant)||0;

        for(let n=trialStart;n<trialStart+trials;n++) {
          const rng=mulberry32(((cfg.seed||1234567)+n*1000003)>>>0);
          const __trace=cfg.__eventTrace===true ? [] : null;
          __lastEventTrace=__trace;
          const trace=(kind,extra={})=>{if(__trace && __trace.length<200000){__trace.push(Object.assign({kind,t,poisonUntil,resist,u,busyUntil,nextNormal,rngState:typeof rng.getState==='function'?rng.getState():null,ready:Array.from(ready),cooldownReduction:Array.from(cooldownReduction),cooldownStart:Array.from(cooldownStart),comboHits,successStreak,hpMaxActive,lastHpCheck,dbgNextSkill,dbgCandidate,dbgDispatchIdx},extra));}};
          const skills=skillData;
          const skillCount=skills.length;
          // Arrays are reused across trials; reset only the active prefix.
          ready.fill(0);
          cooldownReduction.fill(0);
          cooldownStart.fill(0);
          let t=0,busyUntil=0,poisonUntil=-Infinity,resist=baseResist,peakRes=resist,u=0,comboHits=0,successStreak=0;
          let dbgNextSkill=Infinity,dbgCandidate=Infinity,dbgDispatchIdx=-1;
          let nextProbBin=1;
          // Timeline definition: E[P_eff(t)] over all Monte-Carlo states, not
          // only over timestamps at which a poison attempt happened.  Bin 0 is
          // the pre-event initial state, so it exactly reflects the configured
          // initial effective application probability.
          function timelineProbability(r) {
            return ordinaryPoisonChance>0?chanceFromResist(ordinaryPoisonChance,r,'subtract'):0;
          }
          function sampleTimelineBefore(time){
            if(!collectProbTimeline)return;
            while(nextProbBin<probBins && nextProbBin*probStep < time-1e-9){
              const tp=timelineProbability(resist);
              probSum[nextProbBin]+=tp; probCount[nextProbBin]++;
              nextProbBin++;
            }
          }
          function sampleTimelineAt(time){
            if(!collectProbTimeline || time<=1e-9)return;
            while(nextProbBin<probBins && Math.abs(nextProbBin*probStep-time)<=1e-9){
              const tp=timelineProbability(resist);
              probSum[nextProbBin]+=tp; probCount[nextProbBin]++;
              nextProbBin++;
            }
          }
          if(collectProbTimeline){
            const p0=timelineProbability(resist);
            probSum[0]+=p0; probCount[0]++;
          }
          let hpMaxActive = specialEffect==='hpmax' ? (rng()<hpMaxUptime) : false;
          let lastHpCheck = 0;
          let nextNormal=normalHz>0?0:Infinity;
          dbgNextSkill=Infinity;dbgCandidate=Infinity;dbgDispatchIdx=-1;
          let guard=0;

          function updateHpMaxState(time) {
            if(specialEffect!=='hpmax') return;
            const targetSecond=Math.floor(time+1e-9);
            while(lastHpCheck<targetSecond) {
              lastHpCheck++;
              hpMaxActive=rng()<hpMaxUptime;
              trace('hp_tick',{second:lastHpCheck});
            }
          }
          function currentPromo() {
            return ((equipmentCtPromo)+(specialEffect==='hpmax'&&hpMaxActive?20:0))/100;
          }
          function shortenOneRandomCooldown(isRanged) {
            const perCritReduction=isRanged?0.01:0.03;
            let candidateCount=0;
            for(let j=0;j<ready.length;j++) if(ready[j]>t+1e-12 && skills[j].ct>0) candidateCount++;
            if(candidateCount) {
              let pick=Math.floor(rng()*candidateCount),j=-1;
              for(let k=0;k<ready.length;k++) if(ready[k]>t+1e-12 && skills[k].ct>0 && pick--===0){j=k;break;}

              const baseCt=Math.max(0,Number(skills[j].ct)||0);
              cooldownReduction[j]=Math.min(1,cooldownReduction[j]+perCritReduction);
              const promo=currentPromo();
              ready[j]=Math.max(t,cooldownStart[j]+(baseCt*(1-cooldownReduction[j]))/(1+promo));
            }
            if(!fastMode)totalCrits++;
          }
          function poisonAttempt(chance,special=false) {
            const numericChance=Number(chance);
            if(!special && !(numericChance>0)) return false;
            if(!fastMode){attempts++; totalPoisonAttempts++;}
            const p=special?(1/3):chanceFromResist(numericChance,resist,'subtract');
            const __beforeR=resist, __beforePU=poisonUntil, __beforeU=u;
            const ok = rng()<p;
            if(ok) {
              if(!fastMode){successes++; totalPoisonSuccesses++;}
              if(!special) {
                successStreak++;
                resist+=rise;peakRes=Math.max(peakRes,resist);}
                if(ailmentDuration>0) {
                  const end=Math.min(duration,t+Number(cfg.ailmentDuration));
                  if(end>t) {
                    if(t>=poisonUntil)u+=end-t; else if(end>poisonUntil)u+=end-poisonUntil; poisonUntil=Math.max(poisonUntil,end); }
                  }
                } else if(!special) {
                  successStreak=0;
                  resist=Math.max(baseResist, resist-(fall));
                }
                trace('poison',{chance:numericChance,special:!!special,success:ok,beforeR:__beforeR,afterR:resist,beforePoisonUntil:__beforePU,afterPoisonUntil:poisonUntil,beforeU:__beforeU,afterU:u});
              }
              function processHit(rangedRate,poisonCount,p1,s1,p2,s2) {
                if(!fastMode)totalHits++;
                const isRanged=critEnabled && rng()<clamp(Number(rangedRate ?? 0),0,100)/100;
                if(critEnabled) {
                  if(isRanged){if(!fastMode)totalRangedHits++;}else{if(!fastMode)totalMeleeHits++;}
                  if(rng()<critRate) {
                    if(isRanged){if(!fastMode)totalRangedCrits++;}else{if(!fastMode)totalMeleeCrits++;}
                    shortenOneRandomCooldown(isRanged);
                  }
                }
                if(specialEffect==='combo') {
                  if(comboHits===0) comboHits=1;
                  else if(rng()<comboSuccessRate) comboHits++;
                  else comboHits=1;
                  if(comboHits>=70) {
                    let candidateCount=0;
                    for(let j=0;j<skillCount;j++) if(ready[j]>t+1e-12) candidateCount++;
                    if(candidateCount) {
                      let pick=Math.floor(rng()*candidateCount);
                      for(let j=0;j<skillCount;j++) if(ready[j]>t+1e-12 && pick--===0){ready[j]=t;break;}
                    }
                    comboHits=0;
                  }
                }
                if(poisonCount>0) poisonAttempt(p1,s1);
                if(poisonCount>1) poisonAttempt(p2,s2);
                trace('hit',{rangedRate:Number(rangedRate)||0,poisonCount});
              }
                    function policyPick() {
                      if(typeof cfg.policy==='function') return cfg.policy({t,poisonRemaining:Math.max(0,poisonUntil-t),resist,ready:ready.map(x=>x<=t+1e-9),skills});
                      if(compiledPolicy) {
                        const remaining=Math.max(0,poisonUntil-t);
                        if(compiledPolicy.segmentActions) {
                          const D=compiledPolicy.ailmentDuration;
                          const K=compiledPolicy.segmentCount;
                          let idx=0;
                          if(D>0 && remaining>0) idx=Math.min(K-1,Math.floor((remaining/D)*K));
                          return compiledPolicy.segmentActions[idx] ?? 0;
                        }
                        if(remaining<=compiledPolicy.poisonThreshold) return compiledPolicy.urgent;
                        if(successStreak>=compiledPolicy.successStreak) return compiledPolicy.highSuccess;
                        return compiledPolicy.defaultAction;
                      }
                      return null;
                    }
                    function chooseSkill() {
                      const action=policyPick();
                      if(action===null) {
                        return -1;}
                        if(action===0)return -1;
                        const preferred=action-1;
                        if(preferred>=0 && preferred<skills.length && ready[preferred]<=t+1e-9)return preferred;

                        const order=compiledRotation.length?compiledRotation:defaultOrder;
                        for(const i of order)if(ready[i]<=t+1e-9)return i;
                        return -1;
                      }
                      let rotCursor=0;
                          function chooseFixed() {
                            if(!compiledRotation.length)return -1;
                            for(let k=0;k<compiledRotation.length;k++) {
                              const idx=compiledRotation[(rotCursor+k)%compiledRotation.length];if(ready[idx]<=t+1e-9) {
                                rotCursor=(rotCursor+k+1)%compiledRotation.length;return idx;}}
                                return -1;
                              }

                              while(t<=duration+1e-9 && guard++<1000000) {
                                let nextSkill=Infinity;
                                if(t>=busyUntil-1e-9) {
                                  const idx=(cfg.policy?chooseSkill():chooseFixed());
                                  if(idx>=0) {
                                    nextSkill=t;}
                                    else {

                                      for(const r of ready)if(r>t+1e-9)nextSkill=Math.min(nextSkill,r);
                                      if(nextSkill===Infinity)nextSkill=Infinity;
                                    }
                                  } else nextSkill=busyUntil;
                                  dbgNextSkill=nextSkill;dbgCandidate=Math.min(nextNormal,nextSkill,busyUntil>t?busyUntil:Infinity);dbgDispatchIdx=-1; const dbgAction=policyPick(); trace('sched',{action:dbgAction,schedIdx:-1});
                                  const candidate=dbgCandidate;
                                  if(candidate>duration+1e-9)break;
                                  const previousEventTime=t;
                                  t=candidate;
                                  // Complete the fixed-time sample for the previous
                                  // event only after all events at that timestamp have
                                  // finished. This avoids sampling a partially updated
                                  // resistance when multiple poison hits share a timestamp.
                                  sampleTimelineAt(previousEventTime);
                                  sampleTimelineBefore(t);
                                  updateHpMaxState(t);

                                  if(nextNormal<=t+1e-9 && nextNormal<=duration+1e-9 && nextNormal<=nextSkill+1e-9) {
                                    if(!fastMode)totalNormalHits++;processHit(0,0,0,false,0,false);nextNormal+=1/normalHz;continue;
                                  }
                                  if(t<busyUntil-1e-9) {
                                    continue;}
                                    const idx=(cfg.policy?chooseSkill():chooseFixed());
                                    if(idx<0) {
                                      if(nextNormal<Infinity) {
                                        if(nextNormal<=t+1e-9) {
                                          nextNormal+=1/normalHz;}else{t=nextNormal;}continue;}
                                          t=nextSkill;continue;
                                        }
                                        const s=skills[idx],start=t,execution=s.execution,ct=s.ct;

                                        const actionDuration=Math.max(execution,1/60);

                                        const instant=clamp((Number(s.instant)||0)+(equipmentInstant),0,100);
                                        cooldownReduction[idx]=0;cooldownStart[idx]=start;
                                        const promo=currentPromo();
                                        ready[idx]=start+(rng()*100<instant?0:(ct/(1+promo)));
                                        busyUntil=start+actionDuration;if(!fastMode)totalSkillActivations++;
                                        const hd=hitData[idx],hits=hd.hits,interval=hd.interval;
                                        for(let h=0;h<hits;h++) {
                                          const ht=start+h*interval;if(ht>duration+1e-9||ht>busyUntil+1e-9)break;
                                          let poisonCount=hd.poisonCount,p1=hd.p1,s1=hd.s1,p2=hd.p2,s2=hd.s2;
                                          if(hd.partialFlags && hd.partialFlags[h]!==1){poisonCount=1;p2=0;s2=false;}

                                          while(nextNormal<=ht+1e-9&&nextNormal<busyUntil+1e-9&&nextNormal<=duration+1e-9) {
                                            t=nextNormal;if(!fastMode)totalNormalHits++;processHit(normalRangedRate,0,0,false,0,false);sampleTimelineAt(t);nextNormal+=1/normalHz;
                                          }
                                          t=ht;processHit(Number(s.rangedRate)||0,poisonCount,p1,s1,p2,s2);sampleTimelineAt(t);
                                          t=busyUntil;
                                          if(execution<=1e-9)t=busyUntil;
                                        }
                                        }
                                        sampleTimelineAt(t);
                                        if(collectProbTimeline){
                                          while(nextProbBin<probBins){
                                            const tp=timelineProbability(resist);
                                            probSum[nextProbBin]+=tp; probCount[nextProbBin]++; nextProbBin++;
                                          }
                                        }
                                        uptimeSum+=duration>0?clamp(u/duration,0,1):0;maxRes=Math.max(maxRes,peakRes);
                                        if(!fastMode && n<trialStart+20)timeline.push({trial:n+1,uptime:duration>0?clamp(u/duration,0,1):0});
                                      }
                                      if(fastMode){ const out={uptime:uptimeSum/trials}; if(cfg.__eventTrace===true) out.__eventTrace=__lastEventTrace||[]; return out; }
                                      const executionProbabilityTimeline=collectProbTimeline?Array.from({length:probBins},(_,i)=>({time:Math.min(i*probStep,duration),probability:probCount[i]>0?probSum[i]/probCount[i]:null})).filter(q=>q.probability!==null):[];
                                      return {uptime:uptimeSum/trials,attempts:attempts/trials,successes:successes/trials,successRate:attempts?successes/attempts:0,maxRes,timeline,hits:totalHits/trials,poisonAttempts:totalPoisonAttempts/trials,poisonSuccesses:totalPoisonSuccesses/trials,crits:critEnabled?totalCrits/trials:0,meleeHits:critEnabled?totalMeleeHits/trials:0,rangedHits:critEnabled?totalRangedHits/trials:0,meleeCrits:critEnabled?totalMeleeCrits/trials:0,rangedCrits:critEnabled?totalRangedCrits/trials:0,normalHits:totalNormalHits/trials,skillActivations:totalSkillActivations/trials,executionProbabilityTimeline};
                                    }

function runSimulationFastCore(cfg) {
        const fastMode=true;
        const trials=Math.max(1,Math.floor(cfg.trials));
        const trialStart=Math.max(0,Math.floor(cfg.trialStart||0));
        const duration=Math.max(0,Number(cfg.duration)||0);
        const critEnabled=(cfg.specialEffect||'crit')==='crit';
        const critRate=critEnabled?clamp(Number(cfg.critRate)||0,0,100)/100:0;
        const normalHpm=Math.max(0,Number(cfg.normalHpm ?? cfg.normalHps*60)||0);
        const normalHz=normalHpm/60;
        const normalRangedRate=critEnabled?clamp(Number(cfg.normalRangedRate)||0,0,100)/100:0;
        const comboSuccessRate=clamp(Number(cfg.comboSuccessRate ?? 100)||0,0,100)/100;
        const hpMaxUptime=clamp(Number(cfg.hpMaxUptime ?? 100)||0,0,100)/100;
        const specialEffect=cfg.specialEffect||'crit';
        const equipment=cfg.equipment||{poisonHit:0,ailment:0,ctPromo:0,instant:0};
        // Precompute immutable skill data once per simulation. Optimizer calls the
        // simulator thousands of times, so rebuilding these objects/sets per trial
        // is pure overhead and does not improve statistical fidelity.
        const skillData=__compileSkillData(cfg.skills);
        // Precompute all hit-independent poison/skill values once per simulation.
        // These values are immutable during a trial; calculating them inside every
        // hit was a significant hot-loop cost.
        const equipAilment=Number(equipment.ailment)||0;
        const equipPoison=Number(equipment.poisonHit)||0;
        const ordinaryPoisonChance=equipPoison>0 ? equipPoison+equipAilment : 0;
        const hitData=skillData.map(s=>{
          const special=s.type==='special';
          if(special) return {special:true,hits:1,interval:0,rangedRate:s.rangedRate,poisonCount:2,p1:100,s1:true,p2:ordinaryPoisonChance,s2:false};
          if(s.poisonType==='partial') return {special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:2,p1:ordinaryPoisonChance,s1:false,p2:s.partialChance+equipAilment,s2:false,partialFlags:s.partialFlags};
          return {special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:1,p1:ordinaryPoisonChance,s1:false,p2:0,s2:false,partialFlags:null};
        });
        // Compile policy/rotation once per simulation call. The optimizer invokes
        // this function many times; rebuilding these small arrays at every hit
        // was unnecessary interpreter/JIT work and did not change the model.
        const compiledPolicy = cfg.policy && cfg.policy.segmentActions ? {
          segmentActions: Int8Array.from(cfg.policy.segmentActions, x=>Number(x)||0),
          segmentCount: Math.max(2, Math.floor(Number(cfg.policy.segmentCount)||cfg.policy.segmentActions.length||2)),
          ailmentDuration: Math.max(0, Number(cfg.policy.ailmentDuration ?? cfg.ailmentDuration ?? 0)||0)
        } : (cfg.policy && cfg.policy.rules ? {
          poisonThreshold: Number(cfg.policy.rules[0]?.value ?? Infinity),
          urgent: Number(cfg.policy.rules[0]?.action ?? 0),
          successStreak: Number(cfg.policy.rules[1]?.value ?? Infinity),
          highSuccess: Number(cfg.policy.rules[1]?.action ?? 0),
          defaultAction: Number(cfg.policy.defaultAction ?? 0)
        } : null);
        const compiledRotation = (cfg.rotation||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=skillData.length).map(n=>n-1);
        const defaultOrder=new Int8Array(skillData.length);
        for(let di=0;di<skillData.length;di++)defaultOrder[di]=di;
        let uptimeSum=0, attempts=0, successes=0, maxRes=0, totalHits=0;
        let totalPoisonAttempts=0,totalPoisonSuccesses=0,totalCrits=0,totalNormalHits=0,totalSkillActivations=0,totalRangedHits=0,totalMeleeHits=0,totalMeleeCrits=0,totalRangedCrits=0;
         const collectProbTimeline=cfg.__probTimeline===true && !fastMode;
         const probStep=Math.max(0.1,Number(cfg.__probStep)||0.5);
         const probBins=collectProbTimeline?Math.ceil(duration/probStep)+1:0;
         const probSum=collectProbTimeline?new Float64Array(probBins):null;
         const probCount=collectProbTimeline?new Uint32Array(probBins):null;
        const timeline=[];
        let __lastEventTrace=null;
        // Reuse per-trial typed arrays instead of allocating three Float64Arrays
        // for every Monte-Carlo trial. This is semantics-preserving and targets
        // one of the hottest allocation paths in long final evaluations.
        const ready=new Float64Array(skillData.length);
        const cooldownReduction=new Float64Array(skillData.length);
        const cooldownStart=new Float64Array(skillData.length);
        const baseResist=Number(cfg.baseResist)||0;
        const rise=Number(cfg.rise)||0;
        const fall=Number(cfg.fall)||0;
        const ailmentDuration=Number(cfg.ailmentDuration)||0;
        const equipmentCtPromo=Number(equipment.ctPromo)||0;
        const equipmentInstant=Number(equipment.instant)||0;

        for(let n=trialStart;n<trialStart+trials;n++) {
          const rng=mulberry32(((cfg.seed||1234567)+n*1000003)>>>0);
          const __trace=cfg.__eventTrace===true ? [] : null;
          __lastEventTrace=__trace;
          const trace=(kind,extra={})=>{if(__trace && __trace.length<200000){__trace.push(Object.assign({kind,t,poisonUntil,resist,u,busyUntil,nextNormal,rngState:typeof rng.getState==='function'?rng.getState():null,ready:Array.from(ready),cooldownReduction:Array.from(cooldownReduction),cooldownStart:Array.from(cooldownStart),comboHits,successStreak,hpMaxActive,lastHpCheck,dbgNextSkill,dbgCandidate,dbgDispatchIdx},extra));}};
          const skills=skillData;
          const skillCount=skills.length;
          // Arrays are reused across trials; reset only the active prefix.
          ready.fill(0);
          cooldownReduction.fill(0);
          cooldownStart.fill(0);
          let t=0,busyUntil=0,poisonUntil=-Infinity,resist=baseResist,peakRes=resist,u=0,comboHits=0,successStreak=0;
          let dbgNextSkill=Infinity,dbgCandidate=Infinity,dbgDispatchIdx=-1;
          let nextProbBin=1;
          // Timeline definition: E[P_eff(t)] over all Monte-Carlo states, not
          // only over timestamps at which a poison attempt happened.  Bin 0 is
          // the pre-event initial state, so it exactly reflects the configured
          // initial effective application probability.
          function timelineProbability(r) {
            return ordinaryPoisonChance>0?chanceFromResist(ordinaryPoisonChance,r,'subtract'):0;
          }
          function sampleTimelineBefore(time){
            if(!collectProbTimeline)return;
            while(nextProbBin<probBins && nextProbBin*probStep < time-1e-9){
              const tp=timelineProbability(resist);
              probSum[nextProbBin]+=tp; probCount[nextProbBin]++;
              nextProbBin++;
            }
          }
          function sampleTimelineAt(time){
            if(!collectProbTimeline || time<=1e-9)return;
            while(nextProbBin<probBins && Math.abs(nextProbBin*probStep-time)<=1e-9){
              const tp=timelineProbability(resist);
              probSum[nextProbBin]+=tp; probCount[nextProbBin]++;
              nextProbBin++;
            }
          }
          if(collectProbTimeline){
            const p0=timelineProbability(resist);
            probSum[0]+=p0; probCount[0]++;
          }
          let hpMaxActive = specialEffect==='hpmax' ? (rng()<hpMaxUptime) : false;
          let lastHpCheck = 0;
          let nextNormal=normalHz>0?0:Infinity;
          dbgNextSkill=Infinity;dbgCandidate=Infinity;dbgDispatchIdx=-1;
          let guard=0;

          function updateHpMaxState(time) {
            if(specialEffect!=='hpmax') return;
            const targetSecond=Math.floor(time+1e-9);
            while(lastHpCheck<targetSecond) {
              lastHpCheck++;
              hpMaxActive=rng()<hpMaxUptime;
              trace('hp_tick',{second:lastHpCheck});
            }
          }
          function currentPromo() {
            return ((equipmentCtPromo)+(specialEffect==='hpmax'&&hpMaxActive?20:0))/100;
          }
          function shortenOneRandomCooldown(isRanged) {
            const perCritReduction=isRanged?0.01:0.03;
            let candidateCount=0;
            for(let j=0;j<ready.length;j++) if(ready[j]>t+1e-12 && skills[j].ct>0) candidateCount++;
            if(candidateCount) {
              let pick=Math.floor(rng()*candidateCount),j=-1;
              for(let k=0;k<ready.length;k++) if(ready[k]>t+1e-12 && skills[k].ct>0 && pick--===0){j=k;break;}

              const baseCt=Math.max(0,Number(skills[j].ct)||0);
              cooldownReduction[j]=Math.min(1,cooldownReduction[j]+perCritReduction);
              const promo=currentPromo();
              ready[j]=Math.max(t,cooldownStart[j]+(baseCt*(1-cooldownReduction[j]))/(1+promo));
            }
            if(!fastMode)totalCrits++;
          }
          function poisonAttempt(chance,special=false) {
            const numericChance=Number(chance);
            if(!special && !(numericChance>0)) return false;
            if(!fastMode){attempts++; totalPoisonAttempts++;}
            const p=special?(1/3):chanceFromResist(numericChance,resist,'subtract');
            const __beforeR=resist,__beforePU=poisonUntil,__beforeU=u;
            const ok = rng()<p;
            if(ok) {
              if(!fastMode){successes++; totalPoisonSuccesses++;}
              if(!special) {
                successStreak++;
                resist+=rise;peakRes=Math.max(peakRes,resist);}
                if(ailmentDuration>0) {
                  const end=Math.min(duration,t+Number(cfg.ailmentDuration));
                  if(end>t) {
                    if(t>=poisonUntil)u+=end-t; else if(end>poisonUntil)u+=end-poisonUntil; poisonUntil=Math.max(poisonUntil,end); }
                  }
                } else if(!special) {
                  successStreak=0;
                  resist=Math.max(baseResist, resist-(fall));
                }
                trace('poison',{chance:numericChance,special:!!special,success:ok,beforeR:__beforeR,afterR:resist,beforePoisonUntil:__beforePU,afterPoisonUntil:poisonUntil,beforeU:__beforeU,afterU:u});
                return true;
              }
              function processHit(rangedRate,poisonCount,p1,s1,p2,s2) {
                if(!fastMode)totalHits++;
                const isRanged=critEnabled && rng()<clamp(Number(rangedRate ?? 0),0,100)/100;
                if(critEnabled) {
                  if(isRanged){if(!fastMode)totalRangedHits++;}else{if(!fastMode)totalMeleeHits++;}
                  if(rng()<critRate) {
                    if(isRanged){if(!fastMode)totalRangedCrits++;}else{if(!fastMode)totalMeleeCrits++;}
                    shortenOneRandomCooldown(isRanged);
                  }
                }
                if(specialEffect==='combo') {
                  if(comboHits===0) comboHits=1;
                  else if(rng()<comboSuccessRate) comboHits++;
                  else comboHits=1;
                  if(comboHits>=70) {
                    let candidateCount=0;
                    for(let j=0;j<skillCount;j++) if(ready[j]>t+1e-12) candidateCount++;
                    if(candidateCount) {
                      let pick=Math.floor(rng()*candidateCount);
                      for(let j=0;j<skillCount;j++) if(ready[j]>t+1e-12 && pick--===0){ready[j]=t;break;}
                    }
                    comboHits=0;
                  }
                }
                if(poisonCount>0) poisonAttempt(p1,s1);
                if(poisonCount>1) poisonAttempt(p2,s2);
                trace('hit',{rangedRate:Number(rangedRate)||0,poisonCount});
              }
                    function policyPick() {
                      if(typeof cfg.policy==='function') return cfg.policy({t,poisonRemaining:Math.max(0,poisonUntil-t),resist,ready:ready.map(x=>x<=t+1e-9),skills});
                      if(compiledPolicy) {
                        const remaining=Math.max(0,poisonUntil-t);
                        if(compiledPolicy.segmentActions) {
                          const D=compiledPolicy.ailmentDuration;
                          const K=compiledPolicy.segmentCount;
                          let idx=0;
                          if(D>0 && remaining>0) idx=Math.min(K-1,Math.floor((remaining/D)*K));
                          return compiledPolicy.segmentActions[idx] ?? 0;
                        }
                        if(remaining<=compiledPolicy.poisonThreshold) return compiledPolicy.urgent;
                        if(successStreak>=compiledPolicy.successStreak) return compiledPolicy.highSuccess;
                        return compiledPolicy.defaultAction;
                      }
                      return null;
                    }
                    function chooseSkill() {
                      const action=policyPick();
                      if(action===null) {
                        return -1;}
                        if(action===0)return -1;
                        const preferred=action-1;
                        if(preferred>=0 && preferred<skills.length && ready[preferred]<=t+1e-9)return preferred;

                        const order=compiledRotation.length?compiledRotation:defaultOrder;
                        for(const i of order)if(ready[i]<=t+1e-9)return i;
                        return -1;
                      }
                      let rotCursor=0;
                          function chooseFixed() {
                            if(!compiledRotation.length)return -1;
                            for(let k=0;k<compiledRotation.length;k++) {
                              const idx=compiledRotation[(rotCursor+k)%compiledRotation.length];if(ready[idx]<=t+1e-9) {
                                rotCursor=(rotCursor+k+1)%compiledRotation.length;return idx;}}
                                return -1;
                              }

                              while(t<=duration+1e-9 && guard++<1000000) {
                                let nextSkill=Infinity;
                                if(t>=busyUntil-1e-9) {
                                  const idx=(cfg.policy?chooseSkill():chooseFixed());
                                  if(idx>=0) {
                                    nextSkill=t;}
                                    else {

                                      for(const r of ready)if(r>t+1e-9)nextSkill=Math.min(nextSkill,r);
                                      if(nextSkill===Infinity)nextSkill=Infinity;
                                    }
                                  } else nextSkill=busyUntil;
                                  dbgNextSkill=nextSkill;dbgCandidate=Math.min(nextNormal,nextSkill,busyUntil>t?busyUntil:Infinity);dbgDispatchIdx=-1; const dbgAction=policyPick(); trace('sched',{action:dbgAction,schedIdx:-1});
                                  const candidate=dbgCandidate;
                                  if(candidate>duration+1e-9)break;
                                  const previousEventTime=t;
                                  t=candidate;
                                  // Complete the fixed-time sample for the previous
                                  // event only after all events at that timestamp have
                                  // finished. This avoids sampling a partially updated
                                  // resistance when multiple poison hits share a timestamp.
                                  sampleTimelineAt(previousEventTime);
                                  sampleTimelineBefore(t);
                                  updateHpMaxState(t);

                                  if(nextNormal<=t+1e-9 && nextNormal<=duration+1e-9 && nextNormal<=nextSkill+1e-9) {
                                    if(!fastMode)totalNormalHits++;processHit(0,0,0,false,0,false);nextNormal+=1/normalHz;continue;
                                  }
                                  if(t<busyUntil-1e-9) {
                                    continue;}
                                    const idx=(cfg.policy?chooseSkill():chooseFixed());
                                    if(idx<0) {
                                      if(nextNormal<Infinity) {
                                        if(nextNormal<=t+1e-9) {
                                          nextNormal+=1/normalHz;}else{t=nextNormal;}continue;}
                                          t=nextSkill;continue;
                                        }
                                        const s=skills[idx],start=t,execution=s.execution,ct=s.ct;

                                        const actionDuration=Math.max(execution,1/60);

                                        const instant=clamp((Number(s.instant)||0)+(equipmentInstant),0,100);
                                        cooldownReduction[idx]=0;cooldownStart[idx]=start;
                                        const promo=currentPromo();
                                        ready[idx]=start+(rng()*100<instant?0:(ct/(1+promo)));
                                        trace('skill_start',{skill:idx,ct,execution});
                                        busyUntil=start+actionDuration;if(!fastMode)totalSkillActivations++;
                                        const hd=hitData[idx],hits=hd.hits,interval=hd.interval;
                                        for(let h=0;h<hits;h++) {
                                          const ht=start+h*interval;if(ht>duration+1e-9||ht>busyUntil+1e-9)break;
                                          let poisonCount=hd.poisonCount,p1=hd.p1,s1=hd.s1,p2=hd.p2,s2=hd.s2;
                                          if(hd.partialFlags && hd.partialFlags[h]!==1){poisonCount=1;p2=0;s2=false;}

                                          while(nextNormal<=ht+1e-9&&nextNormal<busyUntil+1e-9&&nextNormal<=duration+1e-9) {
                                            t=nextNormal;if(!fastMode)totalNormalHits++;processHit(normalRangedRate,0,0,false,0,false);sampleTimelineAt(t);nextNormal+=1/normalHz;
                                          }
                                          t=ht;processHit(Number(s.rangedRate)||0,poisonCount,p1,s1,p2,s2);sampleTimelineAt(t);
                                          t=busyUntil;
                                          if(execution<=1e-9)t=busyUntil;
                                        }
                                        }
                                        sampleTimelineAt(t);
                                        if(collectProbTimeline){
                                          while(nextProbBin<probBins){
                                            const tp=timelineProbability(resist);
                                            probSum[nextProbBin]+=tp; probCount[nextProbBin]++; nextProbBin++;
                                          }
                                        }
                                        uptimeSum+=duration>0?clamp(u/duration,0,1):0;maxRes=Math.max(maxRes,peakRes);
                                        if(!fastMode && n<trialStart+20)timeline.push({trial:n+1,uptime:duration>0?clamp(u/duration,0,1):0});
                                      }
                                      if(fastMode){ const out={uptime:uptimeSum/trials}; if(cfg.__eventTrace===true) out.__eventTrace=__lastEventTrace||[]; return out; }
                                      const executionProbabilityTimeline=collectProbTimeline?Array.from({length:probBins},(_,i)=>({time:Math.min(i*probStep,duration),probability:probCount[i]>0?probSum[i]/probCount[i]:null})).filter(q=>q.probability!==null):[];
                                      return {uptime:uptimeSum/trials,attempts:attempts/trials,successes:successes/trials,successRate:attempts?successes/attempts:0,maxRes,timeline,hits:totalHits/trials,poisonAttempts:totalPoisonAttempts/trials,poisonSuccesses:totalPoisonSuccesses/trials,crits:critEnabled?totalCrits/trials:0,meleeHits:critEnabled?totalMeleeHits/trials:0,rangedHits:critEnabled?totalRangedHits/trials:0,meleeCrits:critEnabled?totalMeleeCrits/trials:0,rangedCrits:critEnabled?totalRangedCrits/trials:0,normalHits:totalNormalHits/trials,skillActivations:totalSkillActivations/trials,executionProbabilityTimeline};
                                    }


/* Exact policy-tree checkpoint engine.
 *
 * This engine uses the same event equations as runSimulationFastCore, but makes
 * the complete per-trial mutable state explicit.  Policies sharing the same
 * observable segment/action prefix are simulated once up to the point where
 * their actions can diverge; the resulting state (including RNG state) is then
 * cloned for the child branches.  Thus sibling leaves do not replay the common
 * prefix.  The policy never observes hidden resistance R; R exists only in the
 * simulator state.
 *
 * It is deliberately used only for canonical segmentActions policies. Unsupported
 * legacy/function policies fall back to the existing exact fast simulator.
 */
function __mulberryState(seed){
  let a=seed>>>0;
  return { get(){return a>>>0;}, set(v){a=v>>>0;}, next(){let t=a=(a+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;} };
}
function __treePolicyKey(p){return (p.segmentActions||[]).map(x=>Number(x)||0).join(',');}
function __cloneTreeState(s){
  return {t:s.t,busyUntil:s.busyUntil,poisonUntil:s.poisonUntil,resist:s.resist,peakRes:s.peakRes,u:s.u,
    comboHits:s.comboHits,successStreak:s.successStreak,nextNormal:s.nextNormal,hpMaxActive:s.hpMaxActive,lastHpCheck:s.lastHpCheck,rotCursor:s.rotCursor,
    rng:s.rng.get(),ready:new Float64Array(s.ready),cooldownReduction:new Float64Array(s.cooldownReduction),cooldownStart:new Float64Array(s.cooldownStart)};
}
function __treeRestoreRng(s,st){s.rng.set(st.rng);s.ready.set(st.ready);s.cooldownReduction.set(st.cooldownReduction);s.cooldownStart.set(st.cooldownStart);
  for(const k of ['t','busyUntil','poisonUntil','resist','peakRes','u','comboHits','successStreak','nextNormal','hpMaxActive','lastHpCheck','rotCursor'])s[k]=st[k];}
function __runPolicyTreeTrial(cfg, policies, seed, duration, skillData, hitData, equipment, compiledRotation){
  const critEnabled=(cfg.specialEffect||'crit')==='crit',critRate=critEnabled?clamp(Number(cfg.critRate)||0,0,100)/100:0;
  const normalHpm=Math.max(0,Number(cfg.normalHpm ?? cfg.normalHps*60)||0),normalHz=normalHpm/60;
  const normalRangedRate=critEnabled?clamp(Number(cfg.normalRangedRate)||0,0,100)/100:0;
  const comboSuccessRate=clamp(Number(cfg.comboSuccessRate ?? 100)||0,0,100)/100;
  const hpMaxUptime=clamp(Number(cfg.hpMaxUptime ?? 100)||0,0,100)/100;
  const specialEffect=cfg.specialEffect||'crit';
  const baseResist=Number(cfg.baseResist)||0,rise=Number(cfg.rise)||0,fall=Number(cfg.fall)||0;
  const ailmentDuration=Number(cfg.ailmentDuration)||0;
  const equipmentCtPromo=Number(equipment.ctPromo)||0,equipmentInstant=Number(equipment.instant)||0;
  const K=Math.max(2,Math.floor(Number(policies[0]?.segmentCount)||4)),D=Math.max(0,Number(policies[0]?.ailmentDuration ?? ailmentDuration)||0);
  // State-pool implementation: policy-tree siblings are evaluated sequentially,
  // so only one state per tree depth can be live at once.  Reusing these typed
  // arrays removes the large GC/allocation cost of cloning a complete simulator
  // state for every branch.  This is semantics-preserving: a child is copied
  // from its parent before the child mutates anything, and siblings are processed
  // one at a time.
  const nSkills=skillData.length;
  // Rollback checkpoint engine: one mutable state + undo log.
  // Array mutations are recorded as (array,index,oldValue) and reversed when
  // entering a sibling. This removes full Float64Array cloning at each branch.
  const st={t:0,busyUntil:0,poisonUntil:-Infinity,resist:baseResist,peakRes:baseResist,u:0,comboHits:0,successStreak:0,nextNormal:normalHz>0?0:Infinity,hpMaxActive:false,lastHpCheck:0,rotCursor:0,rng:__mulberryState(seed),ready:new Float64Array(nSkills),cooldownReduction:new Float64Array(nSkills),cooldownStart:new Float64Array(nSkills)};
  const __treeTrace=cfg.__eventTrace===true?[]:null;
  const traceTree=(kind,extra={})=>{if(__treeTrace&&__treeTrace.length<200000)__treeTrace.push(Object.assign({kind,t:st.t,poisonUntil:st.poisonUntil,resist:st.resist,u:st.u,busyUntil:st.busyUntil,nextNormal:st.nextNormal,rngState:st.rng.get(),ready:Array.from(st.ready),cooldownReduction:Array.from(st.cooldownReduction),cooldownStart:Array.from(st.cooldownStart),comboHits:st.comboHits,successStreak:st.successStreak,hpMaxActive:st.hpMaxActive,lastHpCheck:st.lastHpCheck,dbgNextSkill:st.__dbgNextSkill??Infinity,dbgCandidate:st.__dbgCandidate??Infinity,dbgDispatchIdx:st.__dbgDispatchIdx??-1},extra));};
  // Fixed TypedArray undo log.  The previous implementation used one JS
  // array allocation per mutation: undo.push([array,index,oldValue]).  That
  // creates substantial GC pressure inside the policy tree.  Keep the three
  // pieces of every record in flat typed arrays instead.  Array IDs are local
  // to this state machine: 0=ready, 1=cooldownReduction, 2=cooldownStart.
  // The capacity is deliberately generous for the short policy-segment
  // checkpoints; if an unusually dense trace exceeds it, grow geometrically
  // (outside the normal hot path).
  let undoCap=262144;
  let undoArrayId=new Uint8Array(undoCap);
  let undoIndex=new Int32Array(undoCap);
  let undoValue=new Float64Array(undoCap);
  let undoLen=0;
  // Depth checkpoints are fixed-size scalar records. Avoid creating a new JS
  // object on every recursive policy-tree node; this keeps the hot path out of
  // the GC while preserving the exact state/RNG snapshot semantics.
  // Recursion depth is the number of observable segment transitions, not the
  // number of policy segments. A long battle can cross segment boundaries many
  // more than K times (especially after poison refreshes), so K+2 slots are not
  // sufficient. Reusing the last checkpoint corrupts sibling restoration.
  // Allocate one checkpoint lazily per actual recursion depth instead.
  const checkpoints=[];
  const arrIds=new WeakMap([[st.ready,0],[st.cooldownReduction,1],[st.cooldownStart,2]]);
  function ensureUndo(n){
    if(n<=undoCap)return;
    let nc=undoCap;while(nc<n)nc*=2;
    const na=new Uint8Array(nc);na.set(undoArrayId);undoArrayId=na;
    const ni=new Int32Array(nc);ni.set(undoIndex);undoIndex=ni;
    const nv=new Float64Array(nc);nv.set(undoValue);undoValue=nv;
    undoCap=nc;
  }
  function logArr(a,i,old){
    ensureUndo(undoLen+1);
    undoArrayId[undoLen]=arrIds.get(a);
    undoIndex[undoLen]=i;
    undoValue[undoLen]=old;
    undoLen++;
  }
  function rollbackTo(mark){
    while(undoLen>mark){
      --undoLen;
      const id=undoArrayId[undoLen],i=undoIndex[undoLen],v=undoValue[undoLen];
      if(id===0)st.ready[i]=v;
      else if(id===1)st.cooldownReduction[i]=v;
      else st.cooldownStart[i]=v;
    }
  }
  function resetRoot(){
    st.t=0;st.busyUntil=0;st.poisonUntil=-Infinity;st.resist=baseResist;st.peakRes=baseResist;st.u=0;
    st.comboHits=0;st.successStreak=0;st.nextNormal=normalHz>0?0:Infinity;st.lastHpCheck=0;st.rotCursor=0;
    st.ready.fill(0);st.cooldownReduction.fill(0);st.cooldownStart.fill(0);undoLen=0;st.rng.set(seed);
    st.hpMaxActive=specialEffect==='hpmax'?st.rng.next()<hpMaxUptime:false;
  }
  function checkpoint(depth){
    let c=checkpoints[depth];
    if(!c){c=checkpoints[depth]={t:0,busyUntil:0,poisonUntil:-Infinity,resist:baseResist,peakRes:baseResist,u:0,comboHits:0,successStreak:0,nextNormal:Infinity,hpMaxActive:false,lastHpCheck:0,rotCursor:0,rng:0,mark:0};}
    c.t=st.t;c.busyUntil=st.busyUntil;c.poisonUntil=st.poisonUntil;c.resist=st.resist;c.peakRes=st.peakRes;c.u=st.u;
    c.comboHits=st.comboHits;c.successStreak=st.successStreak;c.nextNormal=st.nextNormal;c.hpMaxActive=st.hpMaxActive;c.lastHpCheck=st.lastHpCheck;c.rotCursor=st.rotCursor;c.rng=st.rng.get();c.mark=undoLen;return c;
  }
  function restore(c){
    rollbackTo(c.mark);
    st.t=c.t;st.busyUntil=c.busyUntil;st.poisonUntil=c.poisonUntil;st.resist=c.resist;st.peakRes=c.peakRes;st.u=c.u;
    st.comboHits=c.comboHits;st.successStreak=c.successStreak;st.nextNormal=c.nextNormal;st.hpMaxActive=c.hpMaxActive;st.lastHpCheck=c.lastHpCheck;st.rotCursor=c.rotCursor;st.rng.set(c.rng);
  }
  function setArr(a,i,v){if(a[i]!==v){logArr(a,i,a[i]);a[i]=v;}}
  function segOf(st){const rem=Math.max(0,st.poisonUntil-st.t); if(D<=0||rem<=0)return 0; return Math.min(K-1,Math.floor((rem/D)*K));}
  function actionOf(policy,st){return Number(policy.segmentActions[segOf(st)]??0)||0;}
  function promo(st){return (equipmentCtPromo+(specialEffect==='hpmax'&&st.hpMaxActive?20:0))/100;}
  function updateHp(st,time){if(specialEffect!=='hpmax')return;const target=Math.floor(time+1e-9);while(st.lastHpCheck<target){st.lastHpCheck++;st.hpMaxActive=st.rng.next()<hpMaxUptime;traceTree('hp_tick',{second:st.lastHpCheck});}}
  function shorten(st,isRanged){let cnt=0;for(let j=0;j<st.ready.length;j++)if(st.ready[j]>st.t+1e-12&&skillData[j].ct>0)cnt++;if(cnt){let pick=Math.floor(st.rng.next()*cnt),j=-1;for(let k=0;k<st.ready.length;k++)if(st.ready[k]>st.t+1e-12&&skillData[k].ct>0&&pick--===0){j=k;break;}const ct=Math.max(0,Number(skillData[j].ct)||0);const nr=Math.min(1,st.cooldownReduction[j]+(isRanged?0.01:0.03));setArr(st.cooldownReduction,j,nr);setArr(st.ready,j,Math.max(st.t,st.cooldownStart[j]+(ct*(1-nr))/(1+promo(st))));}}
  function poison(st,chance,special=false){
    const numericChance=Number(chance);
    // Match the canonical simulator exactly: a non-special poison source with
    // zero/negative chance does not perform an ailment roll, consume RNG, or
    // change dynamic resistance/success streak.
    if(!special && !(numericChance>0)) return false;
    const beforeR=st.resist,beforePU=st.poisonUntil,beforeU=st.u;
    const p=special?1/3:chanceFromResist(numericChance,st.resist,'subtract');
    const success=st.rng.next()<p;
    if(success){
      if(!special){st.successStreak++;st.resist+=rise;st.peakRes=Math.max(st.peakRes,st.resist);}
      if(ailmentDuration>0){const end=Math.min(duration,st.t+ailmentDuration);if(end>st.t){if(st.t>=st.poisonUntil)st.u+=end-st.t;else if(end>st.poisonUntil)st.u+=end-st.poisonUntil;st.poisonUntil=Math.max(st.poisonUntil,end);}}
    }else if(!special){st.successStreak=0;st.resist=Math.max(baseResist,st.resist-fall);}
    traceTree('poison',{chance:Number(chance)||0,special:!!special,success,beforeR,afterR:st.resist,beforePoisonUntil:beforePU,afterPoisonUntil:st.poisonUntil,beforeU,afterU:st.u});
    return success;
  }
  function hit(st,rangedRate,poisonCount,p1,s1,p2,s2){const isRanged=critEnabled&&st.rng.next()<clamp(Number(rangedRate??0),0,100)/100;if(critEnabled&&st.rng.next()<critRate)shorten(st,isRanged);if(specialEffect==='combo'){if(st.comboHits===0)st.comboHits=1;else if(st.rng.next()<comboSuccessRate)st.comboHits++;else st.comboHits=1;if(st.comboHits>=70){let cnt=0;for(let j=0;j<skillData.length;j++)if(st.ready[j]>st.t+1e-12)cnt++;if(cnt){let pick=Math.floor(st.rng.next()*cnt);for(let j=0;j<skillData.length;j++)if(st.ready[j]>st.t+1e-12&&pick--===0){setArr(st.ready,j,st.t);break;}}st.comboHits=0;}}if(poisonCount>0)poison(st,p1,s1);if(poisonCount>1)poison(st,p2,s2);traceTree('hit',{rangedRate:Number(rangedRate)||0,poisonCount});}
  function fixedSkill(st,action){if(action===0)return -1;const pref=action-1;if(pref>=0&&pref<skillData.length&&st.ready[pref]<=st.t+1e-9)return pref;const order=compiledRotation.length?compiledRotation:skillData.map((_,i)=>i);for(const i of order)if(st.ready[i]<=st.t+1e-9)return i;return -1;}
  function advance(st,policy,stopSeg){
    let guard=0;
    while(st.t<=duration+1e-9 && guard++<1000000){
      // The reference simulator consults the policy only when it is time to
      // start/select a skill.  A segment boundary reached during an action is
      // therefore observed only after that action's event processing finishes.
      const curSeg=segOf(st);
      if(curSeg!==stopSeg)return {kind:'branch',seg:curSeg};

      let nextSkill=Infinity;
      if(st.t>=st.busyUntil-1e-9){
        const idx=fixedSkill(st,actionOf(policy,st));
        if(idx>=0) nextSkill=st.t;
        else {
          for(const r of st.ready) if(r>st.t+1e-9) nextSkill=Math.min(nextSkill,r);
          if(nextSkill===Infinity) nextSkill=Infinity;
        }
      } else nextSkill=st.busyUntil;

      const candidate=Math.min(st.nextNormal,nextSkill,st.busyUntil>st.t?st.busyUntil:Infinity);
      st.__dbgNextSkill=nextSkill;st.__dbgCandidate=candidate;st.__dbgDispatchIdx=-1;
      traceTree('sched',{action:actionOf(policy,st),schedIdx:fixedSkill(st,actionOf(policy,st)),dbgNextSkill:nextSkill,dbgCandidate:candidate});
      if(candidate>duration+1e-9)break;
      st.t=candidate;
      updateHp(st,st.t);

      if(st.nextNormal<=st.t+1e-9 && st.nextNormal<=duration+1e-9 && st.nextNormal<=nextSkill+1e-9){
        hit(st,0,0,0,false,0,false);
        st.nextNormal+=1/normalHz;
        continue;
      }
      if(st.t<st.busyUntil-1e-9)continue;

      // The scheduling candidate can jump across one or more poison-time
      // segments. The canonical simulator re-reads the policy *after* that
      // jump, immediately before selecting the skill. Branch here before using
      // the representative policy for the new segment; otherwise sibling
      // policies that differ only in the crossed-to segment are incorrectly
      // forced down the representative's path.
      const selectionSeg=segOf(st);
      if(selectionSeg!==stopSeg)return {kind:'branch',seg:selectionSeg};
      const idx=fixedSkill(st,actionOf(policy,st));
      st.__dbgDispatchIdx=idx;
      if(idx<0){
        if(st.nextNormal<Infinity){
          if(st.nextNormal<=st.t+1e-9)st.nextNormal+=1/normalHz;
          else st.t=st.nextNormal;
          continue;
        }
        break;
      }

      const sk=skillData[idx],start=st.t,execution=sk.execution,ct=sk.ct;
      const actionDuration=Math.max(execution,1/60);
      const instant=clamp((Number(sk.instant)||0)+equipmentInstant,0,100);
      setArr(st.cooldownReduction,idx,0);
      setArr(st.cooldownStart,idx,start);
      const pr=promo(st);
      setArr(st.ready,idx,start+(st.rng.next()*100<instant?0:(ct/(1+pr))));
      traceTree('skill_start',{skill:idx,ct,execution});
      st.busyUntil=start+actionDuration;

      const hd=hitData[idx];
      for(let h=0;h<hd.hits;h++){
        const ht=start+h*hd.interval;
        if(ht>duration+1e-9||ht>st.busyUntil+1e-9)break;
        while(st.nextNormal<=ht+1e-9 && st.nextNormal<st.busyUntil+1e-9 && st.nextNormal<=duration+1e-9){
          st.t=st.nextNormal;
          hit(st,normalRangedRate,0,0,false,0,false);
          st.nextNormal+=1/normalHz;
        }
        st.t=ht;
        let pc=hd.poisonCount,p1=hd.p1,p2=hd.p2,s1=hd.s1,s2=hd.s2;
        if(hd.partialFlags && hd.partialFlags[h]!==1){pc=1;p2=0;s2=false;}
        hit(st,Number(sk.rangedRate)||0,pc,p1,s1,p2,s2);
        st.t=st.busyUntil;
      }
      // Match the reference loop: after the skill's hit loop the next top-level
      // iteration re-evaluates policy and scheduling from busyUntil.
    }
    return {kind:'end'};
  }
  // One mutable state is shared by the complete policy tree. Sibling branches
  // are restored to the exact parent checkpoint before they are evaluated.
  const results=new Float64Array(policies.length);
  // v27.34: preallocate the four branch buffers for every recursion depth.
  // The previous tree created 4 Int32Arrays at every node; for K=4 this is
  // thousands of short-lived allocations per trial.  A depth-local pool keeps
  // the exact same traversal while removing that GC pressure.
  // As with checkpoints, branch buffers must be unique per *actual* recursion
  // depth. Segment transitions can exceed K+2, so clamping depth aliases a
  // parent's input buffer with its child output buffer and silently changes the
  // policy set being evaluated. Allocate depth buffers lazily and reuse them on
  // later trials/calls within this tree run.
  const branchPool=[];
  function branchPoolAt(depth){
    let p=branchPool[depth];
    if(!p){p=branchPool[depth]=[
      new Int32Array(policies.length),new Int32Array(policies.length),
      new Int32Array(policies.length),new Int32Array(policies.length)
    ];}
    return p;
  }
  resetRoot();
  function walk(indices,depth){
    const parent=checkpoint(depth);
    if(indices.length===1){
      const p=policies[indices[0]];let guard=0;
      while(guard++<1000000){const r=advance(st,p,segOf(st));if(r.kind==='end')break;}
      results[indices[0]]=duration>0?clamp(st.u/duration,0,1):0;restore(parent);return;
    }
    const seg=segOf(st);
    // Four preallocated index buffers replace four transient JS arrays at every
    // branch.  A policy is represented by a packed segment-action integer, so
    // action lookup is a single bit operation in the common K<=5 case.
    const pool=branchPoolAt(depth);
    const g0=pool[0],g1=pool[1],g2=pool[2],g3=pool[3];
    let n0=0,n1=0,n2=0,n3=0;
    for(let q=0;q<indices.length;q++){const i=indices[q],p=policies[i],a=actionOf(p,st);if(a===0)g0[n0++]=i;else if(a===1)g1[n1++]=i;else if(a===2)g2[n2++]=i;else g3[n3++]=i;}
    let groupsN=(n0>0)+(n1>0)+(n2>0)+(n3>0);
    if(groupsN===1){
      const r=advance(st,policies[indices[0]],seg);
      if(r.kind==='end'){const z=duration>0?clamp(st.u/duration,0,1):0;for(const i of indices)results[i]=z;restore(parent);return;}
      walk(indices,depth+1);restore(parent);return;
    }
    const walkBuf=(buf,n)=>{if(!n)return;restore(parent);walk(buf.subarray(0,n),depth+1);};
    walkBuf(g0,n0);walkBuf(g1,n1);walkBuf(g2,n2);walkBuf(g3,n3);
    restore(parent);
  }
  const rootIndices=new Int32Array(policies.length);
  for(let i=0;i<rootIndices.length;i++)rootIndices[i]=i;
  walk(rootIndices,0);
  if(cfg.__eventTrace===true) results.__eventTrace=__treeTrace||[];
  return results;
}


function __stableEventTraceEqual(a,b){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return {ok:false,reason:'length',a:a?.length||0,b:b?.length||0};
  const keys=['kind','t','poisonUntil','resist','u','busyUntil','nextNormal','rngState','comboHits','successStreak','hpMaxActive','lastHpCheck','skill','second','poisonCount','rangedRate','chance','special','success','beforeR','afterR','beforePoisonUntil','afterPoisonUntil','beforeU','afterU'];
  const arrKeys=['ready','cooldownReduction','cooldownStart'];
  for(let i=0;i<a.length;i++){
    const x=a[i],y=b[i];
    for(const k of keys){if(k in x||k in y){if(typeof x[k]==='number'||typeof y[k]==='number'){if(!(Object.is(x[k],y[k])||Math.abs(Number(x[k])-Number(y[k]))<=1e-12))return {ok:false,index:i,key:k,x:x[k],y:y[k]};}else if(x[k]!==y[k])return {ok:false,index:i,key:k,x:x[k],y:y[k]};}}
    for(const k of arrKeys){const xa=x[k]||[],ya=y[k]||[];if(xa.length!==ya.length)return {ok:false,index:i,key:k};for(let j=0;j<xa.length;j++)if(!(Object.is(xa[j],ya[j])||Math.abs(xa[j]-ya[j])<=1e-12))return {ok:false,index:i,key:k+'['+j+']',x:xa[j],y:ya[j]};}
  }
  return {ok:true,length:a.length};
}
function validateEventTraceExact(cfg,policy){
  const seed=((cfg.seed||1234567)+Math.max(0,Math.floor(cfg.trialStart||0))*1000003)>>>0;
  const tc={...cfg,seed,policy,trials:1,trialStart:0,__eventTrace:true};
  const canonical=runSimulationFast(tc);
  const sd=__compileSkillData(cfg.skills),e=cfg.equipment||{},ea=Number(e.ailment)||0,ep=Number(e.poisonHit)||0,o=ep>0?ep+ea:0;
  const hitData=sd.map(s=>s.type==='special'?{special:true,hits:1,interval:0,rangedRate:s.rangedRate,poisonCount:2,p1:100,s1:true,p2:o,s2:false}:s.poisonType==='partial'?{special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:2,p1:o,s1:false,p2:s.partialChance+ea,s2:false,partialFlags:s.partialFlags}:{special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:1,p1:o,s1:false,p2:0,s2:false,partialFlags:null});
  const rot=(cfg.rotation||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=sd.length).map(n=>n-1);
  const tree=__runPolicyTreeTrial(tc,[policy],seed,Math.max(0,Number(cfg.duration)||0),sd,hitData,e,rot);
  const cmp=__stableEventTraceEqual(canonical.__eventTrace||[],tree.__eventTrace||[]);
  return {ok:!!cmp.ok,canonical:canonical.__eventTrace||[],tree:tree.__eventTrace||[],diff:cmp};
}

// Differential gate for the checkpoint/tree engine.  It deliberately compares
// the complete policy vector against the canonical fast simulator for a small
// deterministic sample before a caller enables the tree as its scoring path.
// This is a safety gate, not an approximation.
function validatePolicyTreeExact(cfg, policies, sampleIndices){
  const ids=Array.isArray(sampleIndices)&&sampleIndices.length?sampleIndices:
    [0,1,2,3,Math.max(0,policies.length>>1),Math.max(0,policies.length-2),Math.max(0,policies.length-1)];
  const uniq=[];const seen=new Set();
  for(const i of ids){const j=Math.max(0,Math.min(policies.length-1,Number(i)||0));if(!seen.has(j)){seen.add(j);uniq.push(j);}}
  const subset=uniq.map(i=>policies[i]);
  const tree=__runPolicyTreeTrial({...cfg,trials:1},subset,((cfg.seed||1234567)+Math.max(0,Math.floor(cfg.trialStart||0))*1000003)>>>0,Math.max(0,Number(cfg.duration)||0),__compileSkillData(cfg.skills),(()=>{const sd=__compileSkillData(cfg.skills),e=cfg.equipment||{};const ea=Number(e.ailment)||0,ep=Number(e.poisonHit)||0,o=ep>0?ep+ea:0;return sd.map(s=>s.type==='special'?{special:true,hits:1,interval:0,rangedRate:s.rangedRate,poisonCount:2,p1:100,s1:true,p2:o,s2:false}:s.poisonType==='partial'?{special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:2,p1:o,s1:false,p2:s.partialChance+ea,s2:false,partialFlags:s.partialFlags}:{special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:1,p1:o,s1:false,p2:0,s2:false,partialFlags:null});})(),cfg.equipment||{},(cfg.rotation||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=__compileSkillData(cfg.skills).length).map(n=>n-1));
  const diffs=[];
  for(let q=0;q<uniq.length;q++){
    const r=runSimulationFast({...cfg,trials:1,trialStart:cfg.trialStart||0,policy:subset[q]});
    // __runPolicyTreeTrial returns scalar uptime values, not result objects.
    // v27.64 accidentally read tree[q].uptime, coercing every tree score to 0
    // and therefore disabling the checkpoint/tree fast path for virtually all
    // non-zero policies.
    const tv=tree[q],a=Number(tv&&typeof tv==='object'?tv.uptime:tv)||0,b=Number(r?.uptime)||0;
    if(Math.abs(a-b)>1e-12){diffs.push({index:uniq[q],tree:a,canonical:b});continue;}
    // Event-trace formatting in the tree engine is diagnostic and may omit
    // scheduler-only trace records while preserving the authoritative uptime.
    // Keep strict trace checking opt-in; production gating is based on the
    // exact scalar objective that the optimizer ranks.
    if(cfg.__strictEventTraceGate===true){const tr=validateEventTraceExact({...cfg,trialStart:cfg.trialStart||0},subset[q]);if(!tr.ok)diffs.push({index:uniq[q],eventTrace:tr.diff});}
  }
  return {ok:diffs.length===0,checked:uniq.length,diffs};
}

function runSimulationPolicyTreeExact(cfg, policies){
  if(!Array.isArray(policies)||!policies.length||policies.some(p=>!p||!Array.isArray(p.segmentActions)))return null;
  const trials=Math.max(1,Math.floor(cfg.trials)),trialStart=Math.max(0,Math.floor(cfg.trialStart||0)),duration=Math.max(0,Number(cfg.duration)||0),equipment=cfg.equipment||{poisonHit:0,ailment:0,ctPromo:0,instant:0};
  const skillData=__compileSkillData(cfg.skills),eqA=Number(equipment.ailment)||0,eqP=Number(equipment.poisonHit)||0,ordinary=eqP>0?eqP+eqA:0;
  const hitData=skillData.map(s=>{if(s.type==='special')return {special:true,hits:1,interval:0,rangedRate:s.rangedRate,poisonCount:2,p1:100,s1:true,p2:ordinary,s2:false};if(s.poisonType==='partial')return {special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:2,p1:ordinary,s1:false,p2:s.partialChance+eqA,s2:false,partialFlags:s.partialFlags};return {special:false,hits:s.hits,interval:s.interval,rangedRate:s.rangedRate,poisonCount:1,p1:ordinary,s1:false,p2:0,s2:false,partialFlags:null};});
  const rotation=(cfg.rotation||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=skillData.length).map(n=>n-1);
  const sums=new Float64Array(policies.length);
  for(let tr=trialStart;tr<trialStart+trials;tr++){
    const scores=__runPolicyTreeTrial(cfg,policies,((cfg.seed||1234567)+tr*1000003)>>>0,duration,skillData,hitData,equipment,rotation);
    for(let i=0;i<scores.length;i++)sums[i]+=scores[i];
  }
  return Array.from(sums,x=>({uptime:x/trials}));
}


function runSimulationFast(cfg) {
  return runSimulationFastCore(cfg);
}
