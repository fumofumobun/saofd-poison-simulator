/* Final-evaluation worker.  The worker runs the exact same simulator as the
   main thread.  Parallelism only changes wall-clock time, never the model. */
importScripts('./simulator.js');
self.onmessage=function(ev){
  const d=ev.data||{};
  if(d.cmd!=='run')return;
  try{
    const result=runSimulation(d.cfg);
    self.postMessage({result});
  }catch(error){
    self.postMessage({error:String(error&&error.message||error)});
  }
};
