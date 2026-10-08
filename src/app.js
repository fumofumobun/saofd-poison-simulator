let lastResult=null;
let optimizerSkillsCache=null;
// v27.72: keep the parsed/instantiated optimizer workers alive between runs.
// Re-initialization updates the immutable model, while avoiding repeated Worker
// script parsing and WASM instantiation on every click.
let optimizerWorkerPoolGlobal=[];
const optimizerValidationCache=new Map();
const $=id=>document.getElementById(id);
const __optimizerWasmModuleCache=new Map();
async function optimizerCompileWasmModule(url){
  if(__optimizerWasmModuleCache.has(url))return __optimizerWasmModuleCache.get(url);
  const task=(async()=>{try{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)return null;if(WebAssembly.compileStreaming&&r.clone){try{return await WebAssembly.compileStreaming(Promise.resolve(r.clone()));}catch(_e){}}return await WebAssembly.compile(await r.arrayBuffer());}catch(_e){return null;}})();
  __optimizerWasmModuleCache.set(url,task);return task;
}
// GitHub Pages: hide the tiny full-simulator compilation behind normal page use.
const __fullSimPrecompile=optimizerCompileWasmModule('wasm/full-sim8.wasm');

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
          return {trials:trialsOverride??+$('trials').value,duration:+$('duration').value,policySegments:+$('policySegments').value||4,baseResist:+$('baseResist').value,rise:+$('rise').value,fall:+$('fall').value,ailmentDuration:+$('ailmentDuration').value,critRate:$('specialEffect').value==='crit'?+$('critRate').value:0,normalHpm:+$('normalHpm').value,normalRangedRate:$('specialEffect').value==='crit'?+$('normalRangedRate').value:0,comboSuccessRate:$('specialEffect').value==='combo'?+$('comboSuccessRate').value:0,hpMaxUptime:$('specialEffect').value==='hpmax'?+$('hpMaxUptime').value:0,specialEffect:$('specialEffect').value,equipment:optimizedEquipment||defaultEquipment(),seed:1234567,rotation:rotationOverride??$('rotation').value.split(',').map(Number).filter(Number.isFinite),skills:optimizerSkillsCache||readSkills()};
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
          wrap.innerHTML='<div class="chart-title">実効付与確率期待値の時間発展</div>';
          if(!points||!points.length){wrap.style.display='none';return;}
          const maxTime=Math.max(...points.map(q=>q.time));
          const chartCount=Math.max(1,Math.ceil(maxTime/60));
          for(let i=0;i<chartCount;i++){
            const startT=i*60,endT=Math.min((i+1)*60,maxTime);
            const segment=points.filter(q=>q.time>=startT && (q.time<=endT || (i===chartCount-1&&q.time<=endT+1e-9)));
            const block=document.createElement('div');block.className='probability-chart-block';
            const canvas=document.createElement('canvas');canvas.className='probability-chart';canvas.width=900;canvas.height=320;
            canvas.setAttribute('aria-label',`実効付与確率期待値の時間発展 ${startT}s-${endT}s`);
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
  const actions=Array.isArray(spec.segmentActions)?spec.segmentActions.slice():[];
  return {segmentActions:actions,segmentCount:spec.segmentCount||actions.length,ailmentDuration:Number(spec.ailmentDuration ?? $('ailmentDuration')?.value ?? 0)};
}
function policyPriorityText(action, rotation=[1,2,3]) {
  const r=(Array.isArray(rotation)?rotation:[]).filter((v,i,a)=>Number.isInteger(v)&&v>=1&&v<=3&&a.indexOf(v)===i);
  if(Number(action)===0)return '通常攻撃（スキルは使用しない）';
  const pref=Number(action),rest=r.filter(x=>x!==pref);
  return [pref,...rest,0].map(actionLabel).join(' → ');
}
function rotationPriorityText(rotation=[1,2,3]) {
  const r=(Array.isArray(rotation)?rotation:[]).filter((v,i,a)=>Number.isInteger(v)&&v>=1&&v<=3&&a.indexOf(v)===i);
  const complete=[...r,...[1,2,3].filter(v=>!r.includes(v)),0];
  return complete.map(actionLabel).join(' → ');
}
function policyText(p, rotation=[1,2,3]) {
  const D=Math.max(0,Number(p.ailmentDuration ?? $('ailmentDuration')?.value ?? 0));
  const K=Math.max(2,Number(p.segmentCount)||p.segmentActions?.length||2),a=p.segmentActions||[];
  const rows=[];
  for(let i=0;i<K;i++){
    const lo=i===0?0:D*(i/K),hi=D*((i+1)/K),act=Number(a[i]??0);
    rows.push(`毒残り時間 ${lo===0?'0':lo.toFixed(2)}～${hi.toFixed(2)}s → 優先順位：${policyPriorityText(act,rotation)}`);
  }
  return rows.join('\n')+`\n※分岐条件はプレイヤーが観測できる「毒残り時間」のみです。\n※優先スキルがクールタイム中なら右側へ進み、最後は通常攻撃を使用します。`;
}
function policySpecsAll(duration,skills,simBase={}){
  const D=Math.max(0,Number(simBase.ailmentDuration ?? $('ailmentDuration')?.value)||0);
  const K=Math.max(2,Math.min(5,Math.floor(Number(simBase.policySegments ?? $('policySegments')?.value)||4)));
  const specs=[];
  const total=Math.pow(4,K);
  for(let n=0;n<total;n++){
    let x=n; const actions=new Array(K);
    for(let i=0;i<K;i++){actions[i]=x&3;x>>=2;}
    specs.push({segmentCount:K,segmentActions:actions,ailmentDuration:D});
  }
  policySpecsAll.lastMeta={policyCount:specs.length,segmentCount:K,actionCount:4};
  return specs;
}
function policyKey(p){return Array.isArray(p.segmentActions)?`K${p.segmentCount}|D${Number(p.ailmentDuration)||0}|${p.segmentActions.join(',')}`:[p.poisonThreshold,p.successStreak,p.urgent,p.highSuccess,p.defaultAction,Number(p.ailmentDuration)||0].join('|');}
const optimizerPolicyCache=new Map();
function policyFromSpecCached(spec) {
  const k=policyKey(spec), hit=optimizerPolicyCache.get(k); if(hit)return hit;
  const p=policyFromSpec(spec); if(optimizerPolicyCache.size>=2048)optimizerPolicyCache.delete(optimizerPolicyCache.keys().next().value);
  optimizerPolicyCache.set(k,p); return p;
}

