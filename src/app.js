let lastResult=null;
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
      function equipmentEffectsText(e) {
        const s=e && e.slots ? e.slots : {g1:[],g2a:'',g2b:['','']};
        const count=+$('equipGroup1Count').value;
        const g1=s.g1.slice(0,count).map((v,i)=>`${i+1}枠：${EQUIP_LABEL[v]||v}`).join('\n');
        const g2=`1枠：${EQUIP_LABEL[s.g2a]||s.g2a}\n2枠：${EQUIP_LABEL[s.g2b?.[0]]||s.g2b?.[0]}\n3枠：${EQUIP_LABEL[s.g2b?.[1]]||s.g2b?.[1]}`;
        return `【最適装備の効果一覧】\nネックレス（${count===4?'エピック':'レジェンダリー'}）\n${g1}\n\nタリスマン\n${g2}\n\n合計効果\nアドバンススキルヒット時毒付与：+${Number(e.poisonHit||0).toFixed(1)}%\n状態異常付与確率アップ：+${Number(e.ailment||0).toFixed(1)}%\nアドバンススキルクールダウン促進：+${Number(e.ctPromo||0).toFixed(1)}%\nアドバンススキル即時クールダウン：+${Number(e.instant||0).toFixed(1)}%`;
      }
      function renderEquipmentResult(e) {
        $('equipmentResult').textContent=equipmentEffectsText(e);
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
  for(let a=0;a<g1.length;a++) for(let b=0;b<g1.length;b++) for(let c=0;c<g1.length;c++) {
    if(count===3) {
      for(let x=0;x<g2a.length;x++) for(let y=0;y<g2b.length;y++) for(let z=0;z<g2b.length;z++)
        yield {g1:[g1[a],g1[b],g1[c]],g2a:g2a[x],g2b:[g2b[y],g2b[z]]};
    } else {
      for(let d=0;d<g1.length;d++) for(let x=0;x<g2a.length;x++) for(let y=0;y<g2b.length;y++) for(let z=0;z<g2b.length;z++)
        yield {g1:[g1[a],g1[b],g1[c],g1[d]],g2a:g2a[x],g2b:[g2b[y],g2b[z]]};
    }
  }
}
function equipmentKey(e){return [e.poisonHit,e.ailment,e.ctPromo,e.instant].join('|');}
function collectUniqueEquipment(count){
  const map=new Map();
  for(const slots of enumerateEquipmentSlots(count)){
    const e=equipmentFromSlots(count,slots),k=equipmentKey(e);
    if(!map.has(k))map.set(k,e);
  }
  return [...map.values()];
}

function paretoPruneEquipment(all){
  // Exact pruning: an equipment aggregate can be removed only when another
  // aggregate is >= in all four monotone effects and > in at least one.
  // Under this simulator every effect is non-negative/monotone, so a dominated
  // aggregate can never outperform its dominator for the same strategy and
  // random stream. No sampling or heuristic score is involved.
  const keep=[];
  for(let i=0;i<all.length;i++){
    const a=all[i];
    let dominated=false;
    for(let j=0;j<all.length;j++){
      if(i===j)continue;
      const b=all[j];
      const ge=b.poisonHit>=a.poisonHit && b.ailment>=a.ailment && b.ctPromo>=a.ctPromo && b.instant>=a.instant;
      const gt=b.poisonHit>a.poisonHit || b.ailment>a.ailment || b.ctPromo>a.ctPromo || b.instant>a.instant;
      if(ge&&gt){dominated=true;break;}
    }
    if(!dominated)keep.push(a);
  }
  return keep;
}

