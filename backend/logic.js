'use strict';
const admin=require('firebase-admin');
const crypto=require('node:crypto');
if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)console.warn('Configure FIREBASE_SERVICE_ACCOUNT_JSON no Render antes de utilizar o banco.');
const options=process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? {credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),databaseURL:process.env.FIREBASE_DATABASE_URL}
  : {credential:admin.credential.applicationDefault(),databaseURL:process.env.FIREBASE_DATABASE_URL};
admin.initializeApp(options);
const db=admin.database();
const fail=(status,msg)=>Object.assign(new Error(msg),{status});
const clean=s=>String(s??'').trim();
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const uid=()=>crypto.randomUUID();
const now=()=>Date.now();
async function identity(req){const match=/^Bearer (.+)$/.exec(req.headers.authorization||'');if(!match)throw fail(401,'Sessão necessária');return admin.auth().verifyIdToken(match[1],true)}
async function adminOnly(req){const who=await identity(req);const rec=await db.ref(`admins/${who.uid}`).get();if(!rec.exists()||rec.val().active!==true)throw fail(403,'Acesso negado');return who}
async function operator(req){const who=await identity(req);if(who.walpRole!=='operator'||!who.containerId||!who.employeeId)throw fail(403,'Acesso negado');const [emp,container,permission]=await Promise.all([db.ref(`employees/${who.employeeId}`).get(),db.ref(`containers/${who.containerId}`).get(),db.ref(`permissions/${who.employeeId}/${who.containerId}`).get()]);if(!emp.exists()||!container.exists()||emp.val().active!==true||container.val().active!==true||permission.val()!==true)throw fail(403,'Acesso revogado');return {...who,employee:emp.val(),container:container.val()}}
async function viewer(req){const who=await identity(req);if(who.walpRole!=='viewer'||!who.containerId)throw fail(403,'Acesso negado');const c=await db.ref(`containers/${who.containerId}`).get();if(!c.exists()||c.val().active!==true||!c.val().viewerAccessHash)throw fail(403,'Acesso revogado');if(who.viewerAccessHash!==c.val().viewerAccessHash)throw fail(403,'Acesso revogado');return {...who,container:c.val()}}
async function log(action,actor,containerId,detail={}){await db.ref(`audit/${uid()}`).set({action,actor,containerId:containerId||null,detail,at:now()})}
const response=(res,code,data)=>res.status(code).json(data);
const attempts=new Map();
const api=async(req,res)=>{try{
 if(req.method!=='POST')throw fail(405,'Método não permitido');
 const {action,payload={}}=req.body||{};
 // O código curto permite consulta limitada; nunca autoriza movimentações.
 if(action==='loginViewer'){
   const code=clean(payload.code),ip=clean(req.ip);
   if(!/^[0-9]{3}$/.test(code))throw fail(401,'Código inválido');
   const key=hash('viewer|'+ip),a=attempts.get(key)||{count:0,until:0};
   if(a.until>now())throw fail(429,'Muitas tentativas. Tente mais tarde.');
   // Janela conservadora por IP; para produção, adicionar proteção distribuída no edge.
   a.count++; if(a.count>=5)a.until=now()+60*60*1000;
   attempts.set(key,a);
   const h=hash(code),indexRef=db.ref(`viewerCodeIndex/${h}`);
   const index=await indexRef.get();
   let containerId=index.exists()?index.val():null;
   let container=containerId?await db.ref(`containers/${containerId}`).get():null;
   // Recupera índices ausentes após migração, mas APENAS quando um administrador
   // já configurou este código no próprio contêiner. Nunca usa 'codigo' público.
   if(!containerId){
     const matches=await db.ref('containers').get();
     const candidates=Object.entries(matches.val()||{}).filter(([,v])=>v&&v.active===true&&v.viewerAccessHash===h);
     if(candidates.length===1){
       containerId=candidates[0][0];
       container=await db.ref(`containers/${containerId}`).get();
       const claim=await indexRef.transaction(v=>v===null?containerId:undefined);
       if(!claim.committed){const current=await indexRef.get();if(current.val()!==containerId)throw fail(401,'Código inválido')}
     }
   }
   if(!containerId||!container?.exists()||container.val().active!==true||container.val().viewerAccessHash!==h)throw fail(401,'Código inválido. Peça ao administrador para salvar o código de consulta deste contêiner.');
   attempts.delete(key);
   const token=await admin.auth().createCustomToken(`walp-viewer-${containerId}`,{walpRole:'viewer',containerId,viewerAccessHash:h});
   await log('viewerLogin','containerViewer',containerId);
   return response(res,200,{token});
 }
 if(action==='viewerData'){
   const who=await viewer(req);
   const [catalog,branch,movs]=await Promise.all([db.ref('catalogo').get(),db.ref(`branches/${who.container.branchId}`).get(),db.ref('movimentacoes').get()]);
   const products=Object.fromEntries(Object.entries(catalog.val()||{}).filter(([,p])=>p&&p.containerId===who.containerId));
   return response(res,200,{container:{id:who.containerId,name:who.container.nome,codigo:who.container.codigo},branch:branch.val()?.nome||'',products,movements:Object.fromEntries(Object.entries(movs.val()||{}).filter(([,m])=>m?.containerId===who.containerId).sort((a,b)=>(b[1].at||0)-(a[1].at||0)).slice(0,50))});
 }
 if(action==='viewerMovement'){
   const who=await viewer(req);
   const productId=clean(payload.productId),type=clean(payload.type),amount=Number(payload.quantity),requestId=clean(payload.requestId);
   if(!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)||!['entrada','saida'].includes(type)||!Number.isSafeInteger(amount)||amount<1||amount>100000)throw fail(400,'Movimentação inválida');
   const pRef=db.ref(`catalogo/${productId}`),snapshot=await pRef.get();
   if(!snapshot.exists()||snapshot.val().containerId!==who.containerId)throw fail(403,'Produto não pertence ao contêiner');
   const key=db.ref(`operationKeys/${requestId}`);
   const claim=await key.transaction(v=>v===null?{containerId:who.containerId,at:now(),status:'processing'}:undefined);
   if(!claim.committed)throw fail(409,'Esta movimentação já foi enviada. Atualize o estoque antes de tentar novamente.');
   let before=0,after=0;
   try{
     const tx=await pRef.transaction(v=>{
       if(!v||v.containerId!==who.containerId)return;
       const qty=Number(v.quantidade??0);
       if(!Number.isSafeInteger(qty)||qty<0)return;
       const next=qty+(type==='entrada'?amount:-amount);
       if(next<0)return;
       before=qty;after=next;
       return {...v,quantidade:next,updatedAt:now()};
     });
     if(!tx.committed)throw fail(409,'Estoque insuficiente ou produto inválido');
     const movement={id:requestId,containerId:who.containerId,branchId:who.container.branchId,productId,type,quantity:amount,before,after,at:now(),note:clean(payload.note).slice(0,300),source:'codigo-conteiner'};
     await db.ref().update({[`movimentacoes/${requestId}`]:movement,[`operationKeys/${requestId}/status`]:'done'});
     await log('viewerMovement','codigo-conteiner',who.containerId,{requestId,type,productId});
     return response(res,200,movement);
   }catch(e){await key.child('status').set('needsReview');throw e}
 }

 if(action==='viewerCreateProduct'){
   const who=await viewer(req),nome=clean(payload.nome).slice(0,120),codigo=clean(payload.codigo).slice(0,60),quantidade=Number(payload.quantidade??0);
   if(!nome||!codigo||!Number.isSafeInteger(quantidade)||quantidade<0||quantidade>1000000)throw fail(400,'Dados do produto inválidos');
   const catalog=await db.ref('catalogo').get();
   if(Object.values(catalog.val()||{}).some(p=>p?.containerId===who.containerId&&clean(p.codigo).toLowerCase()===codigo.toLowerCase()))throw fail(409,'Código já cadastrado neste contêiner');
   const id=uid(),at=now();
   await db.ref('catalogo/'+id).set({nome,codigo,quantidade,containerId:who.containerId,categoria:clean(payload.categoria).slice(0,80),tamanho:clean(payload.tamanho).slice(0,40),cor:clean(payload.cor).slice(0,40),unidade:clean(payload.unidade).slice(0,20)||'un',createdAt:at,updatedAt:at});
   await log('viewerCreateProduct','codigo-conteiner',who.containerId,{id,codigo});
   return response(res,200,{id,ok:true});
 }
 if(action==='viewerCount'){
   const who=await viewer(req),productId=clean(payload.productId),quantity=Number(payload.quantity);
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(productId)||!Number.isSafeInteger(quantity)||quantity<0||quantity>1000000)throw fail(400,'Dados do levantamento inválidos');
   const ref=db.ref('catalogo/'+productId);let before=0;
   const tx=await ref.transaction(p=>{if(!p||p.containerId!==who.containerId)return;before=Number(p.quantidade||0);return {...p,quantidade:quantity,updatedAt:now()}});
   if(!tx.committed)throw fail(403,'Produto não pertence ao contêiner');
   const id=uid(),at=now();
   await db.ref().update({['levantamentos/'+id]:{id,containerId:who.containerId,branchId:who.container.branchId,productId,before,after:quantity,at,status:'completed',source:'codigo-conteiner'},['movimentacoes/'+id]:{id,containerId:who.containerId,branchId:who.container.branchId,productId,type:'levantamento',quantity:quantity-before,before,after:quantity,at,source:'codigo-conteiner'}});
   await log('viewerCount','codigo-conteiner',who.containerId,{id,productId,before,after:quantity});
   return response(res,200,{id,before,after:quantity});
 }
 if(action==='adminSetViewerCode'){
   const who=await adminOnly(req),containerId=clean(payload.containerId),code=clean(payload.code);
   if(!/^[0-9]{3}$/.test(code))throw fail(400,'O código de consulta deve ter exatamente 3 dígitos');
   const ref=db.ref(`containers/${containerId}`),snap=await ref.get();if(!snap.exists())throw fail(404,'Contêiner não encontrado');
   const h=hash(code),indexRef=db.ref(`viewerCodeIndex/${h}`);
   // Não permite que dois contêineres reservem o mesmo código simultaneamente.
   const claim=await indexRef.transaction(v=>v===null||v===containerId?containerId:undefined);
   if(!claim.committed)throw fail(409,'Código já utilizado por outro contêiner');
   const old=snap.val().viewerAccessHash;
   try{
     await db.ref(`containers/${containerId}`).update({viewerAccessHash:h});
     if(old&&old!==h){
       const oldRef=db.ref(`viewerCodeIndex/${old}`),previous=await oldRef.get();
       if(previous.val()===containerId)await oldRef.remove();
     }
   }catch(e){
     if(old!==h){const current=await indexRef.get();if(current.val()===containerId)await indexRef.remove()}
     throw e;
   }
   await log('viewerCodeChanged',who.uid,containerId);return response(res,200,{ok:true});
 }
 // Login de operador antigo mantido para compatibilidade; a interface pública não o utiliza.
 if(action==='loginOperator'){
   const ip=clean(req.ip),key=hash(ip+'|'+clean(payload.matricula));const a=attempts.get(key)||{count:0,until:0};if(a.until>now())throw fail(429,'Tente novamente mais tarde');
   try{
     const code=clean(payload.code),matricula=clean(payload.matricula),pin=clean(payload.pin);if(!code||!matricula||!pin)throw fail(401,'Credenciais inválidas');
     const codeHash=hash(code),idx=await db.ref(`containerAccessIndex/${codeHash}`).get();if(!idx.exists())throw fail(401,'Credenciais inválidas');
     const containerId=idx.val(),container=await db.ref(`containers/${containerId}`).get(),empIdx=await db.ref(`employeeMatriculas/${hash(matricula)}`).get();
     if(!container.exists()||container.val().active!==true||!empIdx.exists())throw fail(401,'Credenciais inválidas');
     const employeeId=empIdx.val();const [emp,allowed]=await Promise.all([db.ref(`employees/${employeeId}`).get(),db.ref(`permissions/${employeeId}/${containerId}`).get()]);
     if(!emp.exists()||emp.val().active!==true||allowed.val()!==true)throw fail(401,'Credenciais inválidas');
     const pinHash=crypto.scryptSync(pin,Buffer.from(emp.val().pinSalt,'hex'),64),expected=Buffer.from(emp.val().pinHash,'hex');
     if(expected.length!==pinHash.length||!crypto.timingSafeEqual(pinHash,expected))throw fail(401,'Credenciais inválidas');
     attempts.delete(key);const token=await admin.auth().createCustomToken(`walp-op-${employeeId}-${containerId}`,{walpRole:'operator',employeeId,containerId});await log('login',employeeId,containerId);return response(res,200,{token});
   }catch(e){a.count++;a.until=a.count>=5?now()+15*60*1000:0;attempts.set(key,a);throw e.status===429?e:fail(401,'Credenciais inválidas')}
 }
 if(action==='adminOverview'||action==='adminList'){
   await adminOnly(req);const paths=['branches','containers','catalogo','movimentacoes','levantamentos'];const values=await Promise.all(paths.map(p=>db.ref(p).get()));
   return response(res,200,Object.fromEntries(paths.map((p,i)=>[p,values[i].val()||{}])));
 }
 if(action==='adminSave'){
   const who=await adminOnly(req),{collection,id,data}=payload;
   const allowed=['branches','containers','catalogo'];if(!allowed.includes(collection)||!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'Dados inválidos');
   const recordId=clean(id)||uid();if(!/^[a-zA-Z0-9_-]{1,100}$/.test(recordId))throw fail(400,'ID inválido');
   const safe={...data};delete safe.pinHash;delete safe.pinSalt;delete safe.accessCode;delete safe.codeHash;delete safe.viewerAccessHash;delete safe.stock;delete safe.quantity;
   if(collection==='employees'){
     const matricula=clean(data.matricula);if(!matricula)throw fail(400,'Matrícula obrigatória');
     const previous=await db.ref(`employees/${recordId}`).get(),old=previous.val();if(old?.matricula&&old.matricula!==matricula)throw fail(400,'Matrícula não pode ser alterada');
     const idx=await db.ref(`employeeMatriculas/${hash(matricula)}`).get();if(idx.exists()&&idx.val()!==recordId)throw fail(409,'Matrícula já cadastrada');
     await db.ref(`employeeMatriculas/${hash(matricula)}`).set(recordId);safe.matricula=matricula;
     if(old){safe.pinHash=old.pinHash;safe.pinSalt=old.pinSalt}
     if(data.pin){const salt=crypto.randomBytes(16);safe.pinSalt=salt.toString('hex');safe.pinHash=crypto.scryptSync(String(data.pin),salt,64).toString('hex')}
     delete safe.pin;
   }
   if(collection==='containers'){
     const old=(await db.ref(`containers/${recordId}`).get()).val();
     const newBranchId=clean(data.branchId);
     if(!/^[a-zA-Z0-9_-]{1,100}$/.test(newBranchId))throw fail(400,'Filial inválida');
     const branch=await db.ref(`branches/${newBranchId}`).get();
     if(!branch.exists()||branch.val().active===false)throw fail(400,'Selecione uma filial ativa');
     safe.branchId=newBranchId;
     if(old?.branchId&&old.branchId!==newBranchId){
       // Apenas administradores autorizados podem transferir. Preserva o histórico anterior.
       await db.ref(`containers/${recordId}`).update({...safe,updatedAt:now()});
       await log('containerBranchTransferred',who.uid,recordId,{fromBranchId:old.branchId,toBranchId:newBranchId});
       return response(res,200,{id:recordId,transferred:true});
     }
   }
   if(collection==='catalogo'){
     if(!clean(data.containerId)||(await db.ref(`containers/${data.containerId}`).get()).exists()===false)throw fail(400,'Contêiner inválido');
     const old=(await db.ref(`catalogo/${recordId}`).get()).val();if(old?.containerId&&old.containerId!==data.containerId)throw fail(400,'Transferência exige operação específica');
   }
   await db.ref(`${collection}/${recordId}`).update({...safe,updatedAt:now()});
   await log('adminSave',who.uid,collection==='containers'?recordId:safe.containerId,{collection,recordId});return response(res,200,{id:recordId});
 }
 if(action==='adminDelete'){
   const who=await adminOnly(req),collection=clean(payload.collection),id=clean(payload.id);
   if(!['branches','containers'].includes(collection)||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw fail(400,'Exclusão inválida');
   const ref=db.ref(`${collection}/${id}`),snap=await ref.get();if(!snap.exists())throw fail(404,'Registro não encontrado');
   // Exclusão só de cadastros vazios: preserva estoque, histórico, funcionários e auditoria.
   const [containers,employees,products,movements,counts]=await Promise.all(['containers','employees','catalogo','movimentacoes','levantamentos'].map(path=>db.ref(path).get()));
   const list=s=>Object.values(s.val()||{});
   if(collection==='branches'){
     if(list(containers).some(x=>x.branchId===id)||list(employees).some(x=>x.branchId===id)||list(movements).some(x=>x.branchId===id)||list(counts).some(x=>x.branchId===id))throw fail(409,'Esta filial possui contêineres, funcionários ou histórico. Remova os vínculos antes de apagar.');
     await log('adminDelete',who.uid,null,{collection,id});await ref.remove();return response(res,200,{ok:true});
   }
   if(list(products).some(x=>x.containerId===id)||list(movements).some(x=>x.containerId===id)||list(counts).some(x=>x.containerId===id))throw fail(409,'Este contêiner possui produtos ou histórico. Não é possível apagá-lo; marque-o como Inativo em Editar.');
   const [permissions,operationKeys]=await Promise.all([db.ref('permissions').get(),db.ref('operationKeys').get()]);
   if(Object.values(permissions.val()||{}).some(p=>p&&p[id]===true)||Object.values(operationKeys.val()||{}).some(v=>v?.containerId===id))throw fail(409,'Este contêiner tem permissões ou operações vinculadas. Marque-o como Inativo.');
   const updates={[`containers/${id}`]:null};
   if(snap.val().viewerAccessHash)updates[`viewerCodeIndex/${snap.val().viewerAccessHash}`]=null;
   if(snap.val().accessHash)updates[`containerAccessIndex/${snap.val().accessHash}`]=null;
   await log('adminDelete',who.uid,id,{collection,id});await db.ref().update(updates);
   return response(res,200,{ok:true});
 }
 if(action==='adminSetAccess'){
   const who=await adminOnly(req),containerId=clean(payload.containerId),code=clean(payload.code);if(code.length<16)throw fail(400,'Código deve ter pelo menos 16 caracteres');
   const c=await db.ref(`containers/${containerId}`).get();if(!c.exists())throw fail(404,'Contêiner não encontrado');
   const h=hash(code),existing=await db.ref(`containerAccessIndex/${h}`).get();if(existing.exists()&&existing.val()!==containerId)throw fail(409,'Código em uso');
   const old=c.val().accessHash,updates={[`containerAccessIndex/${h}`]:containerId,[`containers/${containerId}/accessHash`]:h};if(old&&old!==h)updates[`containerAccessIndex/${old}`]=null;
   await db.ref().update(updates);await log('accessCodeRotated',who.uid,containerId);return response(res,200,{ok:true});
 }
 if(action==='adminPermission'){
   const who=await adminOnly(req),employeeId=clean(payload.employeeId),containerId=clean(payload.containerId);
   if(!(await db.ref(`employees/${employeeId}`).get()).exists()||!(await db.ref(`containers/${containerId}`).get()).exists())throw fail(404,'Registro não encontrado');
   await db.ref(`permissions/${employeeId}/${containerId}`).set(payload.allowed===true);await log('permissionChanged',who.uid,containerId,{employeeId,allowed:payload.allowed===true});return response(res,200,{ok:true});
 }
 if(action==='operatorData'){
   const who=await operator(req),[catalog,movements,counts,branch]=await Promise.all([db.ref('catalogo').orderByChild('containerId').equalTo(who.containerId).get(),db.ref('movimentacoes').orderByChild('containerId').equalTo(who.containerId).limitToLast(100).get(),db.ref('levantamentos').orderByChild('containerId').equalTo(who.containerId).limitToLast(30).get(),db.ref(`branches/${who.container.branchId}`).get()]);
   return response(res,200,{employee:{name:who.employee.nome,matricula:who.employee.matricula},container:{id:who.containerId,name:who.container.nome,codigo:who.container.codigo},branch:branch.val()?.nome||'',products:catalog.val()||{},movements:movements.val()||{},counts:counts.val()||{}});
 }
 if(action==='movement'){
   const who=await operator(req),productId=clean(payload.productId),type=clean(payload.type),amount=Number(payload.quantity),requestId=clean(payload.requestId);
   if(!['entrada','saida'].includes(type)||!Number.isSafeInteger(amount)||amount<=0||!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))throw fail(400,'Movimentação inválida');
   const pRef=db.ref(`catalogo/${productId}`),p=await pRef.get();if(!p.exists()||p.val().containerId!==who.containerId)throw fail(403,'Produto não autorizado');
   const idem=db.ref(`operationKeys/${requestId}`),claim=await idem.transaction(v=>v===null?{employeeId:who.employeeId,at:now(),status:'processing'}:undefined);
   if(!claim.committed)throw fail(409,'Operação já recebida');
   let before,after;
   try{
     const tx=await pRef.transaction(v=>{if(!v||v.containerId!==who.containerId)return;const qty=Number(v.quantidade??0);if(!Number.isSafeInteger(qty)||qty<0)return;const next=qty+(type==='entrada'?amount:-amount);if(next<0)return;before=qty;after=next;return {...v,quantidade:next}});
     if(!tx.committed)throw fail(409,'Estoque insuficiente ou produto inválido');
     const movement={id:requestId,containerId:who.containerId,branchId:who.container.branchId,employeeId:who.employeeId,matricula:who.employee.matricula,productId,type,quantity:amount,before,after,at:now(),note:clean(payload.note).slice(0,500)};
     await db.ref().update({[`movimentacoes/${requestId}`]:movement,[`operationKeys/${requestId}/status`]:'done'});
     await log('movement',who.employeeId,who.containerId,{requestId});return response(res,200,movement);
   }catch(e){await idem.child('status').set('needsReview');throw e}
 }
 if(action==='submitCount'){
   const who=await operator(req),items=payload.items;if(!items||typeof items!=='object'||Array.isArray(items)||Object.keys(items).length>1000)throw fail(400,'Levantamento inválido');
   const products=(await db.ref('catalogo').orderByChild('containerId').equalTo(who.containerId).get()).val()||{},lines={};
   for(const [id,qty] of Object.entries(items)){if(!products[id]||!Number.isSafeInteger(qty)||qty<0)throw fail(400,'Quantidade ou produto inválido');lines[id]={physical:qty,recorded:Number(products[id].quantidade||0),difference:qty-Number(products[id].quantidade||0)}}
   const id=uid();await db.ref(`levantamentos/${id}`).set({id,containerId:who.containerId,branchId:who.container.branchId,employeeId:who.employeeId,matricula:who.employee.matricula,at:now(),status:'pending',items:lines});
   await log('countSubmitted',who.employeeId,who.containerId,{id});return response(res,200,{id});
 }
 if(action==='adminApproveCount'){
   const who=await adminOnly(req),id=clean(payload.id),snap=await db.ref(`levantamentos/${id}`).get();
   if(!snap.exists()||snap.val().status!=='pending')throw fail(409,'Levantamento não está pendente');
   await db.ref(`levantamentos/${id}`).update({status:'approvedForReview',reviewedBy:who.uid,reviewedAt:now()});
   await log('countReviewed',who.uid,snap.val().containerId,{id});return response(res,200,{ok:true,note:'Aprovação registrada; ajustes de estoque não são aplicados automaticamente'});
 }
 throw fail(404,'Ação desconhecida');
}catch(e){console.error(e);return response(res,e.status||500,{error:e.status?e.message:'Erro interno'})}};
module.exports={api};