function* enumerateEquipmentSlots(count) {
  // v27.72 exact multiset enumeration. Slot order inside g1/g2b does not
  // affect aggregate effects, so enumerate combinations-with-repetition
  // directly instead of producing 4,096/16,384 permutations and discarding
  // them in a Map afterwards. The set of aggregate equipment states is equal.
  const g1=EQUIP_OPTIONS.g1,g2a=EQUIP_OPTIONS.g2a,g2b=EQUIP_OPTIONS.g2b;
  if(count===3){
    for(let a=0;a<g1.length;a++)for(let b=a;b<g1.length;b++)for(let c=b;c<g1.length;c++)
      for(let x=0;x<g2a.length;x++)for(let y=0;y<g2b.length;y++)for(let z=y;z<g2b.length;z++)
        yield {g1:[g1[a],g1[b],g1[c]],g2a:g2a[x],g2b:[g2b[y],g2b[z]]};
  }else{
    for(let a=0;a<g1.length;a++)for(let b=a;b<g1.length;b++)for(let c=b;c<g1.length;c++)for(let d=c;d<g1.length;d++)
      for(let x=0;x<g2a.length;x++)for(let y=0;y<g2b.length;y++)for(let z=y;z<g2b.length;z++)
        yield {g1:[g1[a],g1[b],g1[c],g1[d]],g2a:g2a[x],g2b:[g2b[y],g2b[z]]};
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
  if(Array.isArray(policy.segmentActions)) return 1000003*rotationIndex + 997*policy.segmentCount + policy.segmentActions.reduce((s,a,i)=>s+(i+1)*97*(Number(a)||0),0); return 1000003*rotationIndex + 97*policy.urgent + 193*policy.highSuccess + 389*policy.defaultAction + Math.floor(policy.poisonThreshold*10)*997 + Math.floor(policy.successStreak)*1009;
}
async function optimizeJoint(){
  const skills=readSkills();
  optimizerSkillsCache=skills;
  // A previous optimization may have used a different ailment duration. Clear
  // the cross-run cache as a second guard against stale policy objects.
  optimizerPolicyCache.clear();
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
  //  5) Conditional policies use only player-observable poison remaining time, partitioned into 2-5 equal intervals.
  //  6) Candidates are retained by an uncertainty-aware margin, not by one noisy
  //     rank only. Several candidates per equipment survive into the final race.
  //  7) Final Top-N is collapsed by the four aggregate equipment totals.
  let optWorkerPool=optimizerWorkerPoolGlobal;
  let optimizerCaps=null;
  try{
    const allRaw=collectUniqueEquipment(count);
    const all=paretoPruneEquipment(allRaw);
    const rotations=basicStrategyCandidates();
    const base=readCfg([1,2,3],1);
    const policies=policySpecsAll(duration,skills,base);
    // v27.68 exact strategy de-duplication. For a policy segment the simulator
    // first tries the preferred action, then scans the fallback rotation. Two
    // policy×rotation pairs with identical effective priority lists in every
    // segment are behaviorally identical for every RNG stream and equipment.
    const effectivePriorityKey=(action,rot)=>{
      const a=Number(action)||0;if(a===0)return '0';
      const seq=[a];for(const x of (rot||[]))if(!seq.includes(x))seq.push(x);
      return seq.join('>');
    };
    const strategyMap=new Map();
    for(let pi=0;pi<policies.length;pi++)for(const rot of rotations){
      const sig=(policies[pi].segmentActions||[]).map(a=>effectivePriorityKey(a,rot)).join('|');
      const prev=strategyMap.get(sig),cur={index:pi,rotation:rot};
      if(!prev || pi<prev.index || (pi===prev.index && String(rot).localeCompare(String(prev.rotation))<0))strategyMap.set(sig,cur);
    }
    const uniqueStrategyPairs=[...strategyMap.values()].sort((a,b)=>a.index-b.index||String(a.rotation).localeCompare(String(b.rotation)));
    const strategyK=Math.max(2,Math.min(5,Math.floor(Number(base.policySegments)||4)));
    const packStrategy=(pi,rot)=>((Number(pi)&1023)|(((Number(rot?.[0])||0)&15)<<10)|(((Number(rot?.[1])||0)&15)<<14)|(((Number(rot?.[2])||0)&15)<<18)|((strategyK&7)<<22))>>>0;
    const strategyIdByKey=new Map();
    const strategyCodes=new Uint32Array(uniqueStrategyPairs.length);
    for(let sid=0;sid<uniqueStrategyPairs.length;sid++){const q=uniqueStrategyPairs[sid];q.sid=sid;strategyCodes[sid]=packStrategy(q.index,q.rotation);strategyIdByKey.set(`${q.index}|${(q.rotation||[]).join(',')}`,sid);}

    // Reusable optimizer workers: expensive equipment-level stages are parallelized
    // without changing the search space or random seeds. Each worker receives the
    // immutable skill/policy tables once, then processes whole equipment states.
    try{
      const isMobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
      const hc=Math.max(1,navigator.hardwareConcurrency||2);
      const wc=isMobile?1:Math.max(1,Math.min(31,hc>4?hc-1:hc));
      // v27.72 persistent pool: reuse idle Workers across optimization runs.
      // Dead workers are discarded; a changed hardware/mobile target resizes the
      // pool deterministically. Worker state itself is reset by the init command.
      optWorkerPool=(optimizerWorkerPoolGlobal||[]).filter(slot=>slot&&slot.w&&!slot.dead);
      while(optWorkerPool.length>wc){const slot=optWorkerPool.pop();try{slot.w.terminate();}catch(_e){}}
      while(optWorkerPool.length<wc)optWorkerPool.push({w:new Worker('src/optimizer-worker.js'),pending:null,dead:false,rpcInstalled:false,initializedOnce:false,strategySignature:null,batchModuleReady:false});
      optimizerWorkerPoolGlobal=optWorkerPool;
    }catch(e){optWorkerPool=[];}
    const installWorkerRpc=slot=>{
      if(slot.rpcInstalled)return;
      slot.rpcInstalled=true;slot.pending=null;slot.dead=false;
      slot.w.addEventListener('message',ev=>{
        const p=slot.pending,d=ev.data||{};if(!p||d.id!==p.id)return;
        if(d.cmd==='result'){slot.pending=null;p.resolve(d.result);return;}
        if(d.cmd==='error'){slot.pending=null;const e=new Error(d.error||'optimizer worker command failed');e.workerCommandError=true;p.reject(e);}
      });
      slot.w.addEventListener('error',err=>{
        slot.dead=true;const p=slot.pending;slot.pending=null;if(p)p.reject(err instanceof Error?err:new Error(err?.message||'optimizer worker failed'));
        try{slot.w.terminate();}catch(_e){}
      });
    };
    const runWorkerJob=(slot,job)=>new Promise((resolve,reject)=>{
      if(!slot||slot.dead)return reject(new Error('optimizer worker unavailable'));
      if(slot.pending)return reject(new Error('optimizer worker received overlapping jobs'));
      slot.pending={id:job.id,resolve,reject};
      try{slot.w.postMessage(job.msg,job.transfer||[]);}catch(e){slot.pending=null;reject(e);}
    });
    const initWorkers=async()=>{
      if(!optWorkerPool.length)return false;
      const initOne=(slot,msg)=>new Promise((resolve,reject)=>{
        let settled=false;
        const timer=setTimeout(()=>{if(settled)return;settled=true;cleanup();slot.dead=true;try{slot.w.terminate();}catch(_e){}reject(new Error('optimizer worker init timeout'));},15000);
        const cleanup=()=>{clearTimeout(timer);slot.w.removeEventListener('message',onMessage);slot.w.removeEventListener('error',onError);};
        const onMessage=ev=>{
          const d=ev.data||{};
          if(d.cmd==='init-ok'){settled=true;cleanup();resolve(d);return;}
          if(d.cmd==='error'){settled=true;cleanup();reject(new Error(d.error||'optimizer worker init failed'));}
        };
        const onError=e=>{if(settled)return;settled=true;cleanup();reject(e instanceof Error?e:new Error(e?.message||'optimizer worker load failed'));};
        slot.w.addEventListener('message',onMessage);slot.w.addEventListener('error',onError);
        try{slot.w.postMessage(msg);}catch(e){
          if(msg.fullSimModule||msg.batchWasmModule){const fallback={...msg};delete fallback.fullSimModule;delete fallback.batchWasmModule;slot.w.postMessage(fallback);}else throw e;
        }
      });
      try{
        const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
        const fullSimModule=await __fullSimPrecompile;
        const batchWasmModule=(base.specialEffect==='hpmax')?await optimizerCompileWasmModule('wasm/sim-full.wasm'):null;
        const skillsFingerprint=JSON.stringify(skills||[]);
        const common={cmd:'init',base,skills,skillsFingerprint,rotations,mobile};
        const strategySignature=`K${strategyK}|N${strategyCodes.length}`;
        const initMsgFor=(slot,extra={})=>{
          const msg={...common,...extra};
          // Persistent Workers already own immutable runtime assets. Re-send only
          // when the strategy table changed (K changed) or a kernel is first used.
          if(slot.strategySignature!==strategySignature)msg.strategyCodes=strategyCodes;
          if(!slot.initializedOnce&&fullSimModule)msg.fullSimModule=fullSimModule;
          if(base.specialEffect==='hpmax'&&!slot.batchModuleReady&&batchWasmModule)msg.batchWasmModule=batchWasmModule;
          return msg;
        };
        const markInitialized=slot=>{slot.initializedOnce=true;slot.strategySignature=strategySignature;if(base.specialEffect==='hpmax')slot.batchModuleReady=true;};
        // v27.72: an identical model can reuse the already-proven differential
        // gate on subsequent runs. A changed model receives a fresh gate.
        const validationKey=JSON.stringify({base:{duration:base.duration,policySegments:base.policySegments,baseResist:base.baseResist,rise:base.rise,fall:base.fall,ailmentDuration:base.ailmentDuration,critRate:base.critRate,normalHpm:base.normalHpm,normalRangedRate:base.normalRangedRate,comboSuccessRate:base.comboSuccessRate,hpMaxUptime:base.hpMaxUptime,specialEffect:base.specialEffect},skills:skillsFingerprint});
        let first=optimizerValidationCache.get(validationKey)||null;
        if(first){
          const extra={trustedInit:true,trustedWasmSafe:first.wasmSafe||{},trustedFullSimCandidateSafe:!!first.fullSimCandidateSafe};
          await Promise.all(optWorkerPool.map(async slot=>{const r=await initOne(slot,initMsgFor(slot,extra));markInitialized(slot);return r;}));
        }else{
          first=await initOne(optWorkerPool[0],initMsgFor(optWorkerPool[0]));markInitialized(optWorkerPool[0]);
          optimizerValidationCache.set(validationKey,{wasmSafe:first.wasmSafe||{},fullSimCandidateSafe:!!first.fullSimCandidateSafe});
          if(optimizerValidationCache.size>8)optimizerValidationCache.delete(optimizerValidationCache.keys().next().value);
          if(optWorkerPool.length>1){
            const extra={trustedInit:true,trustedWasmSafe:first.wasmSafe||{},trustedFullSimCandidateSafe:!!first.fullSimCandidateSafe};
            await Promise.all(optWorkerPool.slice(1).map(async slot=>{const r=await initOne(slot,initMsgFor(slot,extra));markInitialized(slot);return r;}));
          }
        }
        optimizerCaps=first;
        for(const slot of optWorkerPool)installWorkerRpc(slot);
        optimizerWorkerPoolGlobal=optWorkerPool.filter(slot=>!slot.dead);
        return true;
      }catch(e){
        console.warn('Optimizer worker unavailable; falling back to main thread.',e);
        for(const slot of optWorkerPool)try{slot.w.terminate();}catch(_e){}
        optWorkerPool=[];optimizerWorkerPoolGlobal=[];
        return false;
      }
    };
    const parallelStage=async(jobs,label)=>{
      if(!jobs.length)return [];
      const out=new Array(jobs.length);let next=0,done=0;
      const progress=suffix=>{$('status').textContent=`最適化中… ${label} ${done}/${jobs.length}${suffix||''}`;};
      const active=optWorkerPool.filter(slot=>!slot.dead);
      if(!active.length){
        for(let i=0;i<jobs.length;i++){out[jobs[i].id]=await jobs[i].fallback();done++;progress('');await yieldUI();}
        return out;
      }
      // One permanent listener per Worker replaces per-job add/removeEventListener
      // churn. Each loop pulls the next job only after the previous result, which
      // preserves dynamic load balancing without accumulating closures/listeners.
      const loop=async slot=>{
        while(!slot.dead){
          const qi=next++;if(qi>=jobs.length)return;const job=jobs[qi];
          try{out[job.id]=await runWorkerJob(slot,job);}
          catch(e){out[job.id]=await job.fallback();done++;progress('（1件JSへ退避）');if(slot.dead)return;continue;}
          done++;progress('');
        }
      };
      await Promise.all(active.map(loop));
      // If every Worker died mid-stage, finish any unclaimed jobs canonically.
      while(next<jobs.length){const job=jobs[next++];out[job.id]=await job.fallback();done++;progress('（JSへ退避）');await yieldUI();}
      optimizerWorkerPoolGlobal=optWorkerPool.filter(slot=>!slot.dead);
      return out;
    };
    await initWorkers();

    // ---------- Stage 1: fast equipment beam screen ----------
    // The simulator itself is unchanged.  We only reduce the number of
    // rotation probes used to rank equipment at this coarse stage.  Three
    // cyclic full rotations are representative of the 15 fixed candidates;
    // all 15 rotations are restored for the finalists later.
    const screenRotations=[[1,2,3],[2,3,1],[3,1,2]];
    const screenDuration=Math.min(duration,24);
    const screenTrials=Math.max(1,Math.min(3,Math.ceil(userCoarse/35)));
    const screenSeed=0x13579BDF;
    const screen=[];
    const rotationScores=new Map();
    // v27.70: the legacy no-policy batch WASM is only used when its startup
    // differential gate passes for the active effect. If it does not, Stage 1 is
    // canonical JS, so create enough smaller Worker batches to occupy all cores
    // instead of leaving most of a 16/24/32-thread CPU idle behind 64-eq jobs.
    const screenWasmSafe=!!optimizerCaps?.wasmSafe?.[base.specialEffect||'crit'];
    const screenTargetJobs=Math.max(1,(optWorkerPool.length||1)*2);
    const screenBatchSize=screenWasmSafe?64:Math.max(4,Math.min(64,Math.ceil(all.length/screenTargetJobs))),screenJobs=[];
    for(let off=0,jid=0;off<all.length;off+=screenBatchSize,jid++){
      const equipments=all.slice(off,off+screenBatchSize);
      screenJobs.push({id:jid,msg:{cmd:'screenBatch',id:jid,equipments,duration:screenDuration,trials:screenTrials,seed:screenSeed,rotationsOverride:screenRotations},fallback:async()=>{const out=[];for(const eq of equipments){let best=null,row=[];for(const rot of screenRotations){const r=runSimulationFast({...base,equipment:eq,rotation:rot,policy:null,duration:screenDuration,trials:screenTrials,seed:screenSeed});const x={rotation:rot,score:r.uptime};row.push(x);if(!best||x.score>best.score)best=x;}out.push({best,row});}return out;}});
    }
    const screenBatches=await parallelStage(screenJobs,'Pareto装備×代表3ローテーション');
    const screenResults=screenBatches.flat();
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

    // ---------- Stage 3: policy × rotation search ----------
    // v27.67 defaults to the Turbo SIMD staged race.  The complete v27.64
    // exhaustive path is still available from the UI for users who explicitly
    // want it and accept the very large runtime.
    const canonicalPolicyExhaustiveFallback=async(item,dur,tr,seed)=>{
      const top=[];
      const push=(z)=>{let i=top.length;while(i>0&&z.score>top[i-1].score)i--;top.splice(i,0,z);if(top.length>16)top.length=16;};
      for(let qi=0;qi<uniqueStrategyPairs.length;qi++){
        const q=uniqueStrategyPairs[qi],r=runSimulationFast({...base,equipment:item.equipment,rotation:q.rotation,policy:policyFromSpecCached(policies[q.index]),duration:dur,trials:tr,seed});
        push({index:q.index,rotation:q.rotation,score:r.uptime});
        if((qi&127)===127)await yieldUI();
      }
      return {top,evaluated:uniqueStrategyPairs.length,total:uniqueStrategyPairs.length};
    };
    const canonicalPolicyRaceFallback=async(item,stages,topN=16)=>{
      let alive=uniqueStrategyPairs.map(q=>({sid:q.sid,index:q.index,rotation:q.rotation,score:-Infinity,sum:0,count:0,lastDuration:-1}));
      for(const st of stages){
        const dur=Number(st.duration)||30,target=Math.max(1,Math.floor(Number(st.totalTrials??st.trials)||1)),scored=[];
        for(let qi=0;qi<alive.length;qi++){
          const q=alive[qi],same=st.cumulative!==false&&q.lastDuration===dur,already=same?q.count:0,add=Math.max(0,target-already);
          let sum=same?q.sum:0,count=same?q.count:0;
          if(add>0){const r=runSimulationFast({...base,equipment:item.equipment,rotation:q.rotation,policy:policyFromSpecCached(policies[q.index]),duration:dur,trials:add,trialStart:already,seed:policySeed});sum+=r.uptime*add;count+=add;}
          scored.push({...q,sum,count,lastDuration:dur,score:count?sum/count:q.score});if((qi&127)===127)await yieldUI();
        }
        scored.sort((a,b)=>b.score-a.score||a.index-b.index);let keep=st.keep;if(keep>0&&keep<1)keep=Math.ceil(scored.length*keep);else keep=Math.floor(keep||topN);
        alive=scored.slice(0,Math.max(Math.min(topN,scored.length),Math.min(scored.length,keep)));
      }
      return {top:alive.slice(0,topN),evaluated:0,total:uniqueStrategyPairs.length};
    };
    // Multi-equipment variant: run all representative races concurrently while
    // sharding each race enough to occupy otherwise idle cores. This avoids the
    // v27.67 under-utilization without serializing representatives.
    const distributedPolicyRaces=async(items,stages,topN=16,label='分散方策レース')=>{
      if(!items.length)return [];
      if(optWorkerPool.length<2)return await Promise.all(items.map(x=>canonicalPolicyRaceFallback(x,stages,topN)));
      // v27.72: the native policy-code matrix now has very low per-shard setup
      // cost, so the old v27.68 "3+ equipments => no sharding" heuristic became
      // counterproductive.  Whenever there are idle workers, shard the strategy
      // axis as well; if equipment jobs already fill the pool, keep one job each.
      if(items.length>=optWorkerPool.length){
        const jobs=items.map((item,ei)=>({id:ei,msg:{cmd:'policyRace',id:ei,equipment:item.equipment,seed:policySeed,stages,topN},fallback:async()=>canonicalPolicyRaceFallback(item,stages,topN)}));
        return await parallelStage(jobs,label);
      }
      const states=items.map(()=>uniqueStrategyPairs.map(q=>({sid:q.sid,score:-Infinity,sum:0,count:0,lastDuration:-1})));
      const evalCounts=new Uint32Array(items.length);
      for(let si=0;si<stages.length;si++){
        const st=stages[si]||{},dur=Math.max(0.25,Number(st.duration)||30),target=Math.max(1,Math.floor(Number(st.totalTrials??st.trials)||1)),cumulative=st.cumulative!==false;
        const jobs=[],meta=[];let jid=0;
        const totalShardBudget=Math.max(optWorkerPool.length,optWorkerPool.length*2);
        const baseShards=Math.max(1,Math.floor(totalShardBudget/items.length));
        for(let ri=0;ri<items.length;ri++){
          const alive=states[ri];if(!alive.length)continue;
          const same=cumulative&&alive.every(q=>q.lastDuration===dur),already=same?(alive[0]?.count||0):0,add=Math.max(0,target-already);
          if(add<=0)continue;
          const shardCount=Math.min(alive.length,baseShards+(ri<(totalShardBudget%items.length)?1:0));
          let shardSize=Math.max(8,Math.ceil(alive.length/shardCount));shardSize=Math.ceil(shardSize/8)*8;
          for(let off=0;off<alive.length;off+=shardSize){
            const part=alive.slice(off,Math.min(alive.length,off+shardSize)),id=jid++;
            // v27.72: the first (largest) race stage is sequential by sid. Send
            // only start+count instead of allocating/transferring thousands of
            // IDs. Later non-contiguous survivors use Uint16 IDs (N<65536).
            let contiguous=part.length>0,firstSid=contiguous?part[0].sid:0;
            for(let j=1;contiguous&&j<part.length;j++)if(part[j].sid!==firstSid+j)contiguous=false;
            let msg,transfer=[];
            if(contiguous)msg={cmd:'policyPairs',id,equipment:items[ri].equipment,pairStart:firstSid,pairCount:part.length,duration:dur,trials:add,trialStart:already,seed:policySeed};
            else{const PairType=uniqueStrategyPairs.length<65536?Uint16Array:Uint32Array,pairIds=PairType.from(part,q=>q.sid);msg={cmd:'policyPairs',id,equipment:items[ri].equipment,pairIds,duration:dur,trials:add,trialStart:already,seed:policySeed};transfer=[pairIds.buffer];}
            jobs.push({id,msg,transfer,fallback:async()=>{const scores=[];for(const q of part){const r=runSimulationFast({...base,equipment:items[ri].equipment,rotation:q.rotation,policy:policyFromSpecCached(policies[q.index]),duration:dur,trials:add,trialStart:already,seed:policySeed});scores.push(r.uptime);}return {scores};}});
            meta[id]={ri,off,len:part.length,same,already,add,dur};
          }
        }
        const rr=jobs.length?await parallelStage(jobs,`${label} ${si+1}/${stages.length}`):[];
        const stageScores=states.map(a=>{const v=new Float64Array(a.length);v.fill(NaN);return v;});
        for(let id=0;id<rr.length;id++){
          const m=meta[id],scores=rr[id]?.scores||[];if(!m||scores.length!==m.len)throw new Error('分散方策レースのシャード結果が一致しません。');
          for(let j=0;j<scores.length;j++)stageScores[m.ri][m.off+j]=Number(scores[j]);evalCounts[m.ri]+=scores.length;
        }
        for(let ri=0;ri<items.length;ri++){
          const alive=states[ri];if(!alive.length)continue;
          const same=cumulative&&alive.every(q=>q.lastDuration===dur),already=same?(alive[0]?.count||0):0,add=Math.max(0,target-already);
          for(let j=0;j<alive.length;j++){
            const q=alive[j];if(!same){q.sum=0;q.count=0;}
            if(add>0){const sc=stageScores[ri][j];if(!Number.isFinite(sc))throw new Error('分散方策レースのスコアが不正です。');q.sum+=sc*add;q.count+=add;}
            q.lastDuration=dur;q.score=q.count?q.sum/q.count:q.score;
          }
          alive.sort((a,b)=>b.score-a.score || a.sid-b.sid);
          let keep=st.keep;if(Number(keep)>0&&Number(keep)<1)keep=Math.ceil(alive.length*Number(keep));else keep=Math.floor(Number(keep)||topN);
          keep=Math.max(Math.min(Math.max(16,topN),alive.length),Math.min(alive.length,keep));alive.length=keep;
        }
        await yieldUI();
      }
      return states.map((alive,ri)=>({top:alive.slice(0,Math.max(1,Math.min(64,topN))).map(q=>{const m=uniqueStrategyPairs[q.sid];return {sid:q.sid,index:m.index,rotation:m.rotation,score:q.score};}),evaluated:evalCounts[ri],total:uniqueStrategyPairs.length}));
    };

    // Split a long Monte-Carlo suffix over otherwise idle workers. This is used
    // when Top-K is small and the old one-candidate/one-worker mapping would use
    // only 2-4 cores. Each shard owns a disjoint trialStart range; weighted
    // recombination therefore evaluates exactly the requested trial set.
    const distributedRunRanges=async(candidates,start,trials,label)=>{
      if(!candidates.length)return [];
      const workers=Math.max(1,optWorkerPool.length);
      if(workers<2||candidates.length>=workers||trials<64){
        const jobs=candidates.map((c,i)=>({id:i,msg:{cmd:'run',id:i,cfg:{...base,equipment:c.equipment,rotation:c.rotation,policy:policyFromSpecCached(c.policy),duration,trials,trialStart:start,seed:policySeed}},fallback:async()=>runSimulationFast({...base,equipment:c.equipment,rotation:c.rotation,policy:policyFromSpecCached(c.policy),duration,trials,trialStart:start,seed:policySeed})}));
        return await parallelStage(jobs,label);
      }
      // v27.72: consume every available Worker even when candidate count does not
      // divide the pool (e.g. 16 finalists on 31 workers). Give the remainder
      // shards to the first candidates; trialStart ranges remain disjoint/exact.
      const oversubscribe=trials>=256?2:1;
      const targetJobs=Math.min(trials*candidates.length,workers*oversubscribe);
      const baseParts=Math.floor(targetJobs/candidates.length),extraParts=targetJobs%candidates.length;
      const jobs=[];const map=[];let jid=0;
      for(let ci=0;ci<candidates.length;ci++){
        const c=candidates[ci],parts=Math.max(1,Math.min(trials,baseParts+(ci<extraParts?1:0))),baseN=Math.floor(trials/parts),rem=trials%parts;let st=start;
        for(let p=0;p<parts;p++){
          const n=baseN+(p<rem?1:0);if(!n)continue;
          const id=jid++;jobs.push({id,msg:{cmd:'run',id,cfg:{...base,equipment:c.equipment,rotation:c.rotation,policy:policyFromSpecCached(c.policy),duration,trials:n,trialStart:st,seed:policySeed}},fallback:async()=>runSimulationFast({...base,equipment:c.equipment,rotation:c.rotation,policy:policyFromSpecCached(c.policy),duration,trials:n,trialStart:st,seed:policySeed})});map.push({ci,n});st+=n;
        }
      }
      const got=await parallelStage(jobs,label),sum=new Float64Array(candidates.length),cnt=new Uint32Array(candidates.length),maxv=new Float64Array(candidates.length);maxv.fill(-Infinity);
      for(let j=0;j<got.length;j++){const m=map[j],r=got[j];sum[m.ci]+=Number(r.uptime)*m.n;cnt[m.ci]+=m.n;if(Number(r.maxRes)>maxv[m.ci])maxv[m.ci]=Number(r.maxRes);}
      return candidates.map((_,i)=>({uptime:sum[i]/Math.max(1,cnt[i]),maxRes:maxv[i]}));
    };

    const optMode=$('optMode')?.value||'practical';
    const policySeed=0x2468ACE1;
    let ranking=[];

    if(optMode==='exhaustive'){
      const policyTrials=Math.max(1,Math.floor(requestedTrials));
      const policyDuration=duration;
      $('status').textContent=`最適化中… 完全総当たり ${policyPool.length}装備 × ${uniqueStrategyPairs.length}厳密ユニーク戦略（元${policies.length*rotations.length}組、${policyTrials}試行）`;
      await yieldUI();
      const exhaustiveJobs=policyPool.map((item,ei)=>({
        id:ei,
        msg:{cmd:'policyExhaustive',id:ei,equipment:item.equipment,duration:policyDuration,trials:policyTrials,seed:policySeed},
        fallback:async()=>canonicalPolicyExhaustiveFallback(item,policyDuration,policyTrials,policySeed)
      }));
      const exhaustiveResults=await parallelStage(exhaustiveJobs,'完全総当たり');
      for(let ei=0;ei<policyPool.length;ei++){
        const item=policyPool[ei],res=exhaustiveResults[ei],z=res?.top?.[0];
        if(z)ranking.push({equipment:item.equipment,policy:policies[z.index],policyIndex:z.index,rotation:z.rotation,score:z.score});
      }
    }else{
      // v27.72 HyperRPC Exact optimizer.
      // Every policy × rotation is still admitted to the first race, but only a
      // shrinking survivor set receives longer/multi-trial evaluations. Combined
      // with 8-candidate WASM SIMD this removes the dominant v27.66 cost while the
      // final selected candidates are still scored at the user's full duration and
      // requested Monte-Carlo count.
      const repTarget=Math.min(policyPool.length,Math.max(3,Math.min(6,Math.ceil(topK/2)+1)));
      const repLeaders=policyPool.slice().sort((a,b)=>b.score-a.score).slice(0,Math.max(2,Math.ceil(repTarget/2)));
      const repDiverse=farthestEquipmentSample(all,repTarget).map(eq=>policyPool.find(x=>equipmentKey(x.equipment)===equipmentKey(eq))).filter(Boolean);
      const representatives=[];const repSeen=new Set();
      for(const x of [...repLeaders,...repDiverse]){const k=equipmentKey(x.equipment);if(!repSeen.has(k)){repSeen.add(k);representatives.push(x);}if(representatives.length>=repTarget)break;}

      const repDuration=Math.min(duration,60),repTrials=Math.max(2,Math.min(4,Math.ceil(userCoarse/70)));
      const repStages=[
        {duration:repDuration,totalTrials:1,keep:0.55,cumulative:true},
        ...(repTrials>2?[{duration:repDuration,totalTrials:2,keep:0.45,cumulative:true}]:[]),
        {duration:repDuration,totalTrials:repTrials,keep:24,cumulative:true}
      ];
      $('status').textContent=`最適化中… HyperRPC探索：代表${representatives.length}装備で ${uniqueStrategyPairs.length}個の厳密ユニーク戦略を段階レース`;
      await yieldUI();
      const repResults=await distributedPolicyRaces(representatives,repStages,24,'代表装備HyperRPCレース');

      const pairMap=new Map();
      for(const res of repResults){for(const z of (res?.top||[])){
        const k=`${z.index}|${(z.rotation||[]).join(',')}`;const old=pairMap.get(k);
        if(!old||z.score>old.score)pairMap.set(k,{index:z.index,rotation:z.rotation,score:z.score});
      }}
      const beamCap=Math.min(pairMap.size,Math.max(24,Math.min(48,topK*4)));
      const beamPairs=[...pairMap.values()].sort((a,b)=>b.score-a.score).slice(0,beamCap).map(({index,rotation})=>({index,rotation}));
      if(!beamPairs.length)throw new Error('方策ビームを生成できませんでした。');
      const beamPairIds=Uint32Array.from(beamPairs.map(q=>strategyIdByKey.get(`${q.index}|${(q.rotation||[]).join(',')}`)).filter(Number.isInteger));
      if(beamPairIds.length!==beamPairs.length)throw new Error('方策ビームIDの構築に失敗しました。');

      const beamDuration=Math.min(duration,30);
      const beamTrials=Math.max(1,Math.min(2,Math.ceil(userCoarse/120)));
      $('status').textContent=`最適化中… 全Pareto装備 ${policyPool.length}個 × SIMD方策ビーム${beamPairs.length}候補（${beamTrials}試行・${beamDuration}s）`;
      await yieldUI();
      const beamWorkers=Math.max(1,optWorkerPool.length||1),beamBatchSize=Math.max(1,Math.min(16,Math.ceil(policyPool.length/Math.max(1,beamWorkers*2))));
      const beamJobs=[];
      for(let off=0,jid=0;off<policyPool.length;off+=beamBatchSize,jid++){
        const items=policyPool.slice(off,off+beamBatchSize),equipments=items.map(x=>x.equipment);
        beamJobs.push({id:jid,msg:{cmd:'policyBeamBatch',id:jid,equipments,pairIds:beamPairIds,duration:beamDuration,trials:beamTrials,seed:policySeed,topN:3},fallback:async()=>{const rows=[];for(const item of items){const top=[];const push=z=>{let i=top.length;while(i>0&&z.score>top[i-1].score)i--;top.splice(i,0,z);if(top.length>3)top.length=3;};for(let qi=0;qi<beamPairs.length;qi++){const q=beamPairs[qi],r=runSimulationFast({...base,equipment:item.equipment,rotation:q.rotation,policy:policyFromSpecCached(policies[q.index]),duration:beamDuration,trials:beamTrials,seed:policySeed});push({...q,score:r.uptime});}rows.push({top,evaluated:beamPairs.length,total:beamPairs.length});}return rows;}});
      }
      const beamBatchResults=await parallelStage(beamJobs,'全装備SIMDビーム');
      const beamResults=beamBatchResults.flat();
      const beamRank=policyPool.map((item,ei)=>({item,best:beamResults[ei]?.top?.[0]||null})).filter(x=>x.best).sort((a,b)=>b.best.score-a.best.score);

      const refineTarget=Math.min(beamRank.length,Math.max(10,topK+4));
      const refine=[];const refineSeen=new Set();
      for(const x of beamRank.slice(0,refineTarget)){const k=equipmentKey(x.item.equipment);if(!refineSeen.has(k)){refineSeen.add(k);refine.push(x.item);}}
      for(const eq of farthestEquipmentSample(all,Math.min(3,all.length))){const k=equipmentKey(eq);if(refine.length>=refineTarget+3)break;if(!refineSeen.has(k)){const item=policyPool.find(x=>equipmentKey(x.equipment)===k);if(item){refineSeen.add(k);refine.push(item);}}}

      const refineDuration=Math.min(duration,120),refineTrials=Math.max(3,Math.min(5,Math.ceil(userCoarse/50)));
      const refineStages=[
        {duration:refineDuration,totalTrials:1,keep:0.55,cumulative:true},
        {duration:refineDuration,totalTrials:2,keep:0.45,cumulative:true},
        {duration:refineDuration,totalTrials:refineTrials,keep:16,cumulative:true}
      ];
      $('status').textContent=`最適化中… 上位${refine.length}装備を全方策×全ローテーションのHyperRPCレースで再探索`;
      await yieldUI();
      const refineResults=await distributedPolicyRaces(refine,refineStages,16,'上位装備HyperRPC再探索');
      const candidates=[];const candSeen=new Set();
      for(let ei=0;ei<refine.length;ei++){
        const item=refine[ei],tops=refineResults[ei]?.top||[];
        for(const z of tops.slice(0,3)){
          const key=`${equipmentKey(item.equipment)}|${z.index}|${(z.rotation||[]).join(',')}`;
          if(candSeen.has(key))continue;candSeen.add(key);
          candidates.push({equipment:item.equipment,policy:policies[z.index],policyIndex:z.index,rotation:z.rotation,coarseScore:z.score});
        }
      }
      candidates.sort((a,b)=>b.coarseScore-a.coarseScore);

      const prelimCount=Math.min(candidates.length,Math.max(16,topK*2));
      const prelim=[];const prelimSeen=new Set();
      for(const c of candidates){const k=equipmentKey(c.equipment);if(prelimSeen.has(k))continue;prelimSeen.add(k);prelim.push(c);if(prelim.length>=prelimCount)break;}
      if(prelim.length<prelimCount){const chosen=new Set(prelim.map(c=>`${equipmentKey(c.equipment)}|${c.policyIndex}|${(c.rotation||[]).join(',')}`));for(const c of candidates){const k=`${equipmentKey(c.equipment)}|${c.policyIndex}|${(c.rotation||[]).join(',')}`;if(chosen.has(k))continue;chosen.add(k);prelim.push(c);if(prelim.length>=prelimCount)break;}}
      if(!prelim.length)throw new Error('HyperRPC探索の最終候補がありません。');
      const preTrials=Math.min(requestedTrials,Math.max(32,Math.min(512,Math.ceil(requestedTrials*0.04))));
      $('status').textContent=`最適化中… 最終予選 ${prelim.length}候補 × ${preTrials}/${requestedTrials}試行・${duration}s（Full-SIMD）`;
      await yieldUI();
      const preResults=await distributedRunRanges(prelim,0,preTrials,'最終SIMD予選');
      const preRank=prelim.map((c,i)=>({...c,preScore:preResults[i].uptime})).sort((a,b)=>b.preScore-a.preScore);
      const finalCount=Math.min(preRank.length,Math.max(topK+2,Math.min(12,topK+3)));
      const finalists=[];const finalistEq=new Set();const finalistKeys=new Set();
      for(const c of preRank){const ek=equipmentKey(c.equipment);if(finalistEq.has(ek))continue;finalistEq.add(ek);finalists.push(c);finalistKeys.add(`${ek}|${c.policyIndex}|${(c.rotation||[]).join(',')}`);if(finalists.length>=Math.min(topK,finalCount))break;}
      for(const c of preRank){if(finalists.length>=finalCount)break;const k=`${equipmentKey(c.equipment)}|${c.policyIndex}|${(c.rotation||[]).join(',')}`;if(finalistKeys.has(k))continue;finalistKeys.add(k);finalists.push(c);}

      if(preTrials>=requestedTrials){
        ranking=finalists.map(c=>({...c,score:c.preScore}));
      }else{
        const remTrials=requestedTrials-preTrials;
        $('status').textContent=`最適化中… 上位${finalists.length}候補をFull-SIMDで精密評価（残り${remTrials}試行）`;
        await yieldUI();
        const remResults=await distributedRunRanges(finalists,preTrials,remTrials,'最終HyperRPC精密評価');
        ranking=finalists.map((c,i)=>({...c,score:(c.preScore*preTrials+remResults[i].uptime*remTrials)/requestedTrials}));
      }
    }

    ranking.sort((a,b)=>b.score-a.score);
    // One row per aggregate equipment state in the displayed ranking.
    const topRanking=[];const rankedEq=new Set();
    for(const x of ranking){const k=equipmentKey(x.equipment);if(rankedEq.has(k))continue;rankedEq.add(k);topRanking.push(x);if(topRanking.length>=topK)break;}
    if(!topRanking.length)throw new Error('最適化候補がありません。');
    const best=topRanking[0];

    optimizedEquipment=best.equipment;lastResult=null;
    const probTrials=Math.max(200,Math.min(1200,requestedTrials));
    const probabilityResult=runSimulation({...base,equipment:best.equipment,rotation:best.rotation,policy:best.policy?policyFromSpec(best.policy):null,trials:probTrials,seed:0x7A11CE,__probTimeline:true,__probStep:0.5});
    lastResult=probabilityResult;
    best.result=probabilityResult;
    render(best.result);
    renderEquipmentResult(best.equipment);
    const strategyHeader='条件分岐戦略';
    const strategyBody=policyText(best.policy,best.rotation)+`\n代替ローテーション全体：${rotationPriorityText(best.rotation)}`;
    $('optimizationResult').textContent=`【装備＋アドバンススキル使用方法の最適化】\n最適戦略：${strategyHeader}\n${strategyBody}\n\n最終評価 毒維持率：${(best.score*100).toFixed(3)}%`;
    const rankHtml=topRanking.map((x,i)=>{
      const pol=`条件分岐：毒残り時間を${x.policy.segmentCount}分割<br>${x.policy.segmentActions.map((a,seg)=>`区間${seg+1}：${actionLabel(Number(a))} ／ 優先順位：${policyPriorityText(Number(a),x.rotation)}`).join('<br>')}<br>代替ローテーション（スキル3種＋通常攻撃）：${rotationPriorityText(x.rotation)}`;
      return `<div class="rank-row"><strong>${i+1}位</strong>　毒維持率 ${(x.score*100).toFixed(3)}%　毒+${x.equipment.poisonHit.toFixed(1)}%　状態異常+${x.equipment.ailment.toFixed(1)}%　CT促進+${x.equipment.ctPromo.toFixed(1)}%　即時CT+${x.equipment.instant.toFixed(1)}%<br><span>${pol}</span></div>`;
    }).join('');
    $('optimizationRanking').innerHTML=`<h3>異なる装備合計値の上位${topRanking.length}候補</h3>${rankHtml}`;

  }finally{ optimizerSkillsCache=null; optimizerWorkerPoolGlobal=(optWorkerPool||[]).filter(slot=>slot&&!slot.dead); $('optimize').disabled=false;$('status').textContent='';}
}

function optimize() {
                                return optimizeJoint(); }
                                $('specialEffect').onchange=refreshCritUI; refreshCritUI();
                                $('optimize').onclick=async()=>{try{await optimize();}catch(e) {
                                  $('status').textContent='エラー: '+e.message;console.error(e);}};
