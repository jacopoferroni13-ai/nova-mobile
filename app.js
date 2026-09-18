import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const START=100, DAYS=90, K='nova_mobile_v2_state';
let engine=null, modelId=null, busy=false, activeWorker=null;
let state=load();

function fresh(){return {startedAt:Date.now(),income:0,spent:0,transactions:[],approvals:[],memory:'',messages:[{role:'system',content:'NOVA è pronta.'}],lastCycle:null,autonomy:false,autoLoad:false};}
function load(){try{return {...fresh(),...JSON.parse(localStorage.getItem(K)||'{}')}}catch{return fresh()}}
function save(){localStorage.setItem(K,JSON.stringify(state));render()}
const eur=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n||0);
const profit=()=>state.income-state.spent;
const cash=()=>START+state.income-state.spent;
const daysLeft=()=>Math.max(0,DAYS-Math.floor((Date.now()-state.startedAt)/86400000));
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3000)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function render(){
 $('#cash').textContent=eur(cash()); $('#profit').textContent=eur(profit()); $('#spent').textContent=eur(state.spent); $('#days').textContent=daysLeft();
 $('#approvalCount').textContent=state.approvals.filter(a=>a.status==='pending').length||'';
 $('#messages').innerHTML=state.messages.slice(-50).map(m=>`<div class="msg ${m.role==='user'?'user':m.role==='system'?'system':''}">${escapeHtml(m.content)}</div>`).join('');
 $('#messages').scrollTop=$('#messages').scrollHeight;
 $('#memoryText').value=state.memory||'';
 $('#approvalList').innerHTML=state.approvals.filter(a=>a.status==='pending').length?state.approvals.filter(a=>a.status==='pending').map(a=>`<div class="approval"><div class="label">RICHIESTA DI SPESA</div><div class="amount">${eur(a.amount)}</div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.reason||'')}</p><small>Rischio: ${escapeHtml(a.risk||'non stimato')} • Tempo tuo: ${escapeHtml(a.humanTime||'≤15 min')}</small><div class="actions"><button data-a="reject" data-id="${a.id}" class="danger">Rifiuta</button><button data-a="approve" data-id="${a.id}" class="primary">Approva</button></div></div>`).join(''):'<p class="muted">Nessuna spesa in attesa.</p>';
 $('#ledgerList').innerHTML=state.transactions.slice().reverse().map(t=>`<div class="tx"><div><strong>${escapeHtml(t.note||t.type)}</strong><br><small>${new Date(t.ts).toLocaleString('it-IT')}</small></div><strong class="${t.type==='income'?'plus':'minus'}">${t.type==='income'?'+':'-'}${eur(t.amount)}</strong></div>`).join('');
}

