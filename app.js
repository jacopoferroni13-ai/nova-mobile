const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const START=100, DAYS=90, K='nova_mobile_v2_state', ENGINE_VERSION=8;
const FREE_MODELS=[
  {id:'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',label:'Nemotron 3 Nano Omni • 30B'},
  {id:'dots-studio/dots-3-note-preview:free',label:'Dots3 Note • Free'},
  {id:'inclusionai/ling-3.0-flash-vl:free',label:'Ling 3 Flash • Free'}
];
let busy=false, activeModel=null;
let state=load();

function fresh(){return {startedAt:Date.now(),income:0,spent:0,transactions:[],approvals:[],memory:'',messages:[{role:'system',content:'NOVA è pronta. Premi “Attiva NOVA” una sola volta, poi scrivimi.'}],lastCycle:null,autonomy:false,engineVersion:ENGINE_VERSION};}
function load(){
  try{
    const old={...fresh(),...JSON.parse(localStorage.getItem(K)||'{}')};
    if(old.engineVersion!==ENGINE_VERSION){
      old.messages=[{role:'system',content:'NOVA è stata aggiornata: ora usa un cervello AI online gratuito, senza scaricare modelli sul telefono.'}];
      old.engineVersion=ENGINE_VERSION;
    }
    return old;
  }catch{return fresh()}
}
function save(){localStorage.setItem(K,JSON.stringify(state));render()}
const eur=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n||0);
const profit=()=>state.income-state.spent;
const cash=()=>START+state.income-state.spent;
const daysLeft=()=>Math.max(0,DAYS-Math.floor((Date.now()-state.startedAt)/86400000));
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3200)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function errText(e){return e?.message||e?.msg||e?.error?.message||String(e||'Errore sconosciuto')}

function isConnected(){
  try{return !!window.puter && puter.auth.isSignedIn()}catch{return false}
}

function render(){
 $('#cash').textContent=eur(cash()); $('#profit').textContent=eur(profit()); $('#spent').textContent=eur(state.spent); $('#days').textContent=daysLeft();
 $('#approvalCount').textContent=state.approvals.filter(a=>a.status==='pending').length||'';
 $('#messages').innerHTML=state.messages.slice(-50).map(m=>'<div class="msg '+(m.role==='user'?'user':m.role==='system'?'system':'')+'">'+escapeHtml(m.content)+'</div>').join('');
 $('#messages').scrollTop=$('#messages').scrollHeight;
 $('#memoryText').value=state.memory||'';
 $('#approvalList').innerHTML=state.approvals.filter(a=>a.status==='pending').length?state.approvals.filter(a=>a.status==='pending').map(a=>'<div class="approval"><div class="label">RICHIESTA DI SPESA</div><div class="amount">'+eur(a.amount)+'</div><h3>'+escapeHtml(a.title)+'</h3><p>'+escapeHtml(a.reason||'')+'</p><small>Rischio: '+escapeHtml(a.risk||'da valutare')+' • Tempo tuo: '+escapeHtml(a.humanTime||'≤15 min')+'</small><div class="actions"><button data-a="reject" data-id="'+a.id+'" class="danger">Rifiuta</button><button data-a="approve" data-id="'+a.id+'" class="primary">Approva</button></div></div>').join(''):'<p class="muted">Nessuna spesa in attesa.</p>';
 $('#ledgerList').innerHTML=state.transactions.slice().reverse().map(t=>'<div class="tx"><div><strong>'+escapeHtml(t.note||t.type)+'</strong><br><small>'+new Date(t.ts).toLocaleString('it-IT')+'</small></div><strong class="'+(t.type==='income'?'plus':'minus')+'">'+(t.type==='income'?'+':'-')+eur(t.amount)+'</strong></div>').join('');
 const connected=isConnected();
 $('#status').textContent=busy?'thinking':connected?'online':'offline';
 $('#connectAI').textContent=connected?'NOVA attiva':'Attiva NOVA';
 $('#modelName').textContent=activeModel?.label||'AI cloud gratuita';
 $('#progressText').textContent=connected
   ?'Connessa. Modello: '+(activeModel?.label||'selezione automatica tra modelli $0')+'.'
   :'Nessun download e nessun server tuo. Al primo avvio NOVA chiede solo l’autorizzazione Puter.';
}