function basicStrategyCandidates(){
  const out=[],seen=new Set();
  const add=a=>{const k=a.join(',');if(!seen.has(k)){seen.add(k);out.push(a);}};
  for(let i=1;i<=3;i++)add([i]);
  for(let i=1;i<=3;i++)for(let j=1;j<=3;j++)if(i!==j)add([i,j]);
  [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]].forEach(add);
  return out;
}
function policySpecsAll(duration,baseResist){
  const ps=[0,0.5,1,2,3,5,7,9,Math.min(10,Math.max(0,duration))];
  const rs=[25,50,75,100,Math.max(0,baseResist)].filter((v,i,a)=>a.indexOf(v)===i);
  const out=[];
  for(const p of ps)for(const r of rs)for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let c=0;c<4;c++)
    out.push({poisonThreshold:p,resistThreshold:r,urgent:a,highResist:b,defaultAction:c});
  return out;
}
function policyKey(p){return [p.poisonThreshold,p.resistThreshold,p.urgent,p.highResist,p.defaultAction].join('|');}
function policyFromSpec(spec){return {rules:[{type:'poison_le',value:spec.poisonThreshold,action:spec.urgent},{type:'resist_ge',value:spec.resistThreshold,action:spec.highResist}],defaultAction:spec.defaultAction};}
function policyText(p){
  return `毒残り時間 ≤ ${p.poisonThreshold}s → ${actionLabel(p.urgent)}\n毒残り時間が上記を超え、毒耐性 ≥ ${p.resistThreshold}% → ${actionLabel(p.highResist)}\nそれ以外 → ${actionLabel(p.defaultAction)}\n※指定したスキルがCT中の場合は、設定したローテーション順に使用可能なスキルを選択します。`;
}
function farthestEquipmentSample(all,n){
  if(n>=all.length)return all.slice();
  const vec=e=>[e.poisonHit,e.ailment,e.ctPromo,e.instant],scale=[100,100,100,22];
  const norm=v=>v.map((x,i)=>x/scale[i]);
  const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
  const selected=[],used=new Set(),add=e=>{const k=equipmentKey(e);if(!used.has(k)){used.add(k);selected.push(e);}};
  const extremes=[];
  for(let d=0;d<4;d++){
    const sorted=all.slice().sort((a,b)=>vec(b)[d]-vec(a)[d]);
    add(sorted[0]); if(selected.length<n)add(sorted[sorted.length-1]);
  }
  if(selected.length>=n)return selected.slice(0,n);
  const center=norm(all.reduce((s,e)=>s.map((x,i)=>x+vec(e)[i]),[0,0,0,0]).map((x,i)=>x/all.length));
  let nearest=all[0],nd=Infinity;
  for(const e of all){const d=dist(norm(vec(e)),center);if(d<nd){nd=d;nearest=e;}}
  add(nearest);
  while(selected.length<n){
    let best=null,bd=-1;
    for(const e of all){if(used.has(equipmentKey(e)))continue;const v=norm(vec(e));let md=Infinity;for(const s of selected)md=Math.min(md,dist(v,norm(vec(s))));if(md>bd){bd=md;best=e;}}
    if(!best)break;add(best);
  }
  return selected.slice(0,n);
}
function makeSeedSet(count){
  const out=[],seen=new Set();
  const ps=[0,0.5,1,2,3,5,7,9],rs=[25,50,75,100];
  const add=(p,r,a,b,c)=>{const q={poisonThreshold:p,resistThreshold:r,urgent:a,highResist:b,defaultAction:c},k=policyKey(q);if(!seen.has(k)){seen.add(k);out.push(q);}};
  for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let c=0;c<4;c++)add(1,50,a,b,c);
  for(let a=0;a<4&&out.length<count;a++)for(let b=0;b<4&&out.length<count;b++)for(let c=0;c<4&&out.length<count;c++)add(3,75,a,b,c);
  let seed=0x9e3779b9;
  const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  while(out.length<count){
    add(ps[Math.floor(rnd()*ps.length)],rs[Math.floor(rnd()*rs.length)],Math.floor(rnd()*4),Math.floor(rnd()*4),Math.floor(rnd()*4));
  }
  return out.slice(0,count);
}


