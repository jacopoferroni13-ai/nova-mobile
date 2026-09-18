import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const START=100, TARGET=1000, DAYS=90;
const K='nova_mobile_v2_state';
let engine=null, modelId=null, busy=false;
let state=load();

function fresh(){return {startedAt:Date.now(),income:0,spent:0,transactions:[],approvals:[],memory:'',messages:[{role:'system',content:'NOVA è pronta. Carica il cervello locale per iniziare.'}],lastCycle:null,autonomy:false};}
function load(){try{return {...fresh(),...JSON.parse(localStorage.getItem(K)||'{}')}}catch{return fresh()}}
function save(){localStorage.setItem(K,JSON.stringify(state));render()}
const eur=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n||0);
function profit(){return state.income-state.spent}
function cash(){return START+state.income-state.spent}
function daysLeft(){return Math.max(0,DAYS-Math.floor((Date.now()-state.startedAt)/86400000))}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}

function render(){
 $('#cash').textContent=eur(cash()); $('#profit').textContent=eur(profit()); $('#spent').textContent=eur(state.spent); $('#days').textContent=daysLeft();
 $('#approvalCount').textContent=state.approvals.filter(a=>a.status==='pending').length||'';
 $('#messages').innerHTML=state.messages.slice(-40).map(m=>`<div class="msg ${m.role==='user'?'user':m.role==='system'?'system':''}">${escapeHtml(m.content)}</div>`).join('');
 $('#messages').scrollTop=$('#messages').scrollHeight;
 $('#memoryText').value=state.memory||'';
 $('#approvalList').innerHTML=state.approvals.filter(a=>a.status==='pending').length?state.approvals.filter(a=>a.status==='pending').map(a=>`<div class="approval"><div class="label">RICHIESTA DI SPESA</div><div class="amount">${eur(a.amount)}</div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.reason||'')}</p><small>Rischio: ${escapeHtml(a.risk||'non stimato')} • Tempo tuo: ${escapeHtml(a.humanTime||'≤15 min')}</small><div class="actions"><button data-a="reject" data-id="${a.id}" class="danger">Rifiuta</button><button data-a="approve" data-id="${a.id}" class="primary">Approva</button></div></div>`).join(''):'<p class="muted">Nessuna spesa in attesa.</p>';
 $('#ledgerList').innerHTML=state.transactions.slice().reverse().map(t=>`<div class="tx"><div><strong>${escapeHtml(t.note||t.type)}</strong><br><small>${new Date(t.ts).toLocaleString('it-IT')}</small></div><strong class="${t.type==='income'?'plus':'minus'}">${t.type==='income'?'+':'-'}${eur(t.amount)}</strong></div>`).join('');
}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function chooseModels(){
 const mem=navigator.deviceMemory||4;
 if(mem>=8) return ['DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC','Hermes-3-Llama-3.2-3B-q4f16_1-MLC','Llama-3.2-1B-Instruct-q4f16_1-MLC'];
 if(mem>=4) return ['Hermes-3-Llama-3.2-3B-q4f16_1-MLC','Llama-3.2-1B-Instruct-q4f16_1-MLC'];
 return ['Llama-3.2-1B-Instruct-q4f16_1-MLC'];
}
async function loadAI(){
 if(engine||busy)return; busy=true; $('#status').textContent='loading';
 if(!('gpu' in navigator)){busy=false; $('#status').textContent='no WebGPU'; toast('Chrome/WebGPU non disponibile'); return}
 const candidates=chooseModels(); let lastErr='';
 for(const m of candidates){
  try{
   $('#modelName').textContent=m; $('#progressText').textContent='Primo download: può richiedere diversi minuti e alcuni GB.';
   engine=await webllm.CreateMLCEngine(m,{initProgressCallback:(p)=>{const x=Math.max(0,Math.min(1,p.progress||0));$('#progressBar').style.width=(x*100)+'%';$('#progressText').textContent=p.text||`Caricamento ${Math.round(x*100)}%`;}});
   modelId=m; $('#status').textContent='local'; $('#modelName').textContent=m; state.messages.push({role:'system',content:`Cervello locale attivo: ${m}. I messaggi e la contabilità restano sul telefono.`}); save(); busy=false; return;
  }catch(e){lastErr=e?.message||String(e);engine=null;}
 }
 busy=false; $('#status').textContent='errore'; $('#progressText').textContent='Nessun modello compatibile: '+lastErr; toast('Il telefono non riesce a caricare il modello locale');
}

const SYSTEM=`Sei NOVA, assistente AI personale privato. Missione: trasformare un capitale iniziale di €100 nel maggior profitto legale possibile in 90 giorni, richiedendo al proprietario massimo 15 minuti al giorno. Prima priorità: non perdere capitale inutilmente. Nessuna scommessa, leva, trading speculativo, spam, inganno, violazione di termini o legge. Ogni spesa richiede approvazione umana finché il profitto netto verificato non raggiunge €1000. Non fingere di aver fatto azioni che non puoi fare. Distingui fatti, ipotesi e cose da verificare. Preferisci attività ad alta leva e bassa gestione. Agisci come un team di agenti: Stratega, Scout, Critico e CFO. Mantieni risposte concise e operative.`;

