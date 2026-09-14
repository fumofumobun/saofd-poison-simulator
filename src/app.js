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
                              for(let x=0;x<g2a.length;x++)for(let y=0;y<g2b.length;y++)for(let z=0;z<g2b.length;z++)
                              yield {g1:[g1[a],g1[b],g1[c]],g2a:g2a[x],g2b:[g2b[y],g2b[z]]};
                            }else{
                              for(let d=0;d<g1.length;d++)for(let x=0;x<g2a.length;x++)for(let y=0;y<g2b.length;y++)for(let z=0;z<g2b.length;z++)
                              yield {g1:[g1[a],g1[b],g1[c],g1[d]],g2a:g2a[x],g2b:[g2b[y],g2b[z]]};
                            }
                          }
                        }
                        function equipmentKey(e) {
                          return [e.poisonHit,e.ailment,e.ctPromo,e.instant].join('|');}
                          function collectUniqueEquipment(count) {
                            const map=new Map();
                            for(const slots of enumerateEquipmentSlots(count)) {
                              const e=equipmentFromSlots(count,slots),key=equipmentKey(e);
                              if(!map.has(key))map.set(key,e);
                            }
                            return [...map.values()];
                          }
                          function basicStrategyCandidates() {
                            const out=[]; const seen=new Set();
                            const add=a=>{const k=a.join(',');if(!seen.has(k)) {
                              seen.add(k);out.push(a);}};
                              for(let i=1;i<=3;i++)add([i]);
                              for(let i=1;i<=3;i++)for(let j=1;j<=3;j++)if(i!==j)add([i,j]);
                              const perms=[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];perms.forEach(add);
                              return out;
                            }
                            function chooseBestBasicForEquipment(base,equipment,coarseTrials) {
                              let best=null;
                              for(const rotation of basicStrategyCandidates()) {
                                const r=runSimulation({...base,equipment,rotation,policy:null});
                                if(!best||r.uptime>best.score)best={rotation,score:r.uptime};
                              }
                              return best;
                            }
                            async function optimizeJoint() {
                              const skills=readSkills(); if(skills.length!==3)throw new Error('装備＋スキル使用方法の自動最適化は3スキルを前提にしています。');
                              const count=+$('equipGroup1Count').value;
                              $('optimize').disabled=true; $('optimizationResult').textContent='';
                              try{

                                const equipments=collectUniqueEquipment(count), base=readCfg([1,2,3],1), scored=[];
                                $('status').textContent=`最適化中… 装備を全列挙 (${equipments.length}種類)`;
                                for(let i=0;i<equipments.length;i++) {
                                  const best=chooseBestBasicForEquipment(base,equipments[i],1);
                                  scored.push({equipment:equipments[i],rotation:best.rotation,score:best.score});
                                  if(i%10===0||i===equipments.length-1) {
                                    $('status').textContent=`最適化中… 装備全列挙 ${i+1}/${equipments.length}`;await new Promise(requestAnimationFrame);}
                                  }
                                  scored.sort((a,b)=>b.score-a.score);

                                  const equipTop=Math.min(30,scored.length), policyPool=randomPolicyCandidates(80), policyScored=[];
                                  for(let i=0;i<equipTop;i++) {
                                    const e=scored[i];
                                    for(let j=0;j<policyPool.length;j++) {
                                      const p=policyPool[j],c={...base,equipment:e.equipment,policy:policyFromSpec(p),rotation:e.rotation,seed:400000+i*1000+j};
                                      const r=runSimulation(c);policyScored.push({equipment:e.equipment,policy:p,rotation:e.rotation,score:r.uptime});
                                    }
                                    $('status').textContent=`最適化中… 上位装備の使用方針探索 ${i+1}/${equipTop}`;await new Promise(requestAnimationFrame);
                                  }
                                  policyScored.sort((a,b)=>b.score-a.score);
                                  const finalists=policyScored.slice(0,10);
                                  const fullTrials=Math.max(100,Math.min(2000,+$('trials').value||10000));
                                  let best=null;
                                  for(let i=0;i<finalists.length;i++) {
                                    const f=finalists[i];$('status').textContent=`最適化中… 最終評価 ${i+1}/${finalists.length}`;await new Promise(requestAnimationFrame);
                                    const c={...readCfg(f.rotation,fullTrials),equipment:f.equipment,policy:policyFromSpec(f.policy),seed:900000+i*1009};
                                    const r=runSimulation(c);if(!best||r.uptime>best.result.uptime)best={...f,result:r};
                                  }
                                  if(!best)throw new Error('最適化候補がありません。');
                                  optimizedEquipment=best.equipment;lastResult=best.result;render(best.result);renderEquipmentResult(best.equipment);
                                  const s=best.equipment.slots,e=best.equipment;
                                  $('optimizationResult').textContent=`【装備＋スキル使用方法の同時最適化】\nネックレス（${count===4?'エピック':'レジェンダリー'}）\n${s.g1.map((v,i)=>`${i+1}枠：${EQUIP_LABEL[v]}`).join('\n')}\n\nタリスマン\n1枠：${EQUIP_LABEL[s.g2a]}\n2枠：${EQUIP_LABEL[s.g2b[0]]}\n3枠：${EQUIP_LABEL[s.g2b[1]]}\n\n合計\nアドバンススキルヒット時毒付与：+${e.poisonHit.toFixed(1)}%\n状態異常付与確率アップ：+${e.ailment.toFixed(1)}%\nアドバンススキルクールダウン促進：+${e.ctPromo.toFixed(1)}%\nアドバンススキル即時クールダウン：+${e.instant.toFixed(1)}%\n\n${policyText(best.policy)}\n最終評価 毒維持率：${(best.result.uptime*100).toFixed(3)}%\n\n※装備は全組み合わせを列挙し、同一集計値は統合しています。上位装備についてスキル使用方針を探索し、最終候補を精密評価しています。`;
                                  $('status').textContent='最適化完了';
                                }finally{$('optimize').disabled=false;}
                              }
                              function optimize() {
                                return optimizeJoint(); }
                                $('specialEffect').onchange=refreshCritUI; refreshCritUI();
                                $('optimize').onclick=async()=>{try{await optimize();}catch(e) {
                                  $('status').textContent='エラー: '+e.message;console.error(e);}};
                                  $('export').onclick=()=>{if(!lastCsv)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lastCsv],{type:'text/csv'}));a.download='simulation_result.csv';a.click();URL.revokeObjectURL(a.href)};