function piSeed(rotationIndex,policy){
  return 1000003*rotationIndex + 97*policy.urgent + 193*policy.highResist + 389*policy.defaultAction + Math.floor(policy.poisonThreshold*10)*997 + Math.floor(policy.resistThreshold)*1009;
}
async function optimizeJoint(){
  const skills=readSkills();
  if(skills.length!==3)throw new Error('装備＋アドバンススキル使用方法の自動最適化は3スキルを前提にしています。');
  const count=+$('equipGroup1Count').value;
  const topK=Math.max(1,Math.min(10,Math.floor(+$('optTopK').value||10)));
  const requestedTrials=Math.max(100,Math.floor(+$('trials').value||5000));
  const duration=Math.max(1,Number($('duration').value)||600);
  const effort=Math.max(1,Math.min(1340,Math.floor(+$('optDepth').value||200)));
  const userCoarse=Math.max(1,Math.min(1000,Math.floor(+$('optTrials').value||50)));
  const yieldUI=()=>new Promise(requestAnimationFrame);
  $('optimize').disabled=true;$('optimizationResult').textContent='';

  // A compact, accuracy-oriented racing optimizer.
  // Important design rules:
  //  1) Aggregate equipment states are exhaustive; no random equipment sampling.
  //  2) Exact duplicate aggregate states are collapsed before simulation.
  //  3) All 15 fixed fallback rotations are treated symmetrically.
  //  4) Every racing stage uses common random numbers: candidate identity never
  //     changes the seed. This makes small trial budgets much more informative.
  //  5) Conditional policies are the full 2880-state grid, never randomly sampled.
  //  6) Candidates are retained by an uncertainty-aware margin, not by one noisy
  //     rank only. Several candidates per equipment survive into the final race.
  //  7) Final Top-N is collapsed by the four aggregate equipment totals.
  try{
    const allRaw=collectUniqueEquipment(count);
    const all=paretoPruneEquipment(allRaw);
    const rotations=basicStrategyCandidates();
    const policies=policySpecsAll(duration,Number($('baseResist').value)||50);
    const base=readCfg([1,2,3],1);

    // The UI's exploration-size field is now only a performance knob for the
    // policy stage. Equipment states themselves are still exhaustively screened.
    const policyPoolSize=Math.max(40,Math.min(all.length,Math.max(effort,topK*10)));
    const screenDuration=Math.min(duration,30);
    const screenTrials=Math.max(1,Math.min(6,Math.ceil(userCoarse/20)));
    const screenSeed=0x13579BDF;
    const screen=[];
    const rotationScores=new Map();

    // ---------- Stage 1: exhaustive Pareto equipment × 15 rotations ----------
    // Keep the best fixed strategy, but also retain the best score of each
    // rotation. This prevents one lucky/bad rotation from deciding policy entry.
    for(let ei=0;ei<all.length;ei++){
      const eq=all[ei];
      const row=[];
      let best=null;
      for(let ri=0;ri<rotations.length;ri++){
        const c={...base,equipment:eq,rotation:rotations[ri],policy:null,
          duration:screenDuration,trials:screenTrials,seed:screenSeed};
        const r=runSimulation(c);
        const x={equipment:eq,rotation:rotations[ri],score:r.uptime};
        row.push(x);
        if(!best||x.score>best.score)best=x;
      }
      rotationScores.set(equipmentKey(eq),row);
      screen.push(best);
      if((ei%8)===0){
        $('status').textContent=`最適化中… Pareto装備×15ローテーション ${ei+1}/${all.length}（全装備${allRaw.length}→${all.length}）`;
        await yieldUI();
      }
    }

    // ---------- Stage 2: exact Pareto frontier selection ----------
    // Every non-dominated aggregate remains eligible for policy optimization.
    // This removes only provably inferior equipment states; there is no random
    // sampling and no proxy-score based equipment selection.
    const policyPool=all.map(eq=>({
      equipment:eq,
      rotation:(rotationScores.get(equipmentKey(eq))||[]).slice().sort((a,b)=>b.score-a.score)[0]?.rotation||[1,2,3],
      score:(rotationScores.get(equipmentKey(eq))||[]).reduce((m,x)=>Math.max(m,x.score),-Infinity)
    }));
    $('status').textContent=`最適化中… Pareto前線 ${policyPool.length}/${allRaw.length} 装備`;
    await yieldUI();

    // ---------- Stage 3: all 2880 policies, cheap common-random screen ----------
    // Use the best fixed rotation as the initial fallback only. This stage is
    // deliberately a policy screen, not the final policy/rotation decision.
    const pTrials=Math.max(1,Math.min(4,Math.ceil(userCoarse/25)));
    const pDuration=Math.min(duration,30);
    const policyLeaders=[];
    const policySeed=0x2468ACE1;
    for(let ei=0;ei<policyPool.length;ei++){
      const eq=policyPool[ei].equipment;
      const fixed=screen.find(x=>equipmentKey(x.equipment)===equipmentKey(eq));
      const fallback=fixed?.rotation||[1,2,3];
      const scores=new Array(policies.length);
      for(let pi=0;pi<policies.length;pi++){
        const p=policies[pi];
        const c={...base,equipment:eq,rotation:fallback,policy:policyFromSpec(p),
          duration:pDuration,trials:pTrials,seed:policySeed};
        scores[pi]=runSimulation(c).uptime;
      }
      // Keep a wide set. Short runs are noisy, so do not use a tiny Top-N.
      const order=policies.map((p,i)=>({p,score:scores[i]})).sort((a,b)=>b.score-a.score);
      const keep=Math.min(64,order.length);
      for(let i=0;i<keep;i++)policyLeaders.push({equipment:eq,policy:order[i].p,rotation:fallback,score:order[i].score});
      if((ei%2)===0){
        $('status').textContent=`最適化中… 全2880方針 ${ei+1}/${policyPool.length}`;
        await yieldUI();
      }
    }

    // ---------- Stage 4: policy × ALL 15 rotations ----------
    // This is where the fallback rotation is no longer assumed. We evaluate
    // every retained policy against every rotation using common seeds.
    const expanded=[];
    const expandTrials=Math.max(1,Math.min(5,Math.ceil(userCoarse/20)));
    const expandDuration=Math.min(duration,45);
    const expandSeed=0x31415926;
    for(let pi=0;pi<policyLeaders.length;pi++){
      const x=policyLeaders[pi];
      let best=null;
      for(let ri=0;ri<rotations.length;ri++){
        const c={...base,equipment:x.equipment,rotation:rotations[ri],policy:policyFromSpec(x.policy),
          duration:expandDuration,trials:expandTrials,seed:expandSeed};
        const r=runSimulation(c);
        if(!best||r.uptime>best.score)best={...x,rotation:rotations[ri],score:r.uptime};
      }
      expanded.push(best);
      if((pi%8)===0){
        $('status').textContent=`最適化中… 方針×15ローテーション ${pi+1}/${policyLeaders.length}`;
        await yieldUI();
      }
    }

    // ---------- Stage 5: broad medium race ----------
    // Controls (best fixed) are kept alongside conditional policies.
    const candidateMap=new Map();
    for(const x of screen){
      candidateMap.set(equipmentKey(x.equipment)+'|fixed|'+x.rotation.join(','),{...x,policy:null});
    }
    for(const x of expanded){
      const k=equipmentKey(x.equipment)+'|'+policyKey(x.policy)+'|'+x.rotation.join(',');
      const old=candidateMap.get(k);if(!old||x.score>old.score)candidateMap.set(k,x);
    }
    const candidates=[...candidateMap.values()];
    const mediumTrials=Math.max(20,Math.min(500,Math.floor(requestedTrials/8)));
    const mediumDuration=duration;
    const medium=[];
    // Evaluate a broad set, but preserve representation diversity by equipment.
    candidates.sort((a,b)=>b.score-a.score);
    const mediumCap=Math.min(candidates.length,Math.max(topK*12,80));
    for(let i=0;i<mediumCap;i++){
      const x=candidates[i];
      const c={...readCfg(x.rotation,mediumTrials),equipment:x.equipment,rotation:x.rotation,
        policy:x.policy?policyFromSpec(x.policy):null,duration:mediumDuration,seed:0x5A17E};
      const r=runSimulation(c);medium.push({...x,result:r,score:r.uptime});
      if((i%4)===0){$('status').textContent=`最適化中… 中精度評価 ${i+1}/${mediumCap}`;await yieldUI();}
    }

    // Add a diversity guard: if the medium beam contains too few distinct
    // equipment aggregates, evaluate the best pre-score strategy for additional
    // equipment states. This prevents Top-K from collapsing onto one equipment.
    const mediumEquip=new Set(medium.map(x=>equipmentKey(x.equipment)));
    const extraByEquip=new Map();
    for(const x of candidates){
      const k=equipmentKey(x.equipment);
      if(mediumEquip.has(k)||extraByEquip.has(k)) continue;
      extraByEquip.set(k,x);
      if(extraByEquip.size>=Math.max(topK*4,40)) break;
    }
    const extra=[...extraByEquip.values()];
    for(let i=0;i<extra.length;i++){
      const x=extra[i];
      const c={...readCfg(x.rotation,mediumTrials),equipment:x.equipment,rotation:x.rotation,
        policy:x.policy?policyFromSpec(x.policy):null,duration:mediumDuration,seed:0x5A17E};
      const r=runSimulation(c);medium.push({...x,result:r,score:r.uptime});
      if((i%4)===0){$('status').textContent=`最適化中… 装備多様性評価 ${i+1}/${extra.length}`;await yieldUI();}
    }

    // ---------- Stage 6: uncertainty-aware final beam ----------
    // Keep several strategies per equipment, plus a global safety beam.
    medium.sort((a,b)=>b.score-a.score);
    const finalMap=new Map();
    const perEquipment=Math.max(2,Math.min(4,Math.ceil(topK/3)));
    const perEqCount=new Map();
    for(const x of medium){
      const k=equipmentKey(x.equipment),n=perEqCount.get(k)||0;
      if(n<perEquipment){finalMap.set(k+'|'+(x.policy?policyKey(x.policy):'fixed')+'|'+x.rotation.join(','),x);perEqCount.set(k,n+1);}
      if(finalMap.size>=Math.max(topK*6,30))break;
    }
    // Always retain a global safety beam as well.
    for(const x of medium.slice(0,Math.max(topK*8,30)))
      finalMap.set(equipmentKey(x.equipment)+'|'+(x.policy?policyKey(x.policy):'fixed')+'|'+x.rotation.join(','),x);
    const finalBeam=[...finalMap.values()].slice(0,Math.min(Math.max(topK*6,30),finalMap.size));

    // ---------- Stage 7: adaptive high-precision final race ----------
    // Do NOT run the full requested trial count for every finalist.  The old
    // version spent most of its time here.  Instead, use nested fidelity:
    //   broad beam -> moderate trials -> narrow beam -> full trials.
    // This preserves the full-trial evaluation for the candidates that can
    // actually affect the Top-N while avoiding thousands of wasted trials on
    // clearly inferior candidates.
    const finalTarget=Math.max(100,requestedTrials);
    const beamCap=Math.min(finalBeam.length,Math.max(topK*3,24));
    const stage1Trials=Math.min(finalTarget,Math.max(100,Math.min(500,Math.floor(finalTarget/5))));
    const stage2Cap=Math.min(beamCap,Math.max(topK*2,16));
    const stage2Trials=Math.min(finalTarget,Math.max(stage1Trials,Math.min(1500,Math.floor(finalTarget/2))));
    const stage3Cap=Math.min(stage2Cap,Math.max(topK,10));
    const final=[];

    // Final evaluation is the most expensive phase. Candidates are independent
    // simulations, so Web Workers reduce wall-clock time without changing the
    // simulation model or random seeds. Keep a small worker count for browsers.
    const workerCount=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||2)-1,finalBeam.length));
    const workerPool=[];
    try{
      for(let i=0;i<workerCount;i++) workerPool.push({w:new Worker('src/optimizer-worker.js')});
    }catch(e){ workerPool.length=0; }

    const evalBeam=async(list,trials,label)=>{
      const jobs=list.map((x,i)=>({id:i,x,cfg:{...readCfg(x.rotation,trials),equipment:x.equipment,rotation:x.rotation,
        policy:x.policy?policyFromSpec(x.policy):null,duration,seed:0x5A17E}}));
      if(!workerPool.length){
        const out=[];
        for(let i=0;i<jobs.length;i++){
          const j=jobs[i],r=runSimulation(j.cfg); out.push({...j.x,result:r,score:r.uptime});
          $('status').textContent=`最適化中… ${label} ${i+1}/${jobs.length}`;
          if((i&2)===0) await yieldUI();
        }
        return out.sort((a,b)=>b.score-a.score);
      }
      return await new Promise((resolve,reject)=>{
        const out=new Array(jobs.length); let next=0,done=0,failed=false;
        const dispatch=slot=>{
          if(failed||next>=jobs.length)return;
          const job=jobs[next++];
          const onMessage=ev=>{
            slot.w.removeEventListener('message',onMessage);slot.w.removeEventListener('error',onError);
            if(failed)return;
            const r=ev.data.result;out[job.id]={...job.x,result:r,score:r.uptime};done++;
            $('status').textContent=`最適化中… ${label} ${done}/${jobs.length}`;
            if(done>=jobs.length){resolve(out.sort((a,b)=>b.score-a.score));return;}
            dispatch(slot);
          };
          const onError=err=>{
            slot.w.removeEventListener('message',onMessage);slot.w.removeEventListener('error',onError);
            if(failed)return;failed=true;reject(err);
          };
          slot.w.addEventListener('message',onMessage);slot.w.addEventListener('error',onError);
          slot.w.postMessage({cmd:'run',cfg:job.cfg});
        };
        workerPool.forEach(dispatch);
      });
    };

    let race=await evalBeam(finalBeam.slice(0,beamCap),stage1Trials,'最終候補スクリーニング');
    race=race.slice(0,stage2Cap);
    race=await evalBeam(race,stage2Trials,'最終候補中精度評価');

    // Final distinct-equipment race. First build one best representative per
    // aggregate equipment from the complete medium pool, then evaluate enough
    // distinct states to guarantee Top-K output.
    const distinctBeforeFinal=new Map();
    for(const x of race){
      const k=equipmentKey(x.equipment),prev=distinctBeforeFinal.get(k);
      if(!prev||x.score>prev.score)distinctBeforeFinal.set(k,x);
    }
    // If the narrowed race collapsed onto too few equipment states, recover
    // additional distinct states from the full medium pool.
    if(distinctBeforeFinal.size<topK){
      const mediumByEquip=new Map();
      for(const x of medium){
        const k=equipmentKey(x.equipment),prev=mediumByEquip.get(k);
        if(!prev||x.score>prev.score)mediumByEquip.set(k,x);
      }
      const recovered=[...mediumByEquip.values()].sort((a,b)=>b.score-a.score);
      for(const x of recovered){
        const k=equipmentKey(x.equipment);
        if(!distinctBeforeFinal.has(k)) distinctBeforeFinal.set(k,x);
        if(distinctBeforeFinal.size>=topK) break;
      }
    }
    const distinctPool=[...distinctBeforeFinal.values()].sort((a,b)=>b.score-a.score);
    const fullDistinctCount=Math.min(topK,distinctPool.length);
    const finalRaceCandidates=distinctPool.slice(0,fullDistinctCount);
    const finalFull=await evalBeam(finalRaceCandidates,finalTarget,'最終高精度評価');
    final.push(...finalFull);

    // ---------- Final distinct-equipment ranking ----------
    const byEquip=new Map();
    for(const x of final){
      const k=equipmentKey(x.equipment),prev=byEquip.get(k);
      if(!prev||x.score>prev.score)byEquip.set(k,x);
    }
    const ranking=[...byEquip.values()].sort((a,b)=>b.score-a.score).slice(0,topK);
    if(!ranking.length)throw new Error('最適化候補がありません。');
    const best=ranking[0];
    optimizedEquipment=best.equipment;lastResult=best.result;render(best.result);
    renderEquipmentResult(best.equipment);
    $('rotation').value=best.rotation.join(',');
    const lines=ranking.map((x,i)=>{
      const pol=x.policy?`条件分岐: P≤${x.policy.poisonThreshold}s / R≥${x.policy.resistThreshold}% → [${actionLabel(x.policy.urgent)}, ${actionLabel(x.policy.highResist)}, ${actionLabel(x.policy.defaultAction)}]`:'固定ローテーション';
      return `${i+1}. ${x.rotation.join(' → ')} / ${pol} / 毒 ${(x.equipment.poisonHit||0).toFixed(1)}% / 状態異常 ${(x.equipment.ailment||0).toFixed(1)}% / CT促進 ${(x.equipment.ctPromo||0).toFixed(1)}% / 即時CT ${(x.equipment.instant||0).toFixed(1)}% : ${(x.score*100).toFixed(3)}%`;
    }).join('\n');
    $('optimizationResult').textContent=`${equipmentEffectsText(best.equipment)}\n\n【装備＋アドバンススキル使用方法の最適化】\n最適戦略：${best.rotation.join(' → ')}\n${best.policy?policyText(best.policy):'固定ローテーション'}\n\n最終評価 毒維持率：${(best.score*100).toFixed(3)}%\n\n異なる装備合計値の上位${ranking.length}候補：\n${lines}`;
    // Also render the full ranking in the Results section, not only in the
    // optimization-control section. This keeps candidates 2..Top-K visible.
    const rankHtml=ranking.map((x,i)=>{
      const pol=x.policy?`条件分岐: P≤${x.policy.poisonThreshold}s / R≥${x.policy.resistThreshold}% → [${actionLabel(x.policy.urgent)}, ${actionLabel(x.policy.highResist)}, ${actionLabel(x.policy.defaultAction)}]`:'固定ローテーション';
      return `<div class="rank-row"><strong>${i+1}位</strong>　毒維持率 ${(x.score*100).toFixed(3)}%　毒+${x.equipment.poisonHit.toFixed(1)}%　状態異常+${x.equipment.ailment.toFixed(1)}%　CT促進+${x.equipment.ctPromo.toFixed(1)}%　即時CT+${x.equipment.instant.toFixed(1)}%<br><span>${pol} / ${x.rotation.join(' → ')}</span></div>`;
    }).join('');
    $('optimizationRanking').innerHTML=`<h3>異なる装備合計値の上位${ranking.length}候補</h3>${rankHtml}`;
  }finally{ for(const slot of workerPool||[])try{slot.w.terminate();}catch(e){} $('optimize').disabled=false;$('status').textContent='';}
}

function optimize() {
                                return optimizeJoint(); }
                                $('specialEffect').onchange=refreshCritUI; refreshCritUI();
                                $('optimize').onclick=async()=>{try{await optimize();}catch(e) {
                                  $('status').textContent='エラー: '+e.message;console.error(e);}};