async function ask(messages,max_tokens=700,temp=.35){
 if(!engine) throw new Error('Carica prima il cervello locale');
 const out=await engine.chat.completions.create({messages:[{role:'system',content:SYSTEM},...messages],temperature:temp,max_tokens});
 return out.choices?.[0]?.message?.content?.trim()||'';
}
async function send(){
 const text=$('#input').value.trim(); if(!text||busy)return; $('#input').value=''; state.messages.push({role:'user',content:text}); save();
 try{busy=true; $('#send').textContent='…'; const context=`Situazione: cassa ${eur(cash())}, profitto ${eur(profit())}, giorni rimasti ${daysLeft()}. Memoria proprietario: ${state.memory||'nessuna'}.`;
 const reply=await ask([{role:'user',content:context+'\n\nRichiesta: '+text}],800,.4); state.messages.push({role:'assistant',content:reply}); save();}catch(e){toast(e.message)}finally{busy=false;$('#send').textContent='Invia'}
}

async function cycle(){
 if(busy)return; if(!engine){toast('Prima carica l’AI');return} busy=true; $('#runCycle').textContent='NOVA lavora…';
 try{
  const base=`Cassa ${eur(cash())}; profitto netto ${eur(profit())}; giorni rimasti ${daysLeft()}; spese totali ${eur(state.spent)}; incassi ${eur(state.income)}; tempo umano max 15 min/giorno. Memoria: ${state.memory||'nessuna'}.`;
  const scout=await ask([{role:'user',content:`AGENTE SCOUT. ${base}\nGenera 3 opportunità realistiche a costo zero o quasi che possano aumentare il capitale. Non inventare domanda di mercato non verificata. Per ogni idea indica cosa va verificato online prima di agire.`}],600,.55);
  const critic=await ask([{role:'user',content:`AGENTE CRITICO. ${base}\nValuta duramente queste proposte dello Scout. Elimina quelle che richiedono troppo tempo, capitale, customer care o dipendono da assunzioni non verificate. Scegli massimo 2 candidati.\n\nSCOUT:\n${scout}`}],600,.25);
  const cfo=await ask([{role:'user',content:`AGENTE CFO/STRATEGA. ${base}\nSulla base dell'analisi seguente, scegli UNA prossima azione concreta eseguibile in <=15 minuti dal proprietario oppure preparabile da te. Se serve una spesa, proponila chiaramente con importo, titolo, motivo, rischio e ritorno atteso. Se non serve spendere scrivi SPESA: 0. Non fingere di poter effettuare pagamenti o pubblicazioni.\n\nANALISI:\n${critic}`}],700,.25);
  state.messages.push({role:'assistant',content:`CICLO AUTONOMO\n\n${cfo}`});
  const m=cfo.match(/SPESA\s*:\s*€?\s*(\d+(?:[.,]\d+)?)/i); const amount=m?Number(m[1].replace(',','.')):0;
  if(amount>0){state.approvals.push({id:crypto.randomUUID(),amount,title:'Spesa proposta da NOVA',reason:cfo,risk:'da valutare',humanTime:'≤15 min',status:'pending',ts:Date.now()});}
  state.lastCycle=Date.now(); save(); toast(amount>0?'NOVA richiede una tua approvazione':'Ciclo completato senza spese');
 }catch(e){toast(e.message)}finally{busy=false;$('#runCycle').textContent='Avvia ciclo AI'}
}

$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});
$('#loadModel').onclick=loadAI; $('#send').onclick=send; $('#input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}); $('#runCycle').onclick=cycle;
$('#saveMemory').onclick=()=>{state.memory=$('#memoryText').value.trim();save();toast('Memoria salvata solo sul telefono')};
$('#addTx').onclick=()=>{const amount=Number($('#txAmount').value);if(!amount||amount<=0)return toast('Inserisci un importo');const type=$('#txType').value,note=$('#txNote').value.trim();state.transactions.push({id:crypto.randomUUID(),type,amount,note,ts:Date.now()});if(type==='income')state.income+=amount;else state.spent+=amount;$('#txAmount').value='';$('#txNote').value='';save();toast('Movimento registrato')};
$('#approvalList').onclick=e=>{const b=e.target.closest('button[data-a]');if(!b)return;const a=state.approvals.find(x=>x.id===b.dataset.id);if(!a)return;if(b.dataset.a==='reject'){a.status='rejected';state.messages.push({role:'system',content:`Spesa ${eur(a.amount)} rifiutata.`});save();return}a.status='approved';state.messages.push({role:'system',content:`Spesa ${eur(a.amount)} APPROVATA. NOVA non la considera pagata finché non registri la spesa reale nella Cassa.`});save();};

if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();
