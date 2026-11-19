'use strict';
const requestForm=document.getElementById('request-form');
const confirmForm=document.getElementById('confirm-form');
const feedback=document.getElementById('password-feedback');
const title=document.getElementById('title');
const instructions=document.getElementById('instructions');
const params=new URLSearchParams(location.hash.slice(1));
let nativeToken=params.get('token')||'';
let userID=params.get('userID')||'';
let verificationCode=params.get('code')||'';
// The sensitive verification code must never remain in navigation history.
history.replaceState(null,'',location.pathname);
if(!/^[a-f0-9]{64}$/.test(nativeToken))nativeToken='';
if(!/^[a-zA-Z0-9_-]{1,200}$/.test(userID)||
  verificationCode.length<4||verificationCode.length>256){
  userID='';verificationCode='';
}
let authMode='';
let configured=false;
requestForm.hidden=true;
confirmForm.hidden=true;

const hasValidLink=()=>authMode==='zitadel'?Boolean(userID&&verificationCode):Boolean(nativeToken);

fetch('/api/native/config',{cache:'no-store',credentials:'same-origin',headers:{accept:'application/json'}})
  .then(r=>r.ok?r.json():null)
  .then(data=>{
    if(!data?.ok||!data.passwordRecovery){
      instructions.textContent='Recuperação de senha ainda não habilitada neste ambiente. Entre em contato com a equipe USBRIN.';
      return;
    }
    authMode=data.mode;
    configured=true;
    if(hasValidLink()){
      confirmForm.hidden=false;
      title.textContent='Escolha sua nova senha';
      instructions.textContent='Crie uma nova senha para entrar na USBRIN ID.';
    }else{
      requestForm.hidden=false;
    }
  })
  .catch(()=>{instructions.textContent='Não foi possível verificar o serviço de recuperação. Tente novamente mais tarde.';});

async function post(path,data){
  const response=await fetch(path,{
    method:'POST',credentials:'same-origin',cache:'no-store',redirect:'manual',
    headers:{'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify(data)
  });
  if(response.type==='opaqueredirect')throw Error('Este ambiente ainda não permite acesso próprio.');
  const result=response.headers.get('content-type')?.includes('application/json')?await response.json():null;
  if(!response.ok||!result?.ok)throw Error(
    response.status===429?'Muitas solicitações. Tente novamente mais tarde.':
    result?.error||'Não foi possível concluir a solicitação.'
  );
  return result;
}
function pending(button,yes){
  button.disabled=yes;
  button.textContent=yes?'Processando…':button.dataset.label;
}
for(const form of [requestForm,confirmForm])form.querySelector('button').dataset.label=form.querySelector('button').textContent;

requestForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!configured)return;
  const button=document.getElementById('request-submit');
  if(button.disabled)return;
  pending(button,true);feedback.textContent='';
  try{
    await post('/api/native/password/request',{email:requestForm.elements.email.value.trim()});
    feedback.textContent='Se este e-mail pertencer a uma conta aprovada, enviaremos orientações. Confira também a caixa de spam.';
    requestForm.reset();
  }catch(error){feedback.textContent=error.message;}
  finally{pending(button,false)}
});

confirmForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!configured||!hasValidLink())return;
  const button=document.getElementById('confirm-submit');
  if(button.disabled)return;
  const password=confirmForm.elements.password.value;
  if(password!==confirmForm.elements.confirmPassword.value){
    feedback.textContent='As senhas não conferem. Verifique e tente novamente.';
    return;
  }
  pending(button,true);feedback.textContent='';
  try{
    await post('/api/native/password/confirm',authMode==='zitadel'
      ? {userID,code:verificationCode,password}:{token:nativeToken,password});
    nativeToken='';userID='';verificationCode='';
    confirmForm.reset();
    confirmForm.hidden=true;
    title.textContent='Senha definida!';
    instructions.textContent='Agora você pode entrar na USBRIN ID com seu e-mail e senha.';
    const link=document.createElement('a');
    link.href='login.html';
    link.textContent='Ir para o login';
    link.className='login-next-link';
    feedback.replaceChildren(link);
  }catch(error){
    feedback.textContent=error.message;
    confirmForm.elements.password.value='';
    confirmForm.elements.confirmPassword.value='';
  }finally{pending(button,false)}
});
