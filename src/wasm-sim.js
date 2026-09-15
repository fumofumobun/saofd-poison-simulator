let wasmBatchInstance=null;
async function initWasmBatch(){
  if(wasmBatchInstance)return true;
  try{const r=await fetch('./sim-full.wasm',{cache:'force-cache'});if(!r.ok)throw new Error('sim-full.wasm fetch failed');const b=await r.arrayBuffer();const m=await WebAssembly.instantiate(b,{});wasmBatchInstance=m.instance;return true;}catch(e){wasmBatchInstance=null;return false;}
}
function wasmBatchScores(cfgs){
  if(!wasmBatchInstance||!cfgs.length)return null;
  const ex=wasmBatchInstance.exports,mem=ex.memory.buffer;
  const baseOff=1024,skillOff=2048,candOff=8192,outOff=32768;
  const b=new Float64Array(mem,baseOff,18);b.fill(0);const first=cfgs[0];
  b[0]=Math.max(0,Number(first.duration)||0);b[1]=Math.max(1,Math.floor(first.trials||1));b[2]=Math.max(0,Number(first.baseResist)||0);b[3]=Number(first.rise)||0;b[4]=Number(first.fall)||0;b[5]=Number(first.ailmentDuration)||0;b[6]=Number(first.critRate)||0;b[7]=Number(first.normalHpm??first.normalHps*60)||0;b[8]=Number(first.normalRangedRate)||0;b[9]=Number(first.comboSuccessRate??100)||0;b[10]=Number(first.hpMaxUptime??100)||0;b[11]=first.specialEffect==='combo'?1:(first.specialEffect==='hpmax'?2:0);b[12]=((Number(first.seed)||1234567)>>>0);const skills=first.skills||[];b[13]=skills.length;
  const sk=new Float64Array(mem,skillOff,skills.length*10);sk.fill(0);skills.forEach((s,i)=>{const q=i*10;sk[q]=Number(s.ct)||0;sk[q+1]=Math.max(0,Number(s.execution)||0);sk[q+2]=Math.max(0,Math.floor(Number(s.hits)||0));sk[q+3]=Math.max(0,Number(s.interval)||0);sk[q+4]=Number(s.rangedRate)||0;sk[q+5]=Number(s.partialChance)||0;let mask=0;for(const x of String(s.partialHits||'').split(',')){const h=parseInt(x.trim(),10)-1;if(h>=0&&h<31)mask|=(1<<h);}sk[q+6]=mask>>>0;sk[q+7]=s.type==='special'?2:0;sk[q+8]=s.poisonType==='partial'?1:0;sk[q+9]=Number(s.instant)||0;});
  const cs=new Float64Array(mem,candOff,15*cfgs.length);cs.fill(0);cfgs.forEach((c,i)=>{const q=i*15,e=c.equipment||{};cs[q]=Number(e.poisonHit)||0;cs[q+1]=Number(e.ailment)||0;cs[q+2]=Number(e.ctPromo)||0;cs[q+3]=Number(e.instant)||0;const p=c.policy;cs[q+4]=p?Number(p.rules?.[0]?.value??Infinity):0;cs[q+5]=p?Number(p.rules?.[0]?.action??0):0;cs[q+6]=p?Number(p.rules?.[1]?.value??Infinity):0;cs[q+7]=p?Number(p.rules?.[1]?.action??0):0;cs[q+8]=p?Number(p.defaultAction??0):0;const r=(c.rotation||[]).map(x=>Number(x)-1);cs[q+9]=r[0]??0;cs[q+10]=r[1]??0;cs[q+11]=r[2]??0;cs[q+12]=r.length;cs[q+13]=p?1:0;cs[q+14]=Math.max(0,Math.floor(Number(c.trialStart)||0));});
  ex.simulate_batch(baseOff,skillOff,candOff,outOff,cfgs.length);const out=new Float64Array(mem,outOff,cfgs.length);const results=Array.from(out,v=>({uptime:v}));if(results.length!==cfgs.length||results.some(r=>!Number.isFinite(r.uptime))){throw new Error('WASM batch returned invalid uptime results');}return results;
}
