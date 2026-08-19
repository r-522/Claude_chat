import { EFFORTS, MODELS, type Effort, type ModelKey } from './models';
import './styles.css';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };
const AUTH_KEY = 'claude-chat-auth-until', SESSION_KEY = 'claude-chat-session', TTL = 1000*60*60*8;
let authed = Number(localStorage.getItem(AUTH_KEY) || 0) > Date.now();
let messages: Msg[] = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
let model: ModelKey = 'sonnet-5', effort: Effort = 'medium', busy = false;
let shouldScrollToEnd = false;

const app = document.querySelector<HTMLDivElement>('#app')!;
const esc = (s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
function inline(s:string){return esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank">$1</a>');}
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
  app.innerHTML = authed ? chatHtml() : loginHtml(); bind(); 
  if(shouldScrollToEnd){
    setTimeout(()=>document.querySelector('#end')?.scrollIntoView({block:'end'}));
    shouldScrollToEnd = false;
  }
}
function loginHtml(){return `<main class="login-wrap"><form class="login" id="login"><h1>Claude Chat</h1><p>アルファベット大文字・小文字・記号を含むパスコードを入力してください</p><div class="input-group"><input id="pass" type="password" placeholder="パスコード" autocomplete="off"><button type="button" id="toggle">👁</button></div><button type="submit">ログイン</button></form></main>`;}
function chatHtml(){return `<div class="app"><header><strong>Claude</strong><select aria-label="Model" id="model">${Object.entries(MODELS).map(([k,m])=>`<option value="${k}" ${k===model?'selected':''}>${m.label}</option>`).join('')}</select><select aria-label="Effort" id="effort">${EFFORTS.map(e=>`<option value="${e.value}" ${e.value===effort?'selected':''}>${e.label}</option>`).join('')}</select><button id="new">New Chat</button><button id="logout">ログアウト</button></header><div class="messages">${messages.map(m=>`<div class="msg ${m.role}"><div class="content">${markdown(m.content)}</div><button class="copy-btn" data-copy="${m.id}">Copy</button></div>`).join('')}${busy?'<div class="msg assistant"><div class="content"><em>入力中...</em></div></div>':''}</div><div id="end"></div><footer><textarea id="input" placeholder="メッセージを入力..." rows="3"></textarea><button id="send">Send</button></footer></div>`;}
function bind(){
  document.querySelector('#login')?.addEventListener('submit',e=>{e.preventDefault(); const pass=(document.querySelector('#pass') as HTMLInputElement).value; if(pass==='1359'){localStorage.setItem(AUTH_KEY, String(Date.now()+TTL)); authed=true; render();} else {alert('パスコードが正しくありません');}}); 
  document.querySelector('#toggle')?.addEventListener('click',()=>{const i=document.querySelector('#pass') as HTMLInputElement; i.type=i.type==='password'?'text':'password'; (document.querySelector('#toggle') as HTMLElement).textContent=(i.type==='password'?'👁':'🙈');});
  document.querySelector('#model')?.addEventListener('change',e=>model=(e.target as HTMLSelectElement).value as ModelKey); document.querySelector('#effort')?.addEventListener('change',e=>effort=(e.target as HTMLSelectElement).value as Effort);
  document.querySelector('#new')?.addEventListener('click',()=>{messages=[];error='';save();render();}); document.querySelector('#logout')?.addEventListener('click',()=>{localStorage.removeItem(AUTH_KEY); authed=false; messages=[]; error=''; render();});
  document.querySelector('#send')?.addEventListener('click',submit); document.querySelector('#input')?.addEventListener('input',e=>{const t=e.target as HTMLTextAreaElement; t.style.height='auto'; t.style.height=Math.min(t.scrollHeight, 150)+'px';});
  document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async(e)=>{e.stopPropagation(); const id=(b as HTMLElement).dataset.copy!; const msg=messages.find(m=>m.id===id); if(!msg)return; try{await navigator.clipboard.writeText(msg.content); (b as HTMLElement).textContent='Copied!'; setTimeout(()=>(b as HTMLElement).textContent='Copy', 2000);}catch{alert('コピーに失敗しました');}}));
}
let error = '';
async function submit(){const input=document.querySelector('#input') as HTMLTextAreaElement; const text=input?.value.trim(); if(!text||busy)return; error=''; busy=true; input.value=''; const assis={id:String(Date.now()),role:'assistant' as const,content:''}; messages.push({id:String(Date.now()+1),role:'user',content:text}, assis); shouldScrollToEnd=true; render(); await sendChat(messages, s=>{assis.content=s; save(); render();});}
async function sendChat(ms:Msg[], onText:(s:string)=>void){const res=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,effort,messages:ms.slice(0,-1).map(m=>({role:m.role,content:m.content}))})}); if(!res.ok){error=await res.text(); render(); busy=false; return;}const reader=res.body?.getReader(); if(!reader){busy=false; return;} let buffer=''; try{while(true){const{done,value}=await reader.read(); if(done)break; buffer+=new TextDecoder().decode(value); let i; while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i); buffer=buffer.slice(i+1); if(line.startsWith('data:')){const data=line.slice(5).trim(); if(data==='[DONE]')break; try{const e=JSON.parse(data); if(e.type==='content_block_delta'&&e.delta?.type==='text_delta'){onText(e.delta.text);}}catch{}}}} }catch(e){console.error('Stream error',e);} busy=false; error=''; save(); render();}
render();