function chooseModels(){
 return [
   {id:'Llama-3.2-3B-Instruct-q4f16_1-MLC', label:'NOVA Quality • 3B', tier:'quality'},
   {id:'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label:'NOVA Balanced • 1.7B', tier:'balanced'},
   {id:'Llama-3.2-1B-Instruct-q4f32_1-MLC', label:'NOVA Basic • 1B', tier:'basic'}
 ];
}

async function getGpuInfo(){
 if(!('gpu' in navigator)) return {ok:false,reason:'WebGPU non disponibile'};
 try{const adapter=await navigator.gpu.requestAdapter();if(!adapter)return {ok:false,reason:'Nessuna GPU WebGPU compatibile'};return {ok:true,reason:'WebGPU attivo'};}
 catch(e){return {ok:false,reason:e?.message||String(e)}}
}

async function selfTest(testEngine){
 const out=await testEngine.chat.completions.create({
   messages:[
    {role:'system',content:'Rispondi esattamente con le tre parole richieste. Nessuna spiegazione.'},
    {role:'user',content:'Scrivi esattamente: NOVA TEST OK'}
   ],
   temperature:0,
   top_p:0.5,
   max_tokens:12
 });
 const text=(out.choices?.[0]?.message?.content||'').trim().toUpperCase();
 return {ok:text.includes('NOVA')&&text.includes('TEST')&&text.includes('OK'), text};
}

async function loadAI(){
 if(engine||busy)return;
 busy=true; $('#status').textContent='loading'; $('#loadModel').textContent='Caricamento…';
 const gpu=await getGpuInfo();
 if(!gpu.ok){busy=false;$('#status').textContent='no WebGPU';$('#progressText').textContent=gpu.reason;$('#loadModel').textContent='Carica AI';return}
 let errors=[];
 for(const candidate of chooseModels()){
  let worker=null, candidateEngine=null;
  try{
   $('#modelName').textContent=candidate.label;
   $('#progressText').textContent=`Scarico e verifico ${candidate.label}. Il primo avvio può richiedere alcuni minuti.`;
   worker=new Worker('./worker.js?v=6',{type:'module'});
   candidateEngine=await webllm.CreateWebWorkerMLCEngine(worker,candidate.id,{initProgressCallback:(p)=>{
    const x=Math.max(0,Math.min(1,p.progress||0));$('#progressBar').style.width=(x*100)+'%';$('#progressText').textContent=p.text||`Caricamento ${Math.round(x*100)}%`;
   }});
   $('#progressText').textContent=`${candidate.label} caricato. Eseguo test qualità…`;
   const test=await selfTest(candidateEngine);
   if(!test.ok) throw new Error('Test qualità fallito: '+(test.text||'nessuna risposta'));
   engine=candidateEngine; activeWorker=worker; modelId=candidate.id; state.autoLoad=true;
   $('#status').textContent=candidate.tier==='basic'?'basic':'local';
   $('#modelName').textContent=candidate.label;
   $('#progressText').textContent=candidate.tier==='basic'
    ?'Modalità BASIC: chat disponibile, ma il ciclo economico è bloccato perché questo modello è troppo debole per decisioni sui soldi.'
    :'AI pronta e test qualità superato.';
   $('#loadModel').textContent='AI caricata';
   state.messages.push({role:'system',content:`NOVA attiva con ${candidate.label}. Test qualità superato.`}); save(); busy=false; return;
  }catch(e){
    errors.push(candidate.label+': '+(e?.message||String(e)));
    try{if(candidateEngine)await candidateEngine.unload()}catch{}
    try{if(worker)worker.terminate()}catch{}
    candidateEngine=null;
  }
 }
 busy=false; $('#status').textContent='errore'; $('#loadModel').textContent='Riprova';
 $('#progressText').textContent='Nessun modello ha superato il test qualità. '+(errors.at(-1)||'').slice(0,220);
 state.messages.push({role:'system',content:'NOVA non ha avviato un modello affidabile. Non userò output casuali per la challenge.'}); save();
}

const SYSTEM=`Sei NOVA. Parla SEMPRE in italiano chiaro. Sei un assistente AI personale privato con una missione iniziale: aiutare il proprietario a trasformare €100 in profitto entro 90 giorni, chiedendogli massimo 15 minuti al giorno. Non promettere guadagni. Non inventare dati, ricerche, azioni, clienti, vendite o risultati. Nessuna scommessa, leva, trading speculativo, spam, inganno o attività illegali. Ogni spesa richiede approvazione umana finché il profitto netto verificato non raggiunge €1000. Se non possiedi dati aggiornati, scrivi cosa va verificato. Preferisci attività semplici, ad alta leva e bassa gestione. Sii concreto, breve e coerente.`;

async function ask(messages,max_tokens=220,temp=.15,onPartial=null){
 if(!engine)throw new Error('AI non caricata');
 const stream=await engine.chat.completions.create({
   messages:[{role:'system',content:SYSTEM},...messages],
   temperature:temp,
   top_p:.8,
   max_tokens,
   stream:true
 });
 let full='';
 for await(const chunk of stream){
  const d=chunk.choices?.[0]?.delta?.content||'';
  if(d){full+=d;if(onPartial)onPartial(full);}
 }
 return full.trim();
}

async function send(){
 const text=$('#input').value.trim(); if(!text||busy)return;
 $('#input').value=''; state.messages.push({role:'user',content:text}); state.messages.push({role:'assistant',content:'Sto ragionando…'}); save();
 const idx=state.messages.length-1;
 try{
  busy=true; $('#send').textContent='…'; $('#status').textContent='thinking';
  const context=`Cassa: ${eur(cash())}. Profitto netto: ${eur(profit())}. Giorni rimasti: ${daysLeft()}. Memoria proprietario: ${state.memory||'nessuna'}.`;
  const reply=await ask([{role:'user',content:context+'\n\nDomanda: '+text}],220,.15,(partial)=>{state.messages[idx].content=partial;render();});
  state.messages[idx].content=reply||'Non ho generato una risposta valida.'; save();
 }catch(e){state.messages[idx].role='system';state.messages[idx].content='ERRORE RISPOSTA: '+(e?.message||String(e));save();}
 finally{busy=false;$('#send').textContent='Invia';$('#status').textContent=engine?(modelId.includes('1B-')?'basic':'local'):'offline';}
}

async function cycle(){
 if(busy)return;
 if(!engine){toast('Prima carica l’AI');return}
 if(modelId&&modelId.includes('1B-')){toast('Ciclo bloccato: il modello BASIC non è abbastanza affidabile per decisioni economiche.');return}
 busy=true; $('#runCycle').textContent='Analisi in corso…'; $('#status').textContent='thinking';
 state.messages.push({role:'assistant',content:'CICLO AUTONOMO\nSto valutando la prossima mossa…'}); const idx=state.messages.length-1; render();
 try{
  const base=`Cassa ${eur(cash())}; profitto netto ${eur(profit())}; giorni rimasti ${daysLeft()}; spese ${eur(state.spent)}; incassi ${eur(state.income)}; tempo umano max 15 min/giorno; memoria: ${state.memory||'nessuna'}.`;
  const prompt=`Valuta UNA sola prossima azione. Prima pensa come SCOUT, poi come CRITICO, poi come CFO, poi scegli come STRATEGA. Non fingere di aver cercato online: se servono dati recenti indica esattamente cosa va verificato. Output finale: AZIONE / PERCHÉ / TEMPO MIO / RISCHIO / COSA VERIFICARE / SPESA. La riga finale deve essere esattamente SPESA: 0 oppure SPESA: X. Situazione: ${base}`;
  const out=await ask([{role:'user',content:prompt}],300,.12,(partial)=>{state.messages[idx].content='CICLO AUTONOMO\n\n'+partial;render();});
  state.messages[idx].content='CICLO AUTONOMO\n\n'+out;
  const m=out.match(/SPESA\s*:\s*€?\s*(\d+(?:[.,]\d+)?)/i); const amount=m?Number(m[1].replace(',','.')):0;
  if(amount>0)state.approvals.push({id:crypto.randomUUID(),amount,title:'Spesa proposta da NOVA',reason:out,risk:'da valutare',humanTime:'≤15 min',status:'pending',ts:Date.now()});
  state.lastCycle=Date.now(); save();
 }catch(e){state.messages[idx].role='system';state.messages[idx].content='ERRORE CICLO: '+(e?.message||String(e));save();}
 finally{busy=false;$('#runCycle').textContent='Avvia ciclo AI';$('#status').textContent='local';}
}

$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});
$('#loadModel').onclick=loadAI; $('#send').onclick=send; $('#input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}); $('#runCycle').onclick=cycle;
$('#saveMemory').onclick=()=>{state.memory=$('#memoryText').value.trim();save();toast('Memoria salvata sul telefono')};
$('#addTx').onclick=()=>{const amount=Number($('#txAmount').value);if(!amount||amount<=0)return toast('Inserisci un importo');const type=$('#txType').value,note=$('#txNote').value.trim();state.transactions.push({id:crypto.randomUUID(),type,amount,note,ts:Date.now()});if(type==='income')state.income+=amount;else state.spent+=amount;$('#txAmount').value='';$('#txNote').value='';save();};
$('#approvalList').onclick=e=>{const b=e.target.closest('button[data-a]');if(!b)return;const a=state.approvals.find(x=>x.id===b.dataset.id);if(!a)return;if(b.dataset.a==='reject'){a.status='rejected';state.messages.push({role:'system',content:`Spesa ${eur(a.amount)} rifiutata.`});save();return}a.status='approved';state.messages.push({role:'system',content:`Spesa ${eur(a.amount)} approvata, ma non viene conteggiata finché non registri la spesa reale.`});save();};

render();
// Dopo l'upgrade v6 richiedo un caricamento esplicito, così non parte un download da 2+ GB senza consenso.
state.autoLoad=false; localStorage.setItem(K,JSON.stringify(state));
