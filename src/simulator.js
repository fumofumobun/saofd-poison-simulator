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

      function runSimulation(cfg) {
        const trials=Math.max(1,Math.floor(cfg.trials));
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
        const skillData=(cfg.skills||[]).map(s=>{
          const partialHitSet=new Set(String(s.partialHits||'').split(',').map(x=>parseInt(x.trim(),10)).filter(Number.isFinite).map(x=>x-1));
          return {
            type:s.type,ct:Math.max(0,Number(s.ct)||0),execution:Math.max(0,Number(s.execution)||0),
            hits:Math.max(0,Math.floor(Number(s.hits)||0)),interval:Math.max(0,Number(s.interval)||0),
            rangedRate:Number(s.rangedRate)||0,poisonType:s.poisonType,partialChance:Number(s.partialChance)||0,partialHitSet
          };
        });
        // Compile policy/rotation once per simulation call. The optimizer invokes
        // this function many times; rebuilding these small arrays at every hit
        // was unnecessary interpreter/JIT work and did not change the model.
        const compiledPolicy = cfg.policy && cfg.policy.rules ? {
          poisonThreshold: Number(cfg.policy.rules[0]?.value ?? Infinity),
          urgent: Number(cfg.policy.rules[0]?.action ?? 0),
          resistThreshold: Number(cfg.policy.rules[1]?.value ?? Infinity),
          highResist: Number(cfg.policy.rules[1]?.action ?? 0),
          defaultAction: Number(cfg.policy.defaultAction ?? 0)
        } : null;
        const compiledRotation = (cfg.rotation||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=skillData.length).map(n=>n-1);
        let uptimeSum=0, attempts=0, successes=0, maxRes=0, totalHits=0;
        let totalPoisonAttempts=0,totalPoisonSuccesses=0,totalCrits=0,totalNormalHits=0,totalSkillActivations=0,totalRangedHits=0,totalMeleeHits=0,totalMeleeCrits=0,totalRangedCrits=0;
        const timeline=[];

        for(let n=0;n<trials;n++) {
          const rng=mulberry32(((cfg.seed||1234567)+n*1000003)>>>0);
          const skills=skillData;
          const ready=skills.map(()=>0);
          const cooldownReduction=skills.map(()=>0);
          const cooldownStart=skills.map(()=>0);
          let t=0,busyUntil=0,poisonUntil=-Infinity,resist=Number(cfg.baseResist)||0,peakRes=resist,u=0,comboHits=0;
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
            return ((Number(equipment.ctPromo)||0)+(specialEffect==='hpmax'&&hpMaxActive?20:0))/100;
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
            totalCrits++;
          }
          function poisonAttempt(chance,special=false) {
            const numericChance=Number(chance);
            if(!special && !(numericChance>0)) return false;
            attempts++; totalPoisonAttempts++;
            const p=special?(1/3):chanceFromResist(numericChance,resist,'subtract');
            if(rng()<p) {
              successes++; totalPoisonSuccesses++;
              if(!special) {
                resist+=Number(cfg.rise)||0;peakRes=Math.max(peakRes,resist);}
                if(Number(cfg.ailmentDuration)>0) {
                  const end=Math.min(duration,t+Number(cfg.ailmentDuration));
                  if(end>t) {
                    if(t>=poisonUntil)u+=end-t; else if(end>poisonUntil)u+=end-poisonUntil; poisonUntil=Math.max(poisonUntil,end); }
                  }
                } else if(!special) {
                  const baseResist = Number(cfg.baseResist)||0;
                  resist=Math.max(baseResist, resist-(Number(cfg.fall)||0));
                }
              }
              function processHit(ev) {
                totalHits++;
                const isRanged=critEnabled && rng()<clamp(Number(ev.rangedRate ?? 0),0,100)/100;
                if(critEnabled) {
                  if(isRanged)totalRangedHits++;else totalMeleeHits++;
                  if(rng()<critRate) {
                    if(isRanged)totalRangedCrits++;else totalMeleeCrits++;shortenOneRandomCooldown(isRanged);}
                  }

                  if(specialEffect==='combo') {
                    if(comboHits===0) comboHits=1;
                    else if(rng()<comboSuccessRate) comboHits++;
                    else comboHits=1;
                    if(comboHits>=70) {
                      const candidates=[];
                      for(let j=0;j<ready.length;j++) if(ready[j]>t+1e-12) candidates.push(j);
                      if(candidates.length) {
                        ready[candidates[Math.floor(rng()*candidates.length)]]=t; }
                        comboHits=0;
                      }
                    }
                    if(ev.poisons) {
                      for(const poison of ev.poisons) poisonAttempt(poison.chance,poison.special); } else if(ev.poison)poisonAttempt(ev.poison.chance,ev.poison.special);
                    }
                    function policyPick() {
                      if(typeof cfg.policy==='function') return cfg.policy({t,poisonRemaining:Math.max(0,poisonUntil-t),resist,ready:ready.map(x=>x<=t+1e-9),skills});
                      if(compiledPolicy) {
                        const remaining=poisonUntil-t;
                        if(remaining<=compiledPolicy.poisonThreshold) return compiledPolicy.urgent;
                        if(resist>=compiledPolicy.resistThreshold) return compiledPolicy.highResist;
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

                        const order=compiledRotation.length?compiledRotation:skills.map((_,i)=>i);
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
                                  t=candidate;
                                  updateHpMaxState(t);

                                  if(nextNormal<=t+1e-9 && nextNormal<=duration+1e-9 && nextNormal<=nextSkill+1e-9) {
                                    totalNormalHits++;processHit({poison:null,normal:true});nextNormal+=1/normalHz;continue;
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

                                        const instant=clamp((Number(s.instant)||0)+(Number(equipment.instant)||0),0,100);
                                        cooldownReduction[idx]=0;cooldownStart[idx]=start;
                                        const promo=currentPromo();
                                        ready[idx]=start+(rng()*100<instant?0:(ct/(1+promo)));
                                        busyUntil=start+actionDuration;totalSkillActivations++;
                                        const isSpecial=s.type==='special',hits=isSpecial?1:Math.max(0,Math.floor(Number(s.hits)||0)),interval=isSpecial?0:Math.max(0,Number(s.interval)||0);
                                        for(let h=0;h<hits;h++) {
                                          const ht=start+h*interval;if(ht>duration+1e-9||ht>busyUntil+1e-9)break;
                                          const poisons=[];

                                          const asPoisonBaseChance=Number(equipment.poisonHit)||0;
                    const asPoisonChance=asPoisonBaseChance>0
                      ? asPoisonBaseChance+(Number(equipment.ailment)||0)
                      : 0;
                                          if(isSpecial) {
                                            poisons.push({chance:100,special:true});
                                            poisons.push({chance:asPoisonChance,special:false});
                                          }else{

                                            poisons.push({chance:asPoisonChance,special:false});

                                            if(s.poisonType==='partial'&&s.partialHitSet.has(h)) {
                                              poisons.push({chance:s.partialChance+(Number(equipment.ailment)||0),special:false});
                                            }
                                          }

                                          while(nextNormal<=ht+1e-9&&nextNormal<busyUntil+1e-9&&nextNormal<=duration+1e-9) {
                                            t=nextNormal;totalNormalHits++;processHit({poisons:[],normal:true,rangedRate:normalRangedRate});nextNormal+=1/normalHz;}
                                            t=ht;processHit({poisons,rangedRate:Number(s.rangedRate)||0});
                                          }
                                          t=busyUntil;
                                          if(execution<=1e-9)t=busyUntil;
                                        }
                                        uptimeSum+=duration>0?clamp(u/duration,0,1):0;maxRes=Math.max(maxRes,peakRes);
                                        if(n<20)timeline.push({trial:n+1,uptime:duration>0?clamp(u/duration,0,1):0});
                                      }
                                      return {uptime:uptimeSum/trials,attempts:attempts/trials,successes:successes/trials,successRate:attempts?successes/attempts:0,maxRes,timeline,hits:totalHits/trials,poisonAttempts:totalPoisonAttempts/trials,poisonSuccesses:totalPoisonSuccesses/trials,crits:critEnabled?totalCrits/trials:0,meleeHits:critEnabled?totalMeleeHits/trials:0,rangedHits:critEnabled?totalRangedHits/trials:0,meleeCrits:critEnabled?totalMeleeCrits/trials:0,rangedCrits:critEnabled?totalRangedCrits/trials:0,normalHits:totalNormalHits/trials,skillActivations:totalSkillActivations/trials};
                                    }
