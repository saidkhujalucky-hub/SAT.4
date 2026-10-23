(function(root,factory){const engine=factory();if(typeof module==='object'&&module.exports)module.exports=engine;else root.SATEngine=engine;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const VERSION=3;
const MODULES=[
 {key:'rw1',section:'rw',module:1,label:'Reading & Writing · Module 1',duration:32*60},
 {key:'rw2',section:'rw',module:2,label:'Reading & Writing · Module 2',duration:32*60},
 {key:'math1',section:'math',module:1,label:'Math · Module 1',duration:35*60},
 {key:'math2',section:'math',module:2,label:'Math · Module 2',duration:35*60}
];
const THRESHOLDS={rw:19,math:16};
const CAPS={easy:600,hard:800};
const BREAK_SECONDS=600;
function numberValue(s){
 if(typeof s!=='string'&&typeof s!=='number')return NaN;
 const input=String(s).trim().replace(',','.');
 if(/^-?\d+(\.\d+)?\s*\/\s*-?\d+(\.\d+)?$/.test(input)){const [x,y]=input.split('/').map(Number);return y===0?NaN:x/y;}
 if(!/^-?(\d+(\.\d+)?|\.\d+)$/.test(input))return NaN;
 return Number(input);
}
function correct(q,value){if(value===undefined||value===null||value==='')return false;return q.type==='numeric'?Math.abs(numberValue(value)-Number(q.answer))<=(q.tolerance||0.00001):value===q.answer;}
function create(bank){
 const variants=Array.from({length:10},(_,i)=>({id:i+1,label:`Practice Test ${i+1}`,questions:98}));
 const lookup=new Map();
 for(const q of bank){const key=`${q.variant}-${q.section}-${q.branch}`;if(!lookup.has(key))lookup.set(key,[]);lookup.get(key).push(q);}
 function branch(a,m){return m.module===1?'mixed':a.routes[m.section];}
 function subset(a,m){return lookup.get(`${a.variant}-${m.section}-${branch(a,m)}`)||[];}
 function current(a){return a.stage==='module'?MODULES[a.index]:null;}
 function route(a,section){
  if(a.routes[section])return;
  const m=MODULES[section==='rw'?0:2],qs=subset(a,m);
  const count=qs.filter(q=>correct(q,a.answers[q.id])).length;
  a.routes[section]=count>=THRESHOLDS[section]?'hard':'easy';
  a.routing[section]={correct:count,total:qs.length,threshold:THRESHOLDS[section],branch:a.routes[section],ceiling:CAPS[a.routes[section]]};
 }
 function finish(a,now=Date.now()){
  if(a.stage!=='module')throw Error('No active module');
  const m=MODULES[a.index];if(m.module===1)route(a,m.section);
  a.endedAt=now;a.endsAt=null;
  if(a.index===3){a.stage='done';a.completedAt=now;return;}
  if(a.index===1){a.stage='break';a.breakEndsAt=now+BREAK_SECONDS*1000;return;}
  a.index++;a.stage='between';
 }
 function sync(a,now=Date.now()){
  let changed=false;
  if(a.stage==='module'&&a.endsAt<=now){finish(a,now);changed=true;}
  if(a.stage==='break'&&a.breakEndsAt<=now){a.stage='between';a.index=2;a.breakEndsAt=null;changed=true;}
  return changed;
 }
 function start(a,now=Date.now()){
  if(a.stage==='break'){a.index=2;a.breakEndsAt=null;}else if(a.stage!=='between')throw Error('Not between modules');
  a.stage='module';a.startedAt=now;a.endsAt=now+MODULES[a.index].duration*1000;
 }
 function newAttempt(id,variant,now=Date.now()){
  if(!Number.isInteger(variant)||variant<1||variant>10)throw Error('Choose a test from 1 to 10');
  return {version:VERSION,id,variant,stage:'module',index:0,startedAt:now,endsAt:now+MODULES[0].duration*1000,breakEndsAt:null,answers:{},flags:{},crossed:{},routes:{rw:null,math:null},routing:{},completedAt:null};
 }
 function results(a){
  const modules=MODULES.map(m=>{
   const review=subset(a,m).map(q=>({...q,yourAnswer:a.answers[q.id]??null,flagged:!!a.flags[q.id],isCorrect:correct(q,a.answers[q.id])}));
   return {key:m.key,label:m.label,branch:branch(a,m),correct:review.filter(q=>q.isCorrect).length,total:review.length,review};
  });
  const sectionScore=(section)=>{
   const parts=modules.filter(m=>m.key.startsWith(section));
   const count=parts.reduce((s,m)=>s+m.correct,0),total=parts.reduce((s,m)=>s+m.total,0);
   const cap=CAPS[a.routes[section]]||800;
   return Math.max(200,Math.min(cap,Math.round((200+600*count/total)/10)*10));
  };
  const rwScore=sectionScore('rw'),mathScore=sectionScore('math');
  return {variant:a.variant,score:rwScore+mathScore,rwScore,mathScore,correct:modules.reduce((s,m)=>s+m.correct,0),total:98,approximate:true,routes:a.routes,routing:a.routing,ceilings:{rw:CAPS[a.routes.rw],math:CAPS[a.routes.math]},modules};
 }
 function serialize(a,now=Date.now()){
  const m=current(a);
  const data={id:a.id,variant:a.variant,version:a.version,stage:a.stage,index:a.index,startedAt:a.startedAt,endsAt:a.endsAt,breakEndsAt:a.breakEndsAt,sections:MODULES,answers:{...a.answers},flags:{...a.flags},crossed:JSON.parse(JSON.stringify(a.crossed)),routes:{...a.routes},routing:JSON.parse(JSON.stringify(a.routing)),completedAt:a.completedAt,serverNow:now};
  if(m){data.module={...m,branch:branch(a,m)};data.questions=subset(a,m).map(q=>{const {answer,explanation,tolerance,...safe}=q;return safe;});}
  if(a.stage==='done')data.results=results(a);
  return data;
 }
 function meta(){return {version:VERSION,totalQuestions:98,bankQuestions:bank.length,variants,modules:MODULES,breakSeconds:BREAK_SECONDS,thresholds:THRESHOLDS,ceilings:CAPS,disclaimer:'Training approximation. Routing thresholds and easy-path cap of 600 are simulator rules, not official College Board scoring.'};}
 return {subset,current,newAttempt,finish,sync,start,results,serialize,meta};
}
return {create,numberValue,correct,VERSION,MODULES,THRESHOLDS,CAPS};
});
