import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,signInWithCustomToken,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
const config={apiKey:'AIzaSyDeMwUeu-3chnjCpxzTdySFFAkv1s65sw8',authDomain:'levantamento-epi.firebaseapp.com',databaseURL:'https://levantamento-epi-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'levantamento-epi',storageBucket:'levantamento-epi.firebasestorage.app',messagingSenderId:'655234363827',appId:'1:655234363827:web:9c449858e2dad1eef29bc6'};
const auth=getAuth(initializeApp(config));
const API=String(window.WALP_API_URL||'').replace(/\/$/,'');
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entries=o=>Object.entries(o||{}).map(([id,v])=>({id,...v}));
let role=null,data={},tab='Dashboard';
async function call(action,payload={}){
  if(!API)throw Error('Backend não configurado. Verifique config.js.');
  const token=auth.currentUser?await auth.currentUser.getIdToken():null;
  let r;
  try{r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,payload})})}
  catch{throw Error('Não foi possível conectar ao backend. Verifique Render e CORS.')}
  let v;try{v=await r.json()}catch{throw Error('Resposta inválida do backend (HTTP '+r.status+').')}
  if(!r.ok)throw Error(v.error||'Erro HTTP '+r.status);return v;
}
const message=(msg,login=false)=>{(login?$('loginMsg'):$('notice')).textContent=msg||''};
const card=(label,value)=>`<div class="card"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`;
const table=(headers,rows)=>`<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}" class="muted">Nenhum registro</td></tr>`}</tbody></table>`;
const cell=(...values)=>`<tr>${values.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`;
function nav(){const pages=role==='admin'?['Dashboard','Filiais','Contêineres','Funcionários','Produtos','Movimentações','Levantamentos','Auditoria']:['Dashboard','Estoque'];$('nav').innerHTML=pages.map(x=>`<button data-tab="${x}" class="${tab===x?'active':''}">${x}</button>`).join('');$('nav').querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()})}
async function load(){data=await call(role==='admin'?'adminOverview':'viewerData');render()}
function render(){nav();$('heading').textContent=tab;$('context').textContent=role==='admin'?'Administração central':`${data.branch||''} • ${data.container?.name||''}`;$('who').textContent=role==='admin'?auth.currentUser?.email:'Consulta de contêiner';const root=$('content');if(role==='admin')return renderAdmin(root);renderViewer(root)}
function renderViewer(root){
  const products=entries(data.products);
  if(tab==='Dashboard'){
    root.innerHTML=`<div class="cards">${card('Produtos',products.length)}${card('Unidades',products.reduce((a,p)=>a+Number(p.quantidade||0),0))}${card('Estoque baixo',products.filter(p=>Number(p.quantidade||0)<=Number(p.estoqueMinimo??-1)).length)}</div><div class="panel"><h2>Contêiner autorizado</h2><p>${esc(data.container?.codigo)} — ${esc(data.container?.name)}</p><p class="muted">Acesso de consulta. Para registrar movimentações, solicite um administrador.</p></div>`;
    return;
  }
  if(tab==='Estoque'){
    root.innerHTML='<div class="panel"><h2>Estoque do contêiner</h2><div class="toolbar"><input id="search" placeholder="Pesquisar produto"></div><div id="stockTable"></div></div>';
    const draw=()=>{$('stockTable').innerHTML=table(['Código','Produto','Categoria','Tamanho','Cor','Quantidade','Unidade'],products.filter(p=>JSON.stringify(p).toLowerCase().includes($('search').value.toLowerCase())).map(p=>cell(p.codigo,p.nome||p.produto,p.categoria,p.tamanho,p.cor,p.quantidade,p.unidade||'un')))};
    $('search').oninput=draw;draw();return;
  }
}
function renderAdmin(root){
 const branches=entries(data.branches),containers=entries(data.containers),employees=entries(data.employees),products=entries(data.catalogo),movements=entries(data.movimentacoes),counts=entries(data.levantamentos);
 if(tab==='Dashboard'){root.innerHTML=`<div class="cards">${card('Filiais',branches.length)}${card('Contêineres',containers.length)}${card('Funcionários ativos',employees.filter(x=>x.active).length)}${card('Produtos',products.length)}${card('Unidades',products.reduce((a,p)=>a+Number(p.quantidade||0),0))}${card('Levantamentos pendentes',counts.filter(x=>x.status==='pending').length)}</div>`;return}
 if(tab==='Auditoria'){root.innerHTML='<div class="panel"><h2>Auditoria</h2><p>Os registros de auditoria ficam no backend. A consulta detalhada requer uma rota paginada.</p></div>';return}
 if(tab==='Movimentações'){root.innerHTML=`<div class="panel">${table(['Data','Contêiner','Matrícula','Produto','Tipo','Quantidade'],movements.sort((a,b)=>b.at-a.at).slice(0,200).map(m=>cell(new Date(m.at).toLocaleString('pt-BR'),containers.find(c=>c.id===m.containerId)?.nome,m.matricula,m.productId,m.type,m.quantity)))}</div>`;return}
 if(tab==='Levantamentos'){root.innerHTML=`<div class="panel">${table(['Data','Contêiner','Matrícula','Situação','Ação'],counts.map(c=>`<tr>${[new Date(c.at).toLocaleString('pt-BR'),containers.find(x=>x.id===c.containerId)?.nome,c.matricula,c.status].map(x=>`<td>${esc(x)}</td>`).join('')}<td>${c.status==='pending'?`<button data-approve="${esc(c.id)}">Marcar revisão</button>`:'—'}</td></tr>`))}</div>`;root.querySelectorAll('[data-approve]').forEach(b=>b.onclick=async()=>{try{await call('adminApproveCount',{id:b.dataset.approve});await load()}catch(e){message(e.message)}});return}
 const map={'Filiais':['branches',branches,['nome','codigo','active']],'Contêineres':['containers',containers,['nome','codigo','branchId','active']],'Funcionários':['employees',employees,['nome','matricula','branchId','active','pin']],'Produtos':['catalogo',products,['nome','codigo','categoria','tamanho','cor','containerId','estoqueMinimo','unidade']]};
 const [collection,items,fields]=map[tab]||[];if(!collection)return;
 root.innerHTML=`<div class="panel"><h2>${tab}</h2><div class="toolbar"><button id="newRecord">Novo cadastro</button></div>${table(['ID',...fields.filter(f=>f!=='pin')],items.map(x=>cell(x.id,...fields.filter(f=>f!=='pin').map(f=>x[f]))))}</div>${collection==='containers'?`<div class="panel"><h2>Configurar código de consulta</h2><p class="muted">Apenas consulta. Não autoriza movimentações.</p><form id="viewerCodeForm"><label>Contêiner<select name="containerId" required>${containers.map(c=>`<option value="${esc(c.id)}">${esc(c.nome||c.codigo||c.id)}</option>`).join('')}</select></label><label>Código de consulta (3 dígitos)<input name="code" inputmode="numeric" pattern="[0-9]{3}" minlength="3" maxlength="3" autocomplete="off" required></label><button>Definir código de consulta</button></form></div>`:''}<div class="panel" id="editor" hidden></div>`;
 if(collection==='containers')$('viewerCodeForm').onsubmit=async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));try{await call('adminSetViewerCode',values);message('Código de consulta definido.')}catch(err){message(err.message)}};
 $('newRecord').onclick=()=>{const box=$('editor');box.hidden=false;box.innerHTML=`<h2>Novo ${tab.toLowerCase()}</h2><form id="editForm">${fields.map(f=>`<label>${esc(f)}${f==='active'?`<select name="${f}"><option value="true">Ativo</option><option value="false">Inativo</option></select>`:`<input name="${f}" ${f==='pin'?'type="password"':''} ${['nome','matricula','branchId','containerId'].includes(f)?'required':''}>`}</label>`).join('')}<button>Salvar</button></form>${collection==='containers'?'<p class="muted">Após cadastrar, configure o código de consulta na seção acima.</p>':''}`;
 $('editForm').onsubmit=async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));if('active'in values)values.active=values.active==='true';try{const saved=await call('adminSave',{collection,data:values});message(`Registro criado: ${saved.id}`);await load()}catch(err){message(err.message)}};
 };
}
$('showAdmin').onclick=()=>{const open=$('adminLogin').hidden;$('adminLogin').hidden=!open;$('operatorLogin').hidden=open;$('showAdmin').textContent=open?'Voltar ao acesso do funcionário':'Acesso administrativo';message('',true)};
$('operatorLogin').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const p=Object.fromEntries(new FormData(e.currentTarget));const {token}=await call('loginViewer',p);await signInWithCustomToken(auth,token)}catch(err){message(err.message,true)}finally{btn.disabled=false}};
$('adminLogin').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const p=Object.fromEntries(new FormData(e.currentTarget));await signInWithEmailAndPassword(auth,p.email,p.password)}catch(err){message('Credenciais administrativas inválidas',true)}finally{btn.disabled=false}};
$('logout').onclick=()=>signOut(auth);
onAuthStateChanged(auth,async user=>{if(!user){role=null;$('workspace').hidden=true;$('login').hidden=false;return}try{const token=await user.getIdTokenResult();role=token.claims.walpRole==='viewer'?'viewer':'admin';tab='Dashboard';await load();$('login').hidden=true;$('workspace').hidden=false;message('',true)}catch(err){message(err.message,true);await signOut(auth)}});
