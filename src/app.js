let lastResult=null,lastCsv='';
const $=id=>document.getElementById(id);

function esc(v) {
  return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
  function addSkill(v={type:'normal',ct:8,execution:.8,hits:5,interval:.2,rangedRate:0,poisonType:'all',partialHits:'',partialChance:''}, index=null) {
    const n=index??(document.querySelector('#skills tbody').children.length+1),tr=document.createElement('tr');
    const typeOptions=n===1
    ? `<option value="normal" ${v.type==='normal'?'selected':''}>アドバンススキル1</option><option value="special" ${v.type==='special'?'selected':''}>ランダマイズステート</option>`
    : `<option value="normal" selected>アドバンススキル${n}</option>`;
    tr.innerHTML=`<td>アドバンススキル${n}</td><td><select class="skillType">${typeOptions}</select></td><td><input class="ct" type="number" value="${esc(v.ct)}" step="0.01" min="0"></td><td><input class="execution" type="number" value="${esc(v.execution)}" step="0.01" min="0"></td><td><input class="hits" type="number" value="${esc(v.hits)}" min="1"></td><td><input class="interval" type="number" value="${esc(v.interval)}" step="0.01" min="0"></td><td class="ranged-col"><input class="rangedRate" type="number" value="${esc(v.rangedRate)}" min="0" max="100" step="0.1"></td><td><select class="poisonType"><option value="all" ${v.poisonType==='all' || v.poisonType==='none'?'selected':''}>AS毒付与</option><option value="partial" ${v.poisonType==='partial'?'selected':''}>毒化</option></select></td><td><input class="partialHits" type="text" value="${esc(v.partialHits)}" placeholder="例: 2,5"></td><td><input class="partialChance" type="number" value="${esc(v.partialChance)}" step="0.1" min="0" placeholder="固有値"></td>`;
    document.querySelector('#skills tbody').appendChild(tr);
    tr.querySelector('.skillType').onchange=()=>refreshSkillTypeRow(tr);
    tr.querySelector('.poisonType').onchange=()=>refreshPoisonRow(tr);
    refreshSkillTypeRow(tr); refreshPoisonRow(tr);
  }
  function refreshSkillTypeRow(tr) {
    const special=tr.querySelector('.skillType').value==='special';
    const ct=tr.querySelector('.ct'),execution=tr.querySelector('.execution'),hits=tr.querySelector('.hits'),interval=tr.querySelector('.interval'),rangedRate=tr.querySelector('.rangedRate'),poisonType=tr.querySelector('.poisonType'),partialHits=tr.querySelector('.partialHits'),partialChance=tr.querySelector('.partialChance');
    if(special) {
      ct.value=20;
      execution.value=2.2;
      hits.value=1;
      interval.value=2.2;
      rangedRate.value=100;
      poisonType.value='all';
      partialHits.value='';
      partialChance.value='';
    }
    ct.disabled=false;
    execution.disabled=false;
    hits.disabled=false;
    interval.disabled=false;
    rangedRate.disabled=false;
    poisonType.disabled=false;
  }
  function refreshPoisonRow(tr) {
    const type=tr.querySelector('.poisonType').value;const partial=type==='partial';const hits=tr.querySelector('.partialHits'),chance=tr.querySelector('.partialChance');hits.disabled=!partial;chance.disabled=!partial;hits.parentElement.style.display=partial?'':'none';chance.parentElement.style.display=partial?'':'none';}
    function refreshCritUI() {
      const enabled=$('specialEffect').value==='crit';
      $('critRateWrap').style.display=enabled?'':'none';
      $('normalHpmWrap').style.display=enabled?'':'none';
      $('normalRangedRateWrap').style.display=enabled?'':'none';
      $('comboSuccessRateWrap').style.display=$('specialEffect').value==='combo'?'':'none';
      $('hpMaxUptimeWrap').style.display=$('specialEffect').value==='hpmax'?'':'none';
      document.querySelectorAll('.ranged-col').forEach(el=>el.style.display=enabled?'':'none');
    }
    addSkill({type:'normal',ct:20,execution:2.7,hits:8,interval:.075,rangedRate:100,poisonType:'partial',partialHits:'2,4,6,8',partialChance:50},1);addSkill({type:'normal',ct:30,execution:2.7,hits:11,interval:.085,rangedRate:100,poisonType:'all',partialHits:'',partialChance:''},2);addSkill({type:'normal',ct:20,execution:3,hits:5,interval:.288,rangedRate:0,poisonType:'all',partialHits:'',partialChance:''},3);

    const EQUIP_OPTIONS={
      g1:['poison13','ailment7','ct12','instant22'],
      g2a:['poison10','ailment3_5','ct8','instant16'],
      g2b:['poison6','ailment2_5','ct4','instant8']
    };
    const EQUIP_LABEL={poison13:'アドバンススキルヒット時毒付与13%',ailment7:'状態異常付与確率アップ7%',ct12:'アドバンススキルクールダウン促進12%',instant22:'アドバンススキル即時クールダウン22%',poison10:'アドバンススキルヒット時毒付与10%',ailment3_5:'状態異常付与確率アップ3.5%',ct8:'アドバンススキルクールダウン促進8%',instant16:'アドバンススキル即時クールダウン16%',poison6:'アドバンススキルヒット時毒付与6%',ailment2_5:'状態異常付与確率アップ2.5%',ct4:'アドバンススキルクールダウン促進4%',instant8:'アドバンススキル即時クールダウン8%'};
    function equipmentFromSlots(g1Count,slots) {
      const vals1=slots.g1.slice(0,g1Count), vals2=[slots.g2a,...slots.g2b];
      const vals=[...vals1,...vals2]; let poisonHit=0,ailment=0,ctPromo=0,instant=0;
      for(const v of vals) {
        if(v==='poison13')poisonHit+=13; else if(v==='poison10')poisonHit+=10; else if(v==='poison6')poisonHit+=6;
        else if(v==='ailment7')ailment+=7; else if(v==='ailment3_5')ailment+=3.5; else if(v==='ailment2_5')ailment+=2.5;
        else if(v==='ct12')ctPromo+=12; else if(v==='ct8')ctPromo+=8; else if(v==='ct4')ctPromo+=4;
        else if(v==='instant22')instant=Math.max(instant,22); else if(v==='instant16')instant=Math.max(instant,16); else if(v==='instant8')instant=Math.max(instant,8);
      }
      return {poisonHit,ailment,ctPromo,instant,slots:{g1:vals1,g2a:slots.g2a,g2b:slots.g2b}};
    }
    function defaultEquipment() {
      return equipmentFromSlots(+$('equipGroup1Count').value,{g1:Array(4).fill('poison13'),g2a:'poison10',g2b:['poison6','poison6']});}
      let optimizedEquipment=null;
      function renderEquipmentResult(e) {
        const s=e.slots, count=+$('equipGroup1Count').value;
        $('equipmentResult').innerHTML=`<h3>装備の最適化結果</h3><p><strong>ネックレス</strong>（${count===4?'エピック':'レジェンダリー'}）</p><p>${s.g1.slice(0,count).map((v,i)=>`${i+1}枠：${EQUIP_LABEL[v]}`).join('<br>')}</p><p><strong>タリスマン</strong></p><p>1枠：${EQUIP_LABEL[s.g2a]}<br>2枠：${EQUIP_LABEL[s.g2b[0]]}<br>3枠：${EQUIP_LABEL[s.g2b[1]]}</p><p><strong>合計</strong><br>アドバンススキルヒット時毒付与：+${e.poisonHit.toFixed(1)}%<br>状態異常付与確率アップ：+${e.ailment.toFixed(1)}%<br>アドバンススキルクールダウン促進：+${e.ctPromo.toFixed(1)}%<br>アドバンススキル即時クールダウン：+${e.instant.toFixed(1)}%</p>`;
      }

      function readSkills() {
        return [...document.querySelectorAll('#skills tbody tr')].map(r=>({type:r.querySelector('.skillType').value,ct:+r.querySelector('.ct').value,execution:+r.querySelector('.execution').value,hits:+r.querySelector('.hits').value,interval:+r.querySelector('.interval').value,rangedRate:+r.querySelector('.rangedRate').value,poisonType:r.querySelector('.poisonType').value,partialHits:r.querySelector('.partialHits').value,partialChance:+r.querySelector('.partialChance').value||0}));}
        function readCfg(rotationOverride=null,trialsOverride=null) {
          return {trials:trialsOverride??+$('trials').value,duration:+$('duration').value,baseResist:+$('baseResist').value,rise:+$('rise').value,fall:+$('fall').value,ailmentDuration:+$('ailmentDuration').value,critRate:$('specialEffect').value==='crit'?+$('critRate').value:0,normalHpm:+$('normalHpm').value,normalRangedRate:$('specialEffect').value==='crit'?+$('normalRangedRate').value:0,comboSuccessRate:$('specialEffect').value==='combo'?+$('comboSuccessRate').value:0,hpMaxUptime:$('specialEffect').value==='hpmax'?+$('hpMaxUptime').value:0,specialEffect:$('specialEffect').value,equipment:optimizedEquipment||defaultEquipment(),seed:1234567,rotation:rotationOverride??$('rotation').value.split(',').map(Number).filter(Number.isFinite),skills:readSkills()};
        }
        function render(r) {
          const baseMetrics=[['毒維持率',`${(r.uptime*100).toFixed(3)}%`],['平均ヒット/戦闘',r.hits.toFixed(2)]]; const critMetrics=$('specialEffect').value==='crit'?[['平均クリティカル(弱点命中)/戦闘',r.crits.toFixed(2)],['平均近接ヒット/戦闘',r.meleeHits.toFixed(2)],['平均遠隔ヒット/戦闘',r.rangedHits.toFixed(2)],['平均近接クリティカル(弱点命中)/戦闘',r.meleeCrits.toFixed(2)],['平均遠隔クリティカル(弱点命中)/戦闘',r.rangedCrits.toFixed(2)]]:[]; $('metrics').innerHTML=[...baseMetrics,...critMetrics,['平均通常攻撃ヒット/戦闘',r.normalHits.toFixed(2)],['平均スキル発動/戦闘',r.skillActivations.toFixed(2)],['平均毒判定/戦闘',r.poisonAttempts.toFixed(2)],['平均成功/戦闘',r.successes.toFixed(2)],['平均成功率',`${(r.successRate*100).toFixed(3)}%`]].map(x=>`<div class="metric"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
          const c=$('chart'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#cbd5e1';ctx.beginPath();ctx.moveTo(45,20);ctx.lineTo(45,h-35);ctx.lineTo(w-20,h-35);ctx.stroke();ctx.fillStyle='#475569';ctx.font='12px system-ui';ctx.fillText('trial',w-45,h-15);ctx.fillText('uptime',8,20);const vals=r.timeline.map(x=>x.uptime),bw=Math.max(10,(w-80)/Math.max(vals.length,1)-4);vals.forEach((v,i)=>{const x=50+i*(bw+4),y=(h-35)-v*(h-60);ctx.fillRect(x,y,bw,v*(h-60));ctx.fillText(String(i+1),x,h-22);});
          $('log').textContent='';
          lastCsv='metric,value\npoison_uptime,'+r.uptime+'\navg_hits,'+r.hits+'\n'+($('specialEffect').value==='crit'?('avg_critical_hits,'+r.crits+'\navg_melee_hits,'+r.meleeHits+'\navg_ranged_hits,'+r.rangedHits+'\navg_melee_crits,'+r.meleeCrits+'\navg_ranged_crits,'+r.rangedCrits+'\n'):'')+'avg_normal_attack_hits,'+r.normalHits+'\navg_skill_activations,'+r.skillActivations+'\navg_poison_attempts,'+r.poisonAttempts+'\navg_poison_successes,'+r.poisonSuccesses+'\navg_successes,'+r.successes+'\nsuccess_rate,'+r.successRate+'\n';
        }

        function makeCandidates(n,maxLen=5) {
          const out=[];
          function rec(a) {
            if(a.length) {
              out.push(a.slice());}if(a.length>=maxLen)return;for(let i=1;i<=n;i++) {
                a.push(i);rec(a);a.pop();}}
                rec([]);return out;
              }
              function actionLabel(a) {
                return a===0?'通常攻撃':`アドバンススキル${a}`;}
                function randomPolicyCandidates(count) {
                  const rng=(()=>{let x=123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};})();
                  const thresholdsP=[0.5,1,2,3,5,7], thresholdsR=[25,50,75,100], actions=[0,1,2,3];
                  const out=[], seen=new Set();
                  while(out.length<count) {
                    const p=thresholdsP[Math.floor(rng()*thresholdsP.length)], r=thresholdsR[Math.floor(rng()*thresholdsR.length)];
                    const a1=actions[Math.floor(rng()*actions.length)],a2=actions[Math.floor(rng()*actions.length)],a3=actions[Math.floor(rng()*actions.length)];
                    const key=[p,r,a1,a2,a3].join('|'); if(seen.has(key))continue;seen.add(key);
                    out.push({poisonThreshold:p,resistThreshold:r,urgent:a1,highResist:a2,defaultAction:a3});
                  }
                  return out;
                }
                function policyFromSpec(spec) {
                  return {rules:[{type:'poison_le',value:spec.poisonThreshold,action:spec.urgent},{type:'resist_ge',value:spec.resistThreshold,action:spec.highResist}],defaultAction:spec.defaultAction};
                }
                function policyText(p) {
                  return `毒残り時間 ≤ ${p.poisonThreshold}s → ${actionLabel(p.urgent)}\n毒残り時間が上記を超え、毒耐性 ≥ ${p.resistThreshold}% → ${actionLabel(p.highResist)}\nそれ以外 → ${actionLabel(p.defaultAction)}\n※指定したスキルがCT中の場合は、設定したローテーション順に使用可能なスキルを選択します。`}
                  function optimizeRotation() {
                    const skills=readSkills();
                    if(skills.length!==3) throw new Error('自動最適化は3スキルを前提にしています。特殊スキルを含め、3枠のまま設定してください。');
                    const coarseTrials=Math.max(50,Math.min(500,+$('optTrials').value||200));
                    const topK=Math.max(3,Math.min(30,+$('optTopK').value||10));
                    const maxLen=Math.max(1,Math.min(7,+$('optDepth').value||5));
                    const base=readCfg(null,coarseTrials), candidates=makeCandidates(3,maxLen), scored=[];
                    $('status').textContent=`最適化中… ${candidates.length}候補を粗探索`;
                    for(let i=0;i<candidates.length;i++) {
                      const r=runSimulation({...base,rotation:candidates[i],seed:24681357+i*97});scored.push({rotation:candidates[i],score:r.uptime});}
                      scored.sort((a,b)=>b.score-a.score);const finalists=scored.slice(0,topK),fullTrials=Math.max(100,+$('trials').value||10000);let best=null;
                      for(let i=0;i<finalists.length;i++) {
                        $('status').textContent=`最適化中… 最終評価 ${i+1}/${finalists.length}`;const c=readCfg(finalists[i].rotation,fullTrials);c.seed=975318642+i*101;const r=runSimulation(c),x={rotation:finalists[i].rotation,score:r.uptime,result:r};if(!best||x.score>best.score)best=x; }
                        if(!best)throw new Error('最適化候補がありません。');
                        $('rotation').value=best.rotation.join(',');lastResult=best.result;render(best.result);
                        const ranking=finalists.map((x,i)=>`${i+1}. ${x.rotation.join(' → ')} : ${(x.score*100).toFixed(3)}%`).join('\n');
                        $('optimizationResult').textContent=`【固定ローテーション最適化】\n最適戦略：${best.rotation.join(' → ')}\n最終評価 毒維持率：${(best.score*100).toFixed(3)}%\n\n粗探索上位候補：\n${ranking}`;
                      }
                      function optimizePolicy() {
                        const skills=readSkills();
                        if(skills.length!==3) throw new Error('自動最適化は3スキルを前提にしています。特殊スキルを含め、3枠のまま設定してください。');
                        const coarseTrials=Math.max(50,Math.min(300,+$('optTrials').value||200));
                        const topK=Math.max(3,Math.min(20,+$('optTopK').value||10));
                        const sampleCount=Math.max(50,Math.min(400,+$('optDepth').value*60||300));
                        const base=readCfg([1,2,3],coarseTrials);
                        const candidates=randomPolicyCandidates(sampleCount),scored=[];
                        $('status').textContent=`最適化中… 条件分岐候補を${candidates.length}個粗探索`;
                        for(let i=0;i<candidates.length;i++) {
                          const c={...base,policy:policyFromSpec(candidates[i]),seed:31415926+i*131};
                          const r=runSimulation(c);scored.push({...candidates[i],score:r.uptime});
                        }
                        scored.sort((a,b)=>b.score-a.score);const finalists=scored.slice(0,topK),fullTrials=Math.max(100,+$('trials').value||10000);let best=null;
                        for(let i=0;i<finalists.length;i++) {
                          $('status').textContent=`最適化中… 条件分岐の最終評価 ${i+1}/${finalists.length}`;const c=readCfg([1,2,3],fullTrials);c.policy=policyFromSpec(finalists[i]);c.seed=27182818+i*173;const r=runSimulation(c),x={...finalists[i],result:r};if(!best||x.result.uptime>best.result.uptime)best=x; }
                          if(!best)throw new Error('条件分岐候補がありません。');
                          lastResult=best.result;render(best.result);
                          const rankText=finalists.map((x,i)=>`${i+1}. P≤${x.poisonThreshold}s / R≥${x.resistThreshold} → [${actionLabel(x.urgent)}, ${actionLabel(x.highResist)}, ${actionLabel(x.defaultAction)}] : ${(x.score*100).toFixed(3)}%`).join('\n');
                          $('optimizationResult').textContent=`【条件分岐型最適化】\n${policyText(best)}\n\n最終評価 毒維持率：${(best.result.uptime*100).toFixed(3)}%\n\n粗探索上位候補：\n${rankText}`;
                        }

                        function* enumerateEquipmentSlots(count) {
                          const g1=EQUIP_OPTIONS.g1,g2a=EQUIP_OPTIONS.g2a,g2b=EQUIP_OPTIONS.g2b;
                          for(let a=0;a<g1.length;a++)for(let b=0;b<g1.length;b++)for(let c=0;c<g1.length;c++) {
                            if(count===3) {
                              for(let x=0;x<g2a.length;x++)for(let y=0;y<g2b.length;y++)for(let z=0;z<g2b.length;z++) yield {g1:[g1[a],g1[b],g1[c]],g2a:g2a[x],g2b:[g2b[y],g2b[z]]};
                            } else {
                              for(let d=0;d<g1.length;d++)for(let x=0;x<g2a.length;x++)for(let y=0;y<g2b.length;y++)for(let z=0;z<g2b.length;z++) yield {g1:[g1[a],g1[b],g1[c],g1[d]],g2a:g2a[x],g2b:[g2b[y],g2b[z]]};
                            }
                          }
                        }
                        function equipmentKey(e) { return [e.poisonHit,e.ailment,e.ctPromo,e.instant].join('|'); }
                        function collectUniqueEquipment(count) {
                          const map=new Map();
                          for(const slots of enumerateEquipmentSlots(count)) {
                            const e=equipmentFromSlots(count,slots),key=equipmentKey(e);
                            if(!map.has(key))map.set(key,e);
                          }
                          return [...map.values()];
                        }
                        function basicStrategyCandidates() {
                          const out=[],seen=new Set(),add=a=>{const k=a.join(',');if(!seen.has(k)){seen.add(k);out.push(a);}};
                          for(let i=1;i<=3;i++)add([i]);
                          for(let i=1;i<=3;i++)for(let j=1;j<=3;j++)if(i!==j)add([i,j]);
                          [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]].forEach(add);
                          return out;
                        }
                        function policyCandidatesSystematic(baseResist,duration) {
                          const poisonThresholds=[0,0.5,1,2,3,5,7,9,Math.min(10,Math.max(0,duration))];
                          const resistThresholds=[25,50,75,100,Math.max(0,baseResist)];
                          const out=[],seen=new Set();
                          for(const p of poisonThresholds)for(const r of resistThresholds)for(let urgent=0;urgent<=3;urgent++)for(let highResist=0;highResist<=3;highResist++)for(let defaultAction=0;defaultAction<=3;defaultAction++) {
                            const key=[p,r,urgent,highResist,defaultAction].join('|');
                            if(seen.has(key))continue;
                            seen.add(key);out.push({poisonThreshold:p,resistThreshold:r,urgent,highResist,defaultAction});
                          }
                          return out;
                        }
                        async function optimizeJoint() {
                          const skills=readSkills();
                          if(skills.length!==3) throw new Error('装備＋スキル使用方法の自動最適化は3スキルを前提にしています。');
                          const count=+$('equipGroup1Count').value;
                          $('optimize').disabled=true;
                          $('optimizationResult').textContent='';
                          const yieldUI=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
                          const effect=$('specialEffect').value;
                          const userTrials=Math.max(100,Math.floor(+$('trials').value||10000));
                          try {
                            const equipments=collectUniqueEquipment(count);
                            const strategies=basicStrategyCandidates();
                            const duration=Number($('duration').value)||600;

                            /*
                             * Stage 1: equipment screening.
                             * Do not run every equipment through every strategy for the full
                             * battle.  First rank equipment with a short, low-noise sample.
                             * Keep several candidates per strategy so a single lucky result
                             * cannot eliminate an equipment/rotation pair.
                             */
                            const pairs=[];
                            const equipmentScore=(e)=>{
                              const poison=Number(e.poisonHit)||0;
                              const ailment=Number(e.ailment)||0;
                              const promo=Number(e.ctPromo)||0;
                              const instant=Number(e.instant)||0;
                              /* This is only a pre-screen, not the final objective.
                                 Poison probability is weighted most because it directly
                                 creates the event we are optimizing; CT effects are
                                 secondary because they matter only when additional casts
                                 can actually be converted into poison uptime. */
                              return poison*1.0+ailment*0.45+promo*0.18+instant*0.12;
                            };
                            const selectedEquipMap=new Map();
                            const addEquipRank=(arr,limit)=>{for(const e of arr.slice(0,limit))selectedEquipMap.set(equipmentKey(e),e);};
                            addEquipRank(equipments.slice().sort((a,b)=>(b.poisonHit-a.poisonHit)||(b.ailment-a.ailment)),35);
                            addEquipRank(equipments.slice().sort((a,b)=>(b.ctPromo-a.ctPromo)||(b.instant-a.instant)),35);
                            addEquipRank(equipments.slice().sort((a,b)=>(b.instant-a.instant)||(b.ctPromo-a.ctPromo)),35);
                            addEquipRank(equipments.slice().sort((a,b)=>(b.ailment-a.ailment)||(b.poisonHit-a.poisonHit)),35);
                            addEquipRank(equipments.slice().sort((a,b)=>equipmentScore(b)-equipmentScore(a)),60);
                            addEquipRank(equipments.slice().sort((a,b)=>(b.poisonHit+b.ailment)-(a.poisonHit+a.ailment)),40);
                            const heuristicEquipments=[...selectedEquipMap.values()];
                            const screenDuration=Math.min(duration,20);
                            const screenTrials=effect==='hpmax'?2:1;
                            const baseScreen=readCfg([1,2,3],screenTrials);
                            baseScreen.duration=screenDuration;
                            if(effect==='hpmax') baseScreen.normalHpm=0;
                            $('status').textContent=`最適化中… 装備事前選別 ${heuristicEquipments.length}/${equipments.length}`;
                            await yieldUI();

                            for(let i=0;i<heuristicEquipments.length;i++) {
                              const e=heuristicEquipments[i];
                              /* Screen the full basic strategy set only for the most
                                 promising equipment.  This keeps the search broad while
                                 avoiding thousands of expensive simulations. */
                              for(let j=0;j<strategies.length;j++) {
                                const rotation=strategies[j];
                                const r=runSimulation({...baseScreen,equipment:e,rotation,policy:null,seed:123456789+i*1000+j});
                                pairs.push({equipment:e,rotation,score:r.uptime});
                              }
                              if(i%3===0||i===heuristicEquipments.length-1) {
                                $('status').textContent=`最適化中… 装備×ローテーション ${i+1}/${heuristicEquipments.length}`;
                                await yieldUI();
                              }
                            }

                            /* Keep the best few pairs globally AND the best few for each
                               rotation. This is safer than selecting only one rotation per
                               equipment. */
                            pairs.sort((a,b)=>b.score-a.score);
                            const keepGlobal=Math.min(40,pairs.length);
                            const keepPerRotation=4;
                            const selectedMap=new Map();
                            for(const x of pairs.slice(0,keepGlobal)) selectedMap.set(equipmentKey(x.equipment)+'|'+x.rotation.join(','),x);
                            for(const rotation of strategies) {
                              const own=pairs.filter(x=>x.rotation.join(',')===rotation.join(',')).slice(0,keepPerRotation);
                              for(const x of own) selectedMap.set(equipmentKey(x.equipment)+'|'+x.rotation.join(','),x);
                            }
                            const selected=[...selectedMap.values()];

                            /* Stage 2: systematic policy search, but only around the
                               genuinely promising equipment/rotation pairs.  The old
                               algorithm evaluated 2,880 policies × 10 equipments × 3
                               rotations.  Here we use structured policy families and a
                               short screen before any full evaluation. */
                            const poisonThresholds=[0.5,1,2,3,5,7,9];
                            const baseResist=Number($('baseResist').value)||0;
                            const resistThresholds=[baseResist,25,50,75,100].filter((v,i,a)=>a.indexOf(v)===i);
                            const actions=[0,1,2,3];
                            const policyCandidates=[];
                            const seenPolicy=new Set();
                            const addPolicy=(p)=>{const k=[p.poisonThreshold,p.resistThreshold,p.urgent,p.highResist,p.defaultAction].join('|');if(!seenPolicy.has(k)){seenPolicy.add(k);policyCandidates.push(p);}};

                            /* Deterministic policy families.  For every threshold pair,
                               evaluate four uniform policies plus four AS1-priority and
                               four AS2/AS3-priority variants.  This gives complete
                               threshold coverage without the old 2,880-policy explosion. */
                            for(const p of poisonThresholds) for(const r of resistThresholds) {
                              for(const action of actions) {
                                addPolicy({poisonThreshold:p,resistThreshold:r,urgent:action,highResist:action,defaultAction:action});
                              }
                              for(const fallback of [0,1,2,3]) {
                                addPolicy({poisonThreshold:p,resistThreshold:r,urgent:1,highResist:fallback,defaultAction:fallback});
                              }
                              for(const urgent of [2,3]) {
                                addPolicy({poisonThreshold:p,resistThreshold:r,urgent,highResist:urgent,defaultAction:urgent});
                              }
                            }

                            const policyScreenTrials=effect==='hpmax'?1:1;
                            const policyDuration=Math.min(duration,30);
                            const policyScored=[];
                            const pairLimit=Math.min(16,selected.length);
                            const policyLimit=policyCandidates.length;
                            $('status').textContent=`最適化中… 条件分岐候補を${pairLimit}組×${policyLimit}候補で短時間評価`;
                            let work=0;
                            for(let i=0;i<pairLimit;i++) {
                              const e=selected[i];
                              for(let j=0;j<policyLimit;j++) {
                                const p=policyCandidates[j];
                                const c={...baseScreen,equipment:e.equipment,rotation:e.rotation,policy:policyFromSpec(p),trials:policyScreenTrials,duration:policyDuration,seed:500000+i*10000+j};
                                if(effect==='hpmax') c.normalHpm=0;
                                const r=runSimulation(c);
                                policyScored.push({equipment:e.equipment,rotation:e.rotation,policy:p,score:r.uptime});
                                if(++work%12===0) await yieldUI();
                              }
                              $('status').textContent=`最適化中… 条件分岐スクリーニング ${i+1}/${pairLimit}`;
                            }
                            policyScored.sort((a,b)=>b.score-a.score);

                            /* Stage 3: full-ish evaluation.  Only a small number of
                               finalists are expensive.  The optimizer's trial count is
                               deliberately capped; the normal Run Simulation button can
                               still be used for a high-precision final measurement. */
                            const finalists=[];
                            const finalSeen=new Set();
                            for(const x of policyScored) {
                              const key=equipmentKey(x.equipment)+'|'+x.rotation.join(',')+'|'+[x.policy.poisonThreshold,x.policy.resistThreshold,x.policy.urgent,x.policy.highResist,x.policy.defaultAction].join(',');
                              if(!finalSeen.has(key)) {finalSeen.add(key);finalists.push(x);}
                              if(finalists.length>=30) break;
                            }
                            /* Always include fixed-rotation controls, with at least one
                               representative for every rotation family. */
                            const fixedByRotation=new Map();
                            for(const x of pairs) {
                              const key=x.rotation.join(',');
                              if(!fixedByRotation.has(key)) fixedByRotation.set(key,x);
                            }
                            for(const x of fixedByRotation.values()) {
                              const key=equipmentKey(x.equipment)+'|'+x.rotation.join(',')+'|FIXED';
                              if(!finalSeen.has(key)) {finalSeen.add(key);finalists.push({equipment:x.equipment,rotation:x.rotation,policy:null,score:x.score,fixed:true});}
                            }
                            const preliminaryTrials=Math.min(20,Math.max(5,Math.floor(userTrials/100)));
                            const preliminary=[];
                            for(let i=0;i<finalists.length;i++) {
                              const f=finalists[i];
                              $('status').textContent=`最適化中… 候補比較 ${i+1}/${finalists.length}（${preliminaryTrials}試行）`;
                              await yieldUI();
                              const c={...readCfg(f.rotation,preliminaryTrials),equipment:f.equipment,seed:900000000};
                              c.policy=f.policy?policyFromSpec(f.policy):null;
                              if(effect==='hpmax') c.normalHpm=0;
                              const r=runSimulation(c);
                              preliminary.push({...f,result:r,score:r.uptime});
                            }
                            preliminary.sort((a,b)=>b.score-a.score);
                            const distinctPreliminary=new Map();
                            for(const x of preliminary) {
                              const key=equipmentKey(x.equipment);
                              if(!distinctPreliminary.has(key)) distinctPreliminary.set(key,x);
                            }
                            const finalShortlist=[...distinctPreliminary.values()].slice(0,5);
                            const finalTrials=Math.min(100,Math.max(50,Math.floor(userTrials/50)));
                            const finalEvaluated=[];
                            for(let i=0;i<finalShortlist.length;i++) {
                              const f=finalShortlist[i];
                              $('status').textContent=`最適化中… 最終評価 ${i+1}/${finalShortlist.length}（${finalTrials}試行）`;
                              await yieldUI();
                              const c={...readCfg(f.rotation,finalTrials),equipment:f.equipment,seed:900000000};
                              c.policy=f.policy?policyFromSpec(f.policy):null;
                              if(effect==='hpmax') c.normalHpm=0;
                              const r=runSimulation(c);
                              finalEvaluated.push({...f,result:r,score:r.uptime});
                            }
                            finalEvaluated.sort((a,b)=>b.score-a.score);
                            const distinctFinal=new Map();
                            for(const x of finalEvaluated) {
                              const key=equipmentKey(x.equipment);
                              const prev=distinctFinal.get(key);
                              if(!prev || x.score>prev.score) distinctFinal.set(key,x);
                            }
                            const rankedFinal=[...distinctFinal.values()].sort((a,b)=>b.score-a.score).slice(0,5);
                            const best=rankedFinal[0];                            if(!best) throw new Error('最適化候補がありません。');

                            optimizedEquipment=best.equipment;
                            lastResult=best.result;
                            render(best.result);
                            renderEquipmentResult(best.equipment);
                            $('rotation').value=best.rotation.join(',');

                            const s=best.equipment.slots,e=best.equipment;
                            const bestPolicy=best.policy||null;
                            const policyOutput=bestPolicy?policyText(bestPolicy):'固定ローテーション（条件分岐なし）';
                            const rankText=rankedFinal.map((x,i)=>{
                              const p=x.policy;
                              const pol=p?`P≤${p.poisonThreshold}s / R≥${p.resistThreshold}% → [${actionLabel(p.urgent)}, ${actionLabel(p.highResist)}, ${actionLabel(p.defaultAction)}]`:'固定ローテーション';
                              const e=x.equipment;
                              const equipSummary=`毒+${e.poisonHit.toFixed(1)}% / 状態異常+${e.ailment.toFixed(1)}% / CT促進+${e.ctPromo.toFixed(1)}% / 即時CT+${e.instant.toFixed(1)}%`;
                              return `${i+1}. ${x.rotation.join(' → ')} / ${pol} / ${equipSummary} : ${(x.score*100).toFixed(3)}%`;
                            }).join('\n');
                            $('optimizationResult').textContent=`【装備＋スキル使用方法の同時最適化】
ネックレス（${count===4?'エピック':'レジェンダリー'}）
${s.g1.map((v,i)=>`${i+1}枠：${EQUIP_LABEL[v]}`).join('\n')}

タリスマン
1枠：${EQUIP_LABEL[s.g2a]}
2枠：${EQUIP_LABEL[s.g2b[0]]}
3枠：${EQUIP_LABEL[s.g2b[1]]}

合計
アドバンススキルヒット時毒付与：+${e.poisonHit.toFixed(1)}%
状態異常付与確率アップ：+${e.ailment.toFixed(1)}%
アドバンススキルクールダウン促進：+${e.ctPromo.toFixed(1)}%
アドバンススキル即時クールダウン：+${e.instant.toFixed(1)}%

【スキル使用方針】
${policyOutput}
${best.policy?'フォールバックローテーション：':''}${best.rotation.join(' → ')}

最終評価 毒維持率：${(best.result.uptime*100).toFixed(3)}%
（最適化内部評価：予備評価${preliminaryTrials}試行 → 上位5候補を${finalTrials}試行。高精度の最終確認は通常シミュレーションで実行してください。）

最終候補ランキング（上位5件）：
${rankText}

※装備は全組み合わせを集計値で統合します。短時間スクリーニングで装備×ローテーション候補を選別し、固定ローテーションと条件分岐型を同じ目的関数で比較した上で、条件分岐を系統的に探索します。最終候補だけを多試行評価するため、従来方式より大幅に計算量を削減しています。`;
                            $('status').textContent='最適化完了';
                          } finally {
                            $('optimize').disabled=false;
                          }
                        }

                              function optimize() {
                                return optimizeJoint(); }
                                $('specialEffect').onchange=refreshCritUI; refreshCritUI();
                                $('optimize').onclick=async()=>{try{await optimize();}catch(e) {
                                  $('status').textContent='エラー: '+e.message;console.error(e);}};
                                  $('export').onclick=()=>{if(!lastCsv)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lastCsv],{type:'text/csv'}));a.download='simulation_result.csv';a.click();URL.revokeObjectURL(a.href)};