async function connectAI(){
 if(busy)return false;
 if(!window.puter){toast('Servizio AI non caricato. Ricarica la pagina.');return false}
 try{
   if(!puter.auth.isSignedIn()){
     busy=true; render();
     await puter.auth.signIn({attempt_temp_user_creation:true});
   }
   busy=false; render();
   toast('NOVA è attiva');
   return true;
 }catch(e){
   busy=false; render();
   const t=errText(e);
   if(/closed|cancel/i.test(t)) toast('Accesso annullato.');
   else if(/popup/i.test(t)) toast('Chrome ha bloccato la finestra: consenti i popup per questo sito.');
   else toast('Connessione non riuscita: '+t.slice(0,140));
   return false;
 }
}

const SYSTEM='Ti chiami NOVA. Parla SEMPRE in italiano chiaro.\\n'+
'Sei un assistente AI personale con una missione iniziale: aiutare il proprietario a trasformare €100 di capitale reale nel maggior profitto legale possibile entro 90 giorni, chiedendogli massimo 15 minuti al giorno.\\n'+
'Non promettere guadagni. Non inventare dati, ricerche, azioni, clienti, vendite o risultati.\\n'+
'Niente scommesse, leva, trading speculativo, spam, frodi o attività illegali.\\n'+
'Ogni spesa richiede approvazione umana finché il profitto netto verificato non raggiunge €1000.\\n'+
'Preferisci attività semplici, a basso capitale, alta leva e bassa gestione.\\n'+
'Se non possiedi dati attuali, scrivi chiaramente DA VERIFICARE.\\n'+
'Non dire di aver navigato sul web se non hai realmente usato uno strumento web.\\n'+
'Sii concreta e concisa.';

function extractText(resp){
 if(typeof resp==='string')return resp.trim();
 const c=resp?.message?.content ?? resp?.text ?? resp?.choices?.[0]?.message?.content ?? '';
 if(typeof c==='string')return c.trim();
 if(Array.isArray(c))return c.map(x=>x?.text||'').join('').trim();
 return '';
}

async function ai(messages){
 if(!isConnected()){
   const ok=await connectAI();
   if(!ok)throw new Error('NOVA non è connessa.');
 }
 let errors=[];
 for(const model of FREE_MODELS){
   try{
     const resp=await puter.ai.chat(messages,{model:model.id});
     const text=extractText(resp);
     if(!text)throw new Error('Risposta vuota');
     activeModel=model; render();
     return text;
   }catch(e){
     errors.push(model.label+': '+errText(e));
   }
 }
 throw new Error('I modelli gratuiti non sono disponibili in questo momento. '+errors.at(-1));
}

function situation(){
 return 'DATI REALI DELLA CHALLENGE:\\n'+
 'Cassa: '+eur(cash())+'\\n'+
 'Profitto netto verificato: '+eur(profit())+'\\n'+
 'Spese verificate: '+eur(state.spent)+'\\n'+
 'Incassi verificati: '+eur(state.income)+'\\n'+
 'Giorni rimasti: '+daysLeft()+'\\n'+
 'Tempo umano massimo: 15 minuti/giorno\\n'+
 'Memoria proprietario: '+(state.memory||'nessuna');
}

function recentContext(){
 return state.messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-8).map(m=>({role:m.role,content:m.content}));
}

