(function(){
'use strict';
const KEY='sat_local_attempts_v3';
const ready=fetch('./questions.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Question bank could not be loaded. Open through a web server or GitHub Pages.');return r.json();}).then(bank=>SATEngine.create(bank));
function fail(message){throw Error(message);}
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
window.SATLocalAPI=async function(route,method='GET',data={}){
 const engine=await ready;
 if(route==='/meta'&&method==='GET')return engine.meta();
 let attempts=load();
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(attempts));}catch{fail('Not enough browser storage. Remove old attempts or use the server version.');}};
 if(route==='/attempts'&&method==='POST'){
  const id=globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3|8)).toString(16);});
  const a=engine.newAttempt(id,data.variant??1);attempts[id]=a;save();return engine.serialize(a);
 }
 const match=route.match(/^\/attempts\/([0-9a-f-]{36})(?:\/(answer|flag|cross|finish|continue|results))?$/);
 if(!match)fail('API endpoint not found');
 const a=attempts[match[1]];if(!a)fail('Attempt not found');if(a.version!==SATEngine.VERSION)fail('Old attempt: start a new test.');
 if(engine.sync(a))save();const action=match[2];
 if(!action&&method==='GET')return engine.serialize(a);
 if(action==='results'&&method==='GET'){if(a.stage!=='done')fail('Complete all modules first');return engine.results(a);}
 if(method!=='POST')fail('Method not allowed');
 if(action==='continue'){engine.start(a);save();return engine.serialize(a);}
 if(action==='finish'){engine.finish(a);save();return engine.serialize(a);}
 const m=engine.current(a);if(!m)fail('No active module');
 const q=engine.subset(a,m).find(q=>q.id===data.questionId);if(!q)fail('Question is not in the active module');
 if(action==='answer'){
  const value=data.value;
  if(value!==null&&value!==''&&!(q.type==='mcq'&&['A','B','C','D'].includes(value))&&!(q.type==='numeric'&&typeof value==='string'&&value.length<=24&&Number.isFinite(SATEngine.numberValue(value))))fail('Invalid answer');
  if(value===null||value==='')delete a.answers[q.id];else a.answers[q.id]=value;
 }else if(action==='flag')a.flags[q.id]=!!data.flagged;
 else if(action==='cross'){
  if(q.type!=='mcq'||!['A','B','C','D'].includes(data.option))fail('Invalid option');
  const items=new Set(a.crossed[q.id]||[]);data.crossed?items.add(data.option):items.delete(data.option);a.crossed[q.id]=[...items];
 }else fail('API endpoint not found');
 save();return {ok:true,serverNow:Date.now()};
};
})();
