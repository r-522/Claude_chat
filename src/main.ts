import { EFFORTS, MODELS, type Effort, type ModelKey } from './models';
import './styles.css';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };
const AUTH_KEY = 'claude-chat-auth-until', SESSION_KEY = 'claude-chat-session', TTL = 1000*60*60*8;
let authed = Number(localStorage.getItem(AUTH_KEY) || 0) > Date.now();
let messages: Msg[] = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
let model: ModelKey = 'sonnet-5', effort: Effort = 'medium', busy = false, copied = '', error = '';

const app = document.querySelector<HTMLDivElement>('#app')!;
const esc = (s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
function inline(s:string){return esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noreferrer">$1</a>');}
function markdown(src:string){
  const lines=src.split('\n'); let html='', inCode=false, code='', inList='';
  const closeList=()=>{ if(inList){ html+=`</${inList}>`; inList=''; }};
  for(const line of lines){
    if(line.startsWith('```')){ if(inCode){html+=`<pre><code>${esc(code)}</code></pre>`; code=''; inCode=false;} else {closeList(); inCode=true;} continue; }
    if(inCode){ code+=line+'\n'; continue; }
    if(/^### /.test(line)){closeList(); html+=`<h3>${inline(line.slice(4))}</h3>`; continue;} if(/^## /.test(line)){closeList(); html+=`<h2>${inline(line.slice(3))}</h2>`; continue;} if(/^# /.test(line)){closeList(); html+=`<h1>${inline(line.slice(2))}</h1>`; continue;}
    if(/^> /.test(line)){closeList(); html+=`<blockquote>${inline(line.slice(2))}</blockquote>`; continue;}
    if(/^\|.+\|$/.test(line)){closeList(); const cells=line.split('|').slice(1,-1).map(c=>`<td>${inline(c.trim())}</td>`).join(''); html+=`<table><tbody><tr>${cells}</tr></tbody></table>`; continue;}
    const ul=line.match(/^[-*] (.+)/); if(ul){ if(inList!=='ul'){closeList(); html+='<ul>'; inList='ul';} html+=`<li>${inline(ul[1])}</li>`; continue;}
    const ol=line.match(/^\d+\. (.+)/); if(ol){ if(inList!=='ol'){closeList(); html+='<ol>'; inList='ol';} html+=`<li>${inline(ol[1])}</li>`; continue;}
    closeList(); if(line.trim()) html+=`<p>${inline(line)}</p>`;
  } closeList(); if(inCode) html+=`<pre><code>${esc(code)}</code></pre>`; return html;
}
function save(){sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));}
function render(){
  app.innerHTML = authed ? chatHtml() : loginHtml(); bind(); setTimeout(()=>document.querySelector('#end')?.scrollIntoView({block:'end'}));
}
function loginHtml(){return `<main class="login-wrap"><form class="login" id="login"><h1>Claude Chat</h1><p>アルファベット大文字・小文字・記号を含むパスコードを入力してください。</p><label for="pass">Passcode</label><div class="pass-row"><input id="pass" type="password" autocomplete="current-password" aria-invalid="${!!error}"><button type="button" id="toggle">Show</button></div>${error?`<p class="error" role="alert">${esc(error)}</p>`:''}<button class="primary" type="submit">Login</button></form></main>`}
function chatHtml(){return `<div class="app"><header><strong>Claude</strong><select aria-label="Model" id="model">${Object.entries(MODELS).map(([k,m])=>`<option value="${k}" ${k===model?'selected':''}>${m.label}</option>`).join('')}</select><select aria-label="Effort" id="effort">${EFFORTS.map(e=>`<option value="${e.value}" ${e.value===effort?'selected':''}>${e.label}</option>`).join('')}</select><button id="new">New Chat</button><button id="logout">Logout</button></header><main class="chat" aria-live="polite">${messages.length?'':`<div class="empty"><h1>Claude</h1><p>モデルを選択して、メッセージを入力してください。</p></div>`}${messages.map(m=>`<article class="msg ${m.role}"><div class="msg-head"><span>${m.role==='user'?'You':'Claude'}</span><button data-copy="${m.id}" aria-label="${m.role} message copy">${copied===m.id?'Copied':'Copy'}</button></div>${m.role==='assistant'?`<div class="markdown">${markdown(m.content||'…')}</div>`:`<p class="plain">${esc(m.content)}</p>`}</article>`).join('')}<div id="end"></div></main>${error?`<div class="notice" role="alert">${esc(error)}</div>`:''}<footer><textarea aria-label="Message" id="input" rows="1" placeholder="Message Claude…" ${busy?'disabled':''}></textarea><button class="primary" id="send" ${busy?'disabled':''}>${busy?'Sending':'Send'}</button><button id="clear">Clear</button></footer></div>`}
function bind(){
  document.querySelector('#login')?.addEventListener('submit',e=>{e.preventDefault(); const pass=(document.querySelector('#pass') as HTMLInputElement).value; if(pass==='1359'){localStorage.setItem(AUTH_KEY,String(Date.now()+TTL)); authed=true; error='';} else error='パスコードが違うようです。もう一度お試しください。'; render();});
  document.querySelector('#toggle')?.addEventListener('click',()=>{const i=document.querySelector('#pass') as HTMLInputElement; i.type=i.type==='password'?'text':'password'; (document.querySelector('#toggle') as HTMLButtonElement).textContent=i.type==='password'?'Show':'Hide';});
  document.querySelector('#model')?.addEventListener('change',e=>model=(e.target as HTMLSelectElement).value as ModelKey); document.querySelector('#effort')?.addEventListener('change',e=>effort=(e.target as HTMLSelectElement).value as Effort);
  document.querySelector('#new')?.addEventListener('click',()=>{messages=[];error='';save();render();}); document.querySelector('#logout')?.addEventListener('click',()=>{localStorage.removeItem(AUTH_KEY);authed=false;render();}); document.querySelector('#clear')?.addEventListener('click',()=>((document.querySelector('#input') as HTMLTextAreaElement).value=''));
  document.querySelector('#send')?.addEventListener('click',submit); document.querySelector('#input')?.addEventListener('input',e=>{const t=e.target as HTMLTextAreaElement; t.style.height='auto'; t.style.height=Math.min(t.scrollHeight, window.innerHeight*.34)+'px';}); document.querySelector('#input')?.addEventListener('keydown',e=>{const ev=e as KeyboardEvent; if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();submit();}});
  document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const id=(b as HTMLElement).dataset.copy!; await navigator.clipboard.writeText(messages.find(m=>m.id===id)?.content||''); copied=id; render(); setTimeout(()=>{copied='';render();},1200);}));
}
async function submit(){const input=document.querySelector('#input') as HTMLTextAreaElement; const text=input?.value.trim(); if(!text||busy)return; error=''; busy=true; input.value=''; const assistant={id:crypto.randomUUID(),role:'assistant' as const,content:''}; messages=[...messages,{id:crypto.randomUUID(),role:'user',content:text},assistant]; save(); render(); try{await sendChat(messages.slice(0,-1),(s)=>{assistant.content+=s; messages=[...messages.slice(0,-1),assistant]; save(); render();});}catch(e){error=e instanceof Error?e.message:'予期しないエラーが発生しました。'; messages=messages.slice(0,-1);} finally{busy=false; save(); render();}}
async function sendChat(ms:Msg[], onText:(s:string)=>void){const res=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,effort,messages:ms.map(({role,content})=>({role,content}))})}); if(!res.ok||!res.body){const data=await res.json().catch(()=>({})); throw new Error(data.error||'API通信に失敗しました。');} const reader=res.body.getReader(), dec=new TextDecoder(); let buf=''; while(true){const {done,value}=await reader.read(); if(done)break; buf+=dec.decode(value,{stream:true}); const events=buf.split('\n\n'); buf=events.pop()||''; for(const ev of events) for(const line of ev.split('\n')) if(line.startsWith('data: ')){const raw=line.slice(6); if(raw==='[DONE]')continue; const data=JSON.parse(raw); if(data.type==='content_block_delta'&&data.delta?.type==='text_delta') onText(data.delta.text);}}}
render();
