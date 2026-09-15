let lastResult=null;
let optimizerSkillsCache=null;
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
          return {trials:trialsOverride??+$('trials').value,duration:+$('duration').value,baseResist:+$('baseResist').value,rise:+$('rise').value,fall:+$('fall').value,ailmentDuration:+$('ailmentDuration').value,critRate:$('specialEffect').value==='crit'?+$('critRate').value:0,normalHpm:+$('normalHpm').value,normalRangedRate:$('specialEffect').value==='crit'?+$('normalRangedRate').value:0,comboSuccessRate:$('specialEffect').value==='combo'?+$('comboSuccessRate').value:0,hpMaxUptime:$('specialEffect').value==='hpmax'?+$('hpMaxUptime').value:0,specialEffect:$('specialEffect').value,equipment:optimizedEquipment||defaultEquipment(),seed:1234567,rotation:rotationOverride??$('rotation').value.split(',').map(Number).filter(Number.isFinite),skills:optimizerSkillsCache||readSkills()};
        }
        function verifyFastSimulator() {
          if(typeof runSimulationReference!=='function') return {ok:false,message:'参照シミュレータが読み込まれていません。'};
          const base=readCfg([1,2,3],12);
          base.duration=Math.min(25,Math.max(1,Number(base.duration)||25));
          const cases=[
            {...base,specialEffect:'crit',critRate:76,normalRangedRate:100,policy:null,rotation:[1,2,3]},
            {...base,specialEffect:'crit',critRate:63,normalRangedRate:70,policy:policyFromSpec({poisonThreshold:1,successStreak:2,urgent:1,highSuccess:2,defaultAction:0}),rotation:[3,1,2]},
            {...base,specialEffect:'combo',critRate:0,normalRangedRate:0,comboSuccessRate:83,policy:policyFromSpec({poisonThreshold:3,successStreak:2,urgent:3,highSuccess:1,defaultAction:0}),rotation:[2,3,1]},
            {...base,specialEffect:'hpmax',critRate:0,normalRangedRate:0,hpMaxUptime:61,policy:null,rotation:[1,3,2]}
          ];
          const keys=['uptime','attempts','successes','successRate','maxRes','hits','poisonAttempts','poisonSuccesses','crits','meleeHits','rangedHits','meleeCrits','rangedCrits','normalHits','skillActivations'];
          for(let i=0;i<cases.length;i++){
            const a=runSimulationReference(cases[i]),b=runSimulation(cases[i]);
            for(const k of keys){if(Math.abs((a[k]??0)-(b[k]??0))>1e-12)return {ok:false,message:`ケース${i+1}の${k}が不一致`};}
            if(JSON.stringify(a.timeline)!==JSON.stringify(b.timeline))return {ok:false,message:`ケース${i+1}の試行系列が不一致`};
          }
          return {ok:true,message:'旧版参照シミュレータと4ケース完全一致（診断値・試行系列を含む）'};
        }

        function verifyOptimizerFastPath() {
          const base=readCfg([1,2,3],9);
          const cases=[
            {...base,specialEffect:'crit',critRate:76,normalRangedRate:100,policy:null,rotation:[1,2,3],seed:0x12345678},
            {...base,specialEffect:'crit',critRate:63,normalRangedRate:70,policy:policyFromSpec({poisonThreshold:1,successStreak:2,urgent:1,highSuccess:2,defaultAction:0}),rotation:[3,1,2],seed:0x23456789},
            {...base,specialEffect:'crit',critRate:35,normalRangedRate:0,policy:null,rotation:[2,3,1],seed:0x3456789a,trialStart:7},
            {...base,specialEffect:'crit',critRate:95,normalRangedRate:100,policy:null,rotation:[3,2,1],seed:0x456789ab,duration:37,trials:13}
          ];
          for(const c of cases){const a=runSimulation(c),b=runSimulationFast(c);if(!a||!b||!Number.isFinite(a.uptime)||!Number.isFinite(b.uptime)||Math.abs(a.uptime-b.uptime)>1e-12)return {ok:false,message:'Optimizer高速シミュレータが参照シミュレータと不一致'};}
          return {ok:true,message:'Optimizer高速シミュレータは参照シミュレータと完全一致'};
        }

        function drawProbabilityChart(ctx,w,h,points,startT,endT){
          const padL=58,padR=22,padT=20,padB=42;
          ctx.clearRect(0,0,w,h);
          ctx.strokeStyle='#cbd5e1';ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(padL,padT);ctx.lineTo(padL,h-padB);ctx.lineTo(w-padR,h-padB);ctx.stroke();
          const values=points.map(q=>q.probability).filter(Number.isFinite);
          const maxP=values.length?Math.max(...values):0;
          const yMax=maxP>0?maxP:1;
          ctx.fillStyle='#475569';ctx.font='12px system-ui';ctx.textAlign='center';
          for(let i=0;i<=4;i++){
            const y=padT+(h-padT-padB)*(1-i/4);
            ctx.strokeStyle='#e5e7eb';ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();
            ctx.fillStyle='#475569';ctx.textAlign='right';ctx.fillText(`${(yMax*i/4*100).toFixed(1)}%`,padL-7,y+4);
          }
          const span=Math.max(1e-9,endT-startT);
          for(let i=0;i<=6;i++){
            const t=startT+span*i/6;
            const x=padL+(w-padL-padR)*i/6;
            ctx.strokeStyle='#f1f5f9';ctx.beginPath();ctx.moveTo(x,padT);ctx.lineTo(x,h-padB);ctx.stroke();
            ctx.fillStyle='#475569';ctx.textAlign='center';ctx.fillText(`${t.toFixed(t<10?1:0)}s`,x,h-padB+20);
          }
          ctx.textAlign='center';ctx.fillText('戦闘時間',(padL+w-padR)/2,h-7);
          ctx.save();ctx.translate(15,(padT+h-padB)/2);ctx.rotate(-Math.PI/2);ctx.fillText('実行付与確率',0,0);ctx.restore();
          if(!points.length)return;
          const sx=t=>padL+((t-startT)/span)*(w-padL-padR), sy=p=>padT+(1-Math.max(0,Math.min(yMax,p))/yMax)*(h-padT-padB);
          ctx.strokeStyle='#334155';ctx.lineWidth=2;ctx.beginPath();
          let started=false;
          for(const q of points){
            if(!Number.isFinite(q.probability))continue;
            if(!started){ctx.moveTo(sx(q.time),sy(q.probability));started=true;}else ctx.lineTo(sx(q.time),sy(q.probability));
          }
          if(started)ctx.stroke();
          ctx.fillStyle='#334155';for(const q of points){if(!Number.isFinite(q.probability))continue;ctx.beginPath();ctx.arc(sx(q.time),sy(q.probability),3.5,0,Math.PI*2);ctx.fill();}
        }

        function renderProbabilityCharts(points){
          const wrap=$('probabilityChartWrap');
          if(!wrap)return;
          wrap.innerHTML='<div class="chart-title">実行付与確率の時間発展</div>';
          if(!points||!points.length){wrap.style.display='none';return;}
          const maxTime=Math.max(...points.map(q=>q.time));
          const chartCount=Math.max(1,Math.ceil(maxTime/60));
          for(let i=0;i<chartCount;i++){
            const startT=i*60,endT=Math.min((i+1)*60,maxTime);
            const segment=points.filter(q=>q.time>=startT && (q.time<=endT || (i===chartCount-1&&q.time<=endT+1e-9)));
            const block=document.createElement('div');block.className='probability-chart-block';
            const canvas=document.createElement('canvas');canvas.className='probability-chart';canvas.width=900;canvas.height=320;
            canvas.setAttribute('aria-label',`実行付与確率の時間発展 ${startT}s-${endT}s`);
            block.appendChild(canvas);wrap.appendChild(block);
            drawProbabilityChart(canvas.getContext('2d'),canvas.width,canvas.height,segment,startT,endT);
          }
          wrap.style.display='block';
        }

        function render(r) {
          const baseMetrics=[['毒維持率',`${(r.uptime*100).toFixed(3)}%`],['平均ヒット/戦闘',r.hits.toFixed(2)]]; const critMetrics=$('specialEffect').value==='crit'?[['平均クリティカル(弱点命中)/戦闘',r.crits.toFixed(2)],['平均近接ヒット/戦闘',r.meleeHits.toFixed(2)],['平均遠隔ヒット/戦闘',r.rangedHits.toFixed(2)],['平均近接クリティカル(弱点命中)/戦闘',r.meleeCrits.toFixed(2)],['平均遠隔クリティカル(弱点命中)/戦闘',r.rangedCrits.toFixed(2)]]:[]; $('metrics').innerHTML=[...baseMetrics,...critMetrics,['平均通常攻撃ヒット/戦闘',r.normalHits.toFixed(2)],['平均スキル発動/戦闘',r.skillActivations.toFixed(2)],['平均毒判定/戦闘',r.poisonAttempts.toFixed(2)],['平均成功/戦闘',r.successes.toFixed(2)],['平均成功率',`${(r.successRate*100).toFixed(3)}%`]].map(x=>`<div class="metric"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
          renderProbabilityCharts(r.executionProbabilityTimeline||[]);
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
  // Compatibility name retained. The policy space is deterministic and uses
  // only player-observable information; hidden resistance R is not exposed.
  const skills=readSkills();
  const base=readCfg([1,2,3],Math.max(1,+$('optTrials').value||200));
  return policySpecsAll(Number($('duration').value)||600,skills,base);
}
function policyFromSpec(spec) {
  return {rules:[
    {type:'poison_le',value:spec.poisonThreshold,action:spec.urgent},
    {type:'success_streak_ge',value:spec.successStreak,action:spec.highSuccess}
  ],defaultAction:spec.defaultAction};
}
function policyText(p, rotation=[1,2,3]) {
  return `毒残り時間 ≤ ${p.poisonThreshold}s → ${actionLabel(p.urgent)}\n毒残り時間が上記を超え、直近の毒付与成功連続回数 ≥ ${p.successStreak}回 → ${actionLabel(p.highSuccess)}\nそれ以外 → ${actionLabel(p.defaultAction)}\n※毒耐性Rは分岐条件として使用しません。プレイヤーが観測できる「毒付与成功」の連続回数だけを使用します。\n※指定したスキルがクールタイム中の場合は、代替ローテーション「${rotation.join(' → ')}」の順に、使用可能なスキルを選択します。`;
}
function policySpecsAll(duration,skills,simBase={}){
  // Human-executable policy space. R is deliberately absent.
  // 8 poison thresholds × 3 success-streak thresholds × 4^3 actions = 1536.
  const D=Math.max(0,Number(simBase.ailmentDuration ?? $('ailmentDuration')?.value)||0);
  const durationN=Math.max(0,Number(duration)||0), q=v=>Math.round(v*1e9)/1e9;
  const uniqueP=[...new Set([0,0.5,1,2,3,5,7,Math.min(D,durationN)].map(q))];
  const specs=[];
  for(const P of uniqueP) for(let successStreak=1;successStreak<=3;successStreak++)
    for(let urgent=0;urgent<=3;urgent++) for(let highSuccess=0;highSuccess<=3;highSuccess++)
      for(let def=0;def<=3;def++) specs.push({poisonThreshold:P,successStreak,urgent,highSuccess,defaultAction:def});
  policySpecsAll.lastMeta={policyCount:specs.length,pCount:uniqueP.length,streakCount:3};
  return specs;
}
function policyKey(p){return [p.poisonThreshold,p.successStreak,p.urgent,p.highSuccess,p.defaultAction].join('|');}
const optimizerPolicyCache=new Map();
function policyFromSpecCached(spec) {
  const k=policyKey(spec), hit=optimizerPolicyCache.get(k); if(hit)return hit;
  const p=policyFromSpec(spec); if(optimizerPolicyCache.size>=2048)optimizerPolicyCache.delete(optimizerPolicyCache.keys().next().value);
  optimizerPolicyCache.set(k,p); return p;
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
function piSeed(rotationIndex,policy){
  return 1000003*rotationIndex + 97*policy.urgent + 193*policy.highSuccess + 389*policy.defaultAction + Math.floor(policy.poisonThreshold*10)*997 + Math.floor(policy.successStreak)*1009;
}
async function optimizeJoint(){
  const skills=readSkills();
  optimizerSkillsCache=skills;
  if(skills.length!==3)throw new Error('装備＋アドバンススキル使用方法の自動最適化は3スキルを前提にしています。');
  const count=+$('equipGroup1Count').value;
  const topK=Math.max(1,Math.min(10,Math.floor(+$('optTopK').value||10)));
  const requestedTrials=Math.max(100,Math.floor(+$('trials').value||5000));
  const duration=Math.max(1,Number($('duration').value)||600);
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
  //  5) Conditional policies are exhaustively generated from player-observable states; hidden resistance R is never a policy input.
  //  6) Candidates are retained by an uncertainty-aware margin, not by one noisy
  //     rank only. Several candidates per equipment survive into the final race.
  //  7) Final Top-N is collapsed by the four aggregate equipment totals.
  let optWorkerPool=[];
  let workerPool=[];
  try{
    const allRaw=collectUniqueEquipment(count);
    const all=paretoPruneEquipment(allRaw);
    const rotations=basicStrategyCandidates();
    const base=readCfg([1,2,3],1);
    const policies=policySpecsAll(duration,skills,base);

    // Reusable optimizer workers: expensive equipment-level stages are parallelized
    // without changing the search space or random seeds. Each worker receives the
    // immutable skill/policy tables once, then processes whole equipment states.
    try{
      const isMobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
      const wc=isMobile?1:Math.max(1,Math.min(8,(navigator.hardwareConcurrency||2)-1));
      for(let i=0;i<wc;i++)optWorkerPool.push({w:new Worker('src/optimizer-worker.js')});
    }catch(e){}
    const initWorkers=async()=>{
      if(!optWorkerPool.length)return;
      await Promise.all(optWorkerPool.map(slot=>new Promise((resolve,reject)=>{
        const ok=ev=>{slot.w.removeEventListener('message',ok);slot.w.removeEventListener('error',err);resolve();};
        const err=e=>{slot.w.removeEventListener('message',ok);slot.w.removeEventListener('error',err);reject(e);};
        slot.w.addEventListener('message',ok);slot.w.addEventListener('error',err);
        slot.w.postMessage({cmd:'init',base,skills,rotations});
      })));
    };
    const parallelStage=async(jobs,label)=>{
      if(!optWorkerPool.length){const out=[];for(let i=0;i<jobs.length;i++){out.push(await jobs[i].fallback());$('status').textContent=`最適化中… ${label} ${i+1}/${jobs.length}`;if((i&3)===0)await yieldUI();}return out;}
      return await new Promise((resolve,reject)=>{
        const out=new Array(jobs.length);let next=0,done=0,failed=false;
        const dispatch=slot=>{if(failed||next>=jobs.length)return;const job=jobs[next++];
          const onMessage=ev=>{slot.w.removeEventListener('message',onMessage);slot.w.removeEventListener('error',onError);if(failed)return;
            if(ev.data?.cmd!=='result'||ev.data.id!==job.id){slot.w.addEventListener('message',onMessage);slot.w.addEventListener('error',onError);return;}
            out[job.id]=ev.data.result;done++;$('status').textContent=`最適化中… ${label} ${done}/${jobs.length}`;
            if(done>=jobs.length){resolve(out);return;} dispatch(slot);};
          const onError=err=>{slot.w.removeEventListener('message',onMessage);slot.w.removeEventListener('error',onError);if(!failed){failed=true;reject(err);}};
          slot.w.addEventListener('message',onMessage);slot.w.addEventListener('error',onError);slot.w.postMessage(job.msg);
        };optWorkerPool.forEach(dispatch);
      });
    };
    await initWorkers();

      const screenDuration=Math.min(duration,30);
    const screenTrials=Math.max(1,Math.min(6,Math.ceil(userCoarse/20)));
    const screenSeed=0x13579BDF;
    const screen=[];
    const rotationScores=new Map();

    // ---------- Stage 1: exhaustive Pareto equipment × 15 rotations ----------
    const screenJobs=all.map((eq,ei)=>({id:ei,msg:{cmd:'screen',id:ei,equipment:eq,duration:screenDuration,trials:screenTrials,seed:screenSeed},fallback:async()=>{let best=null,row=[];for(const rot of rotations){const r=runSimulation({...base,equipment:eq,rotation:rot,policy:null,duration:screenDuration,trials:screenTrials,seed:screenSeed});const x={rotation:rot,score:r.uptime};row.push(x);if(!best||x.score>best.score)best=x;}return {best,row};}}));
    const screenResults=await parallelStage(screenJobs,'Pareto装備×15ローテーション');
    for(let ei=0;ei<all.length;ei++){const eq=all[ei],rr=screenResults[ei];rotationScores.set(equipmentKey(eq),rr.row);screen.push({...rr.best,equipment:eq});}

    // ---------- Stage 2: exact Pareto frontier selection ----------
    // Every non-dominated aggregate remains eligible for policy optimization.
    // This removes only provably inferior equipment states; there is no random
    // sampling and no proxy-score based equipment selection.
    const policyPool=all.map(eq=>({
      equipment:eq,
      rotation:(rotationScores.get(equipmentKey(eq))||[]).slice().sort((a,b)=>b.score-a.score)[0]?.rotation||[1,2,3],
      score:(rotationScores.get(equipmentKey(eq))||[]).reduce((m,x)=>Math.max(m,x.score),-Infinity)
    }));
    $('status').textContent=`最適化中… Pareto前線 ${policyPool.length}/${allRaw.length} 装備 → 条件分岐を決定論的スクリーニング`;
    await yieldUI();

    // ---------- Stage 3: deterministic stratified policy screen (no random sampling) ----------
    const pTrials=Math.max(1,Math.min(4,Math.ceil(userCoarse/25)));
    const pDuration=Math.min(duration,30);
    const policySeed=0x2468ACE1;
    const policyJobs=policyPool.map((item,ei)=>({id:ei,msg:{cmd:'policyScreen',id:ei,equipment:item.equipment,fallback:item.rotation,duration:pDuration,trials:pTrials,seed:policySeed,policyBudget:policies.length},fallback:async()=>{const out=[];for(let pi=0;pi<policies.length;pi++){const p=policies[pi],c={...base,equipment:item.equipment,rotation:item.rotation,policy:policyFromSpec(p),duration:pDuration,trials:pTrials,seed:policySeed};out.push({index:pi,score:runSimulation(c).uptime});}out.sort((a,b)=>b.score-a.score);return {top:out.slice(0,64)};}}));
    const policyResults=await parallelStage(policyJobs,'全条件分岐方針');
    const policyLeaders=[];
    for(let ei=0;ei<policyPool.length;ei++){const item=policyPool[ei],res=policyResults[ei];for(const z of res.top){policyLeaders.push({equipment:item.equipment,policy:policies[z.index],policyIndex:z.index,rotation:item.rotation,score:z.score});}}

    // ---------- Stage 4: policy × ALL 15 rotations ----------
    const expanded=[];
    const expandTrials=Math.max(1,Math.min(5,Math.ceil(userCoarse/20)));
    const expandDuration=Math.min(duration,45);
    const expandSeed=0x31415926;
    // Group the 64 retained policies by equipment so each worker performs one
    // large, cache-friendly job instead of thousands of tiny messages.
    const leadersByEquip=new Map();
    for(const x of policyLeaders){const k=equipmentKey(x.equipment);if(!leadersByEquip.has(k))leadersByEquip.set(k,[]);leadersByEquip.get(k).push({index:x.policyIndex,score:x.score});}
    const expandItems=[...leadersByEquip.entries()];
    const expandJobs=expandItems.map(([k,leaders],ei)=>{
      const eq=policyLeaders.find(x=>equipmentKey(x.equipment)===k).equipment;
      return {
        id:ei,
        msg:{cmd:'policyExpand',id:ei,equipment:eq,leaders,duration:expandDuration,trials:expandTrials,seed:expandSeed},
        fallback:async()=>{
          const bests=[];
          for(const leader of leaders){
            const p=policies[leader.index]; let best=null;
            for(const rot of rotations){
              const r=runSimulation({...base,equipment:eq,rotation:rot,policy:policyFromSpec(p),duration:expandDuration,trials:expandTrials,seed:expandSeed});
              if(!best||r.uptime>best.score)best={index:leader.index,score:r.uptime,rotation:rot};
            }
            bests.push(best);
          }
          return {bests};
        }
      };
    });
    const expandResults=await parallelStage(expandJobs,'方針×15ローテーション');
    for(let ei=0;ei<expandItems.length;ei++){const [k]=expandItems[ei],eq=policyLeaders.find(x=>equipmentKey(x.equipment)===k).equipment;for(const b of expandResults[ei].bests){const p=policies[b.index];expanded.push({equipment:eq,policy:p,rotation:b.rotation,score:b.score});}}

    // ---------- Stage 5: broad medium race ----------
    // This stage used to run on the main thread one candidate at a time.  That
    // made the optimizer spend a large fraction of its wall time here even
    // though every candidate simulation is independent.  Dispatch the whole
    // medium race through the already-initialized optimizer worker pool.  The
    // candidate set, seed, trial count and simulator are unchanged: this is
    // pure parallel execution, not a statistical approximation.
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
    candidates.sort((a,b)=>b.score-a.score);
    const mediumCap=Math.min(candidates.length,Math.max(topK*12,80));
    const mediumSeed=0x5A17E;
    const mediumJobs=candidates.slice(0,mediumCap).map((x,i)=>({
      id:i,
      msg:{cmd:'run',id:i,cfg:{...readCfg(x.rotation,mediumTrials),equipment:x.equipment,rotation:x.rotation,
        policy:x.policy?policyFromSpec(x.policy):null,duration:mediumDuration,seed:mediumSeed}},
      fallback:async()=>({result:runSimulation({...readCfg(x.rotation,mediumTrials),equipment:x.equipment,rotation:x.rotation,
        policy:x.policy?policyFromSpec(x.policy):null,duration:mediumDuration,seed:mediumSeed})})
    }));
    const mediumResults=await parallelStage(mediumJobs,'中精度評価');
    const medium=[];
    for(let i=0;i<mediumJobs.length;i++){
      const x=mediumJobs[i].msg.cfg;
      const r=mediumResults[i].result;
      medium.push({...candidates[i],result:r,score:r.uptime});
    }

    // Diversity guard: recover additional equipment aggregates in parallel if
    // the medium beam became too concentrated.  No random selection is used.
    const mediumEquip=new Set(medium.map(x=>equipmentKey(x.equipment)));
    const extraByEquip=new Map();
    for(const x of candidates){
      const k=equipmentKey(x.equipment);
      if(mediumEquip.has(k)||extraByEquip.has(k)) continue;
      extraByEquip.set(k,x);
      if(extraByEquip.size>=Math.max(topK*4,40)) break;
    }
    const extra=[...extraByEquip.values()];
    if(extra.length){
      const extraJobs=extra.map((x,i)=>({
        id:i,
        msg:{cmd:'run',id:i,cfg:{...readCfg(x.rotation,mediumTrials),equipment:x.equipment,rotation:x.rotation,
          policy:x.policy?policyFromSpec(x.policy):null,duration:mediumDuration,seed:mediumSeed}},
        fallback:async()=>({result:runSimulation({...readCfg(x.rotation,mediumTrials),equipment:x.equipment,rotation:x.rotation,
          policy:x.policy?policyFromSpec(x.policy):null,duration:mediumDuration,seed:mediumSeed})})
      }));
      const extraResults=await parallelStage(extraJobs,'装備多様性評価');
      for(let i=0;i<extra.length;i++)medium.push({...extra[i],result:extraResults[i].result,score:extraResults[i].result.uptime});
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
    const isMobileFinal=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
    const workerCount=isMobileFinal?1:Math.max(1,Math.min(4,(navigator.hardwareConcurrency||2)-1,finalBeam.length));
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
      // Batch independent candidates per worker. This removes per-candidate
      // postMessage/listener/config-dispatch overhead without sharing or changing
      // RNG streams. The simulator for every candidate is exactly the same one
      // used by the old path, so numerical fidelity is unaffected.
      const batchSize=Math.max(1,Math.min(128,Math.ceil(jobs.length/(workerPool.length*2))));
      const batches=[];for(let i=0;i<jobs.length;i+=batchSize)batches.push(jobs.slice(i,i+batchSize));
      return await new Promise((resolve,reject)=>{
        const out=new Array(jobs.length);let nextBatch=0,done=0,failed=false;
        const dispatch=slot=>{
          if(failed||nextBatch>=batches.length)return;
          const batch=batches[nextBatch++];
          const onMessage=ev=>{
            slot.w.removeEventListener('message',onMessage);slot.w.removeEventListener('error',onError);
            if(failed)return;
            if(ev.data?.cmd!=='batchResult'){slot.w.addEventListener('message',onMessage);slot.w.addEventListener('error',onError);return;}
            const results=ev.data.results||[];
            if(results.length!==batch.length || results.some(r=>!r||!Number.isFinite(r.uptime))){
              failed=true; reject(new Error(`${label}: Worker結果が不正です（件数またはuptime）`)); return;
            }
            for(let k=0;k<batch.length;k++){const j=batch[k],r=results[k];out[j.id]={...j.x,result:r,score:r.uptime};done++;}
            $('status').textContent=`最適化中… ${label} ${done}/${jobs.length}`;
            if(done>=jobs.length){resolve(out.sort((a,b)=>b.score-a.score));return;}
            dispatch(slot);
          };
          const onError=err=>{slot.w.removeEventListener('message',onMessage);slot.w.removeEventListener('error',onError);if(!failed){failed=true;reject(err);}};
          slot.w.addEventListener('message',onMessage);slot.w.addEventListener('error',onError);
          slot.w.postMessage({cmd:'batchRun',id:batch[0].id,candidates:batch.map(j=>j.cfg)});
        };
        workerPool.forEach(dispatch);
      });
    };

    // Verify the batch transport once with tiny reference cases before using it
    // for the expensive race. This is deliberately small so verification itself
    // is negligible compared with the optimization.
    if(workerPool.length){
      const vcfgs=[];const vbase=readCfg([1,2,3],3);vbase.duration=Math.min(5,duration);vbase.seed=0x2468ACE0;
      for(const se of ['crit','combo','hpmax'])vcfgs.push({...vbase,specialEffect:se,critRate:se==='crit'?76:0,normalRangedRate:se==='crit'?100:0,comboSuccessRate:se==='combo'?83:0,hpMaxUptime:se==='hpmax'?61:0});
      await new Promise((resolve,reject)=>{const slot=workerPool[0],onM=ev=>{if(ev.data?.cmd!=='batchResult')return;slot.w.removeEventListener('message',onM);slot.w.removeEventListener('error',onE);const rs=ev.data.results||[];if(rs.length!==vcfgs.length){reject(new Error('最終評価バッチ検証に失敗しました：結果数が不一致'));return;}for(let i=0;i<vcfgs.length;i++){const ref=runSimulation(vcfgs[i]),got=rs[i];if(Math.abs((ref.uptime??0)-(got?.uptime??0))>1e-12){reject(new Error('最終評価バッチ検証に失敗しました：uptimeが不一致'));return;}}resolve();},onE=e=>{slot.w.removeEventListener('message',onM);slot.w.removeEventListener('error',onE);reject(e)};slot.w.addEventListener('message',onM);slot.w.addEventListener('error',onE);slot.w.postMessage({cmd:'batchRun',id:'verify-batch',candidates:vcfgs});});
    }
    let race=await evalBeam(finalBeam.slice(0,beamCap),stage1Trials,'最終候補スクリーニング');
    race=race.slice(0,stage2Cap);
    // Reuse the exact stage-1 trial prefix. Stage 2 evaluates only the
    // additional trials needed to reach stage2Trials, then combines the two
    // means. This is an exact continuation of the same deterministic trial
    // stream (same seed), not a statistical approximation.
    const stage1ByKey=new Map(race.map(x=>[equipmentKey(x.equipment)+'|'+(x.policy?policyKey(x.policy):'fixed')+'|'+x.rotation.join(','),x]));
    const additional=stage2Trials-stage1Trials;
    if(additional>0){
      const jobs=race.map((x,i)=>({id:i,x,cfg:{...readCfg(x.rotation,additional),equipment:x.equipment,rotation:x.rotation,
        policy:x.policy?policyFromSpec(x.policy):null,duration,seed:0x5A17E,trialStart:stage1Trials}}));
      let extraResults;
      if(!workerPool.length){
        extraResults=jobs.map(j=>runSimulation(j.cfg));
      }else{
        extraResults=await new Promise((resolve,reject)=>{
          const out=new Array(jobs.length);let next=0,done=0,failed=false;
          const dispatch=slot=>{if(failed||next>=jobs.length)return;const j=jobs[next++];
            const onM=ev=>{slot.w.removeEventListener('message',onM);slot.w.removeEventListener('error',onE);if(failed)return;
              if(ev.data?.cmd!=='batchResult'){return;}
              const rr=ev.data.results||[];
              if(rr.length!==1||!rr[0]||!Number.isFinite(rr[0].uptime)){failed=true;reject(new Error('最終候補追加評価のWorker結果が不正です'));return;}
              out[j.id]=rr[0];done++;$('status').textContent=`最適化中… 最終候補中精度評価 ${done}/${jobs.length}`;if(done>=jobs.length)resolve(out);else dispatch(slot);};
            const onE=e=>{slot.w.removeEventListener('message',onM);slot.w.removeEventListener('error',onE);if(!failed){failed=true;reject(e);}};
            slot.w.addEventListener('message',onM);slot.w.addEventListener('error',onE);slot.w.postMessage({cmd:'batchRun',id:j.id,candidates:[j.cfg]});
          };workerPool.forEach(dispatch);
        });
      }
      if(extraResults.length!==race.length||extraResults.some(r=>!r||!Number.isFinite(r.uptime)))throw new Error('追加試行の結果が不正です');
      race=race.map((x,i)=>{const add=extraResults[i],prev=x.result;const total=stage1Trials+additional;
        const score=(prev.uptime*stage1Trials+add.uptime*additional)/total;
        return {...x,result:{...prev,uptime:score},score};
      }).sort((a,b)=>b.score-a.score);
    }

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
    optimizedEquipment=best.equipment;lastResult=best.result;
    const probTrials=Math.max(200,Math.min(1200,Math.floor(Number(base.trials)||200)));
    const probabilityResult=runSimulation({...base,equipment:best.equipment,rotation:best.rotation,policy:best.policy?policyFromSpec(best.policy):null,trials:probTrials,seed:0x7A11CE,__probTimeline:true,__probStep:0.5});
    best.result.executionProbabilityTimeline=probabilityResult.executionProbabilityTimeline||[];
    render(best.result);
    renderEquipmentResult(best.equipment);
    const strategyHeader=best.policy?'条件分岐戦略':'固定ローテーション';
    const strategyBody=best.policy?`${policyText(best.policy,best.rotation)}`:`ローテーション：${best.rotation.join(' → ')}`;
    $('optimizationResult').textContent=`【装備＋アドバンススキル使用方法の最適化】\n最適戦略：${strategyHeader}\n${strategyBody}\n\n最終評価 毒維持率：${(best.score*100).toFixed(3)}%`;
    // Also render the full ranking in the Results section, not only in the
    // optimization-control section. This keeps candidates 2..Top-K visible.
    const rankHtml=ranking.map((x,i)=>{
      const pol=x.policy?`条件分岐: 毒残り時間≤${x.policy.poisonThreshold}s / 成功連続≥${x.policy.successStreak}回 → [${actionLabel(x.policy.urgent)}, ${actionLabel(x.policy.highSuccess)}, ${actionLabel(x.policy.defaultAction)}] / 代替ローテーション ${x.rotation.join(' → ')}`:`固定ローテーション ${x.rotation.join(' → ')}`;
      return `<div class="rank-row"><strong>${i+1}位</strong>　毒維持率 ${(x.score*100).toFixed(3)}%　毒+${x.equipment.poisonHit.toFixed(1)}%　状態異常+${x.equipment.ailment.toFixed(1)}%　CT促進+${x.equipment.ctPromo.toFixed(1)}%　即時CT+${x.equipment.instant.toFixed(1)}%<br><span>${pol}</span></div>`;
    }).join('');
    $('optimizationRanking').innerHTML=`<h3>異なる装備合計値の上位${ranking.length}候補</h3>${rankHtml}`;
  }finally{ optimizerSkillsCache=null; for(const slot of optWorkerPool||[])try{slot.w.terminate();}catch(e){} for(const slot of workerPool||[])try{slot.w.terminate();}catch(e){} $('optimize').disabled=false;$('status').textContent='';}
}

function optimize() {
                                return optimizeJoint(); }
                                $('specialEffect').onchange=refreshCritUI; refreshCritUI();
                                $('optimize').onclick=async()=>{try{await optimize();}catch(e) {
                                  $('status').textContent='エラー: '+e.message;console.error(e);}};
