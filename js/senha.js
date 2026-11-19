'use strict';
const requestForm=document.getElementById('request-form');
const confirmForm=document.getElementById('confirm-form');
const feedback=document.getElementById('password-feedback');
const title=document.getElementById('title');
const instructions=document.getElementById('instructions');
const params=new URLSearchParams(location.hash.slice(1));
let token=params.get('token')||'';
// Remove the sensitive fragment from browser history before interacting with other pages.
history.replaceState(null,'',location.pathname);
if(!/^[a-f0-9]{64}$/.test(token))token='';
if(token){
  requestForm.hidden=true;
  confirmForm.hidden=false;
  title.textContent='Escolha sua nova senha';
  instructions.textContent='Crie uma senha com pelo menos 12 caracteres. Você poderá usá-la para entrar na USBRIN ID.';
}
async function post(path,data){
  const response=await fetch(path,{
    method:'POST',
    credentials:'same-origin',
    cache:'no-store',
    redirect:'manual',
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
for(const form of [requestForm,confirmForm]) {
  const button=form.querySelector('button');
  button.dataset.label=button.textContent;
}
requestForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=document.getElementById('request-submit');
  if(button.disabled)return;
  pending(button,true);feedback.textContent='';
  try{
    await post('/api/native/password/request',{email:requestForm.elements.email.value.trim()});
    feedback.textContent='Se esse e-mail estiver aprovado, você receberá um link. Confira também a caixa de spam.';
    requestForm.reset();
  }catch(error){
    feedback.textContent=error.message;
  }finally{pending(button,false)}
});
confirmForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=document.getElementById('confirm-submit');
  if(button.disabled)return;
  const password=confirmForm.elements.password.value;
  if(password!==confirmForm.elements.confirmPassword.value){
    feedback.textContent='As senhas não conferem. Verifique e tente novamente.';
    return;
  }
  pending(button,true);feedback.textContent='';
  try{
    await post('/api/native/password/confirm',{token,password});
    token='';
    confirmForm.reset();
    confirmForm.hidden=true;
    title.textContent='Senha definida!';
    instructions.textContent='Agora você já pode entrar na USBRIN ID com seu e-mail e senha.';
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
