function clamp(x,a,b) {
  return Math.max(a,Math.min(b,x));}
  function chanceFromResist(basePct,resist,mode) {
    if(mode==='none') return clamp(basePct/100,0,1);
    if(mode==='mult') return clamp((basePct/100)*(1-resist/100),0,1);
    return clamp((basePct-resist)/100,0,1);
  }
  function mulberry32(seed) {
    return function() {
      let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}

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
        const compiledPolicy = cfg.policy && cfg.policy.rules ? {
          poisonThreshold: Number(cfg.policy.rules[0]?.value ?? Infinity),
          urgent: Number(cfg.policy.rules[0]?.action ?? 0),
          successStreak: Number(cfg.policy.rules[1]?.value ?? Infinity),
          highSuccess: Number(cfg.policy.rules[1]?.action ?? 0),
          defaultAction: Number(cfg.policy.defaultAction ?? 0)
        } : null;
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
          const skills=skillData;
          const skillCount=skills.length;
          // Arrays are reused across trials; reset only the active prefix.
          ready.fill(0);
          cooldownReduction.fill(0);
          cooldownStart.fill(0);
          let t=0,busyUntil=0,poisonUntil=-Infinity,resist=baseResist,peakRes=resist,u=0,comboHits=0,successStreak=0;
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
          let guard=0;

          function updateHpMaxState(time) {
            if(specialEffect!=='hpmax') return;
            const targetSecond=Math.floor(time+1e-9);
            while(lastHpCheck<targetSecond) {
              lastHpCheck++;
              hpMaxActive=rng()<hpMaxUptime;
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
            if(rng()<p) {
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
              }
                    function policyPick() {
                      if(typeof cfg.policy==='function') return cfg.policy({t,poisonRemaining:Math.max(0,poisonUntil-t),resist,ready:ready.map(x=>x<=t+1e-9),skills});
                      if(compiledPolicy) {
                        const remaining=poisonUntil-t;
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
                                      if(nextSkill===Infinity)nextSkill=duration+1;
                                    }
                                  } else nextSkill=busyUntil;
                                  const candidate=Math.min(nextNormal,nextSkill,busyUntil>t?busyUntil:Infinity);
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
                                      if(fastMode)return {uptime:uptimeSum/trials};
                                      const executionProbabilityTimeline=collectProbTimeline?Array.from({length:probBins},(_,i)=>({time:Math.min(i*probStep,duration),probability:probCount[i]>0?probSum[i]/probCount[i]:null})).filter(q=>q.probability!==null):[];
                                      return {uptime:uptimeSum/trials,attempts:attempts/trials,successes:successes/trials,successRate:attempts?successes/attempts:0,maxRes,timeline,hits:totalHits/trials,poisonAttempts:totalPoisonAttempts/trials,poisonSuccesses:totalPoisonSuccesses/trials,crits:critEnabled?totalCrits/trials:0,meleeHits:critEnabled?totalMeleeHits/trials:0,rangedHits:critEnabled?totalRangedHits/trials:0,meleeCrits:critEnabled?totalMeleeCrits/trials:0,rangedCrits:critEnabled?totalRangedCrits/trials:0,normalHits:totalNormalHits/trials,skillActivations:totalSkillActivations/trials,executionProbabilityTimeline};
                                    }

// Optimizer-only hot path. This deliberately returns only uptime, because the
// optimizer never consumes the diagnostic counters from runSimulation(). The
// state machine and RNG sequence mirror runSimulation() above.
function runSimulationFast(cfg) {
  // Exact optimizer path: reuse the battle state machine with diagnostics disabled.
  // This deliberately shares every timing/RNG/crit branch with runSimulation(),
  // so the fast path cannot silently diverge from the reference model.
  return runSimulation({...cfg,__fast:true});
}