async function send(){
 const text=$('#input').value.trim(); if(!text||busy)return;
 $('#input').value='';
 state.messages.push({role:'user',content:text});
 state.messages.push({role:'assistant',content:'Sto ragionando…'});
 const idx=state.messages.length-1; save();
 try{
   busy=true; $('#send').textContent='…'; render();
   const history=recentContext().slice(0,-2);
   const reply=await ai([
     {role:'system',content:SYSTEM},
     {role:'system',content:situation()},
     ...history,
     {role:'user',content:text}
   ]);
   state.messages[idx].content=reply;
   save();
 }catch(e){
   state.messages[idx].role='system';
   state.messages[idx].content='ERRORE: '+errText(e);
   save();
 }finally{
   busy=false; $('#send').textContent='Invia'; render();
 }
}

async function cycle(){
 if(busy)return;
 if(!isConnected()){
   const ok=await connectAI(); if(!ok)return;
 }
 busy=true; $('#runCycle').textContent='Analisi in corso…';
 state.messages.push({role:'assistant',content:'CICLO AUTONOMO\\nSto valutando la prossima mossa…'});
 const idx=state.messages.length-1; save();
 try{
   const prompt='Esegui UN ciclo decisionale per la missione economica.\\n'+
   'Ragiona internamente come SCOUT (opportunità), CRITICO (elimina idee deboli), CFO (protegge i €100), STRATEGA (sceglie UNA sola prossima azione).\\n'+
   'Non fingere ricerche online. Se servono dati recenti scrivi DA VERIFICARE.\\n'+
   'Output breve con esattamente:\\nAZIONE:\\nPERCHÉ:\\nTEMPO MIO:\\nRISCHIO:\\nRISULTATO ATTESO:\\nDA VERIFICARE:\\nSPESA: 0\\n'+
   'Se serve una spesa sostituisci 0 con il solo numero in euro.\\n'+situation();
   const out=await ai([{role:'system',content:SYSTEM},{role:'user',content:prompt}]);
   state.messages[idx].content='CICLO AUTONOMO\\n\\n'+out;
   const m=out.match(/SPESA\\s*:\\s*€?\\s*(\\d+(?:[.,]\\d+)?)/i);
   const amount=m?Number(m[1].replace(',','.')):0;
   if(amount>0)state.approvals.push({id:crypto.randomUUID(),amount,title:'Spesa proposta da NOVA',reason:out,risk:'da valutare',humanTime:'≤15 min',status:'pending',ts:Date.now()});
   state.lastCycle=Date.now(); save();
 }catch(e){
   state.messages[idx].role='system';
   state.messages[idx].content='ERRORE CICLO: '+errText(e);
   save();
 }finally{
   busy=false; $('#runCycle').textContent='Avvia ciclo AI'; render();
 }
}

$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});
$('#connectAI').onclick=connectAI;
$('#send').onclick=send;
$('#input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
$('#runCycle').onclick=cycle;
$('#saveMemory').onclick=()=>{state.memory=$('#memoryText').value.trim();save();toast('Memoria salvata sul telefono')};
$('#addTx').onclick=()=>{const amount=Number($('#txAmount').value);if(!amount||amount<=0)return toast('Inserisci un importo');const type=$('#txType').value,note=$('#txNote').value.trim();state.transactions.push({id:crypto.randomUUID(),type,amount,note,ts:Date.now()});if(type==='income')state.income+=amount;else state.spent+=amount;$('#txAmount').value='';$('#txNote').value='';save();};
$('#approvalList').onclick=e=>{const b=e.target.closest('button[data-a]');if(!b)return;const a=state.approvals.find(x=>x.id===b.dataset.id);if(!a)return;if(b.dataset.a==='reject'){a.status='rejected';state.messages.push({role:'system',content:'Spesa '+eur(a.amount)+' rifiutata.'});save();return}a.status='approved';state.messages.push({role:'system',content:'Spesa '+eur(a.amount)+' approvata, ma non viene conteggiata finché non registri la spesa reale.'});save();};

save();
setTimeout(render,500);