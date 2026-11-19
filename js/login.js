'use strict';
const form=document.getElementById('login-form');
const button=document.getElementById('login-submit');
const feedback=document.getElementById('login-feedback');
const recover=document.getElementById('password-recovery-link');
fetch('/api/native/config',{cache:'no-store',headers:{accept:'application/json'}})
  .then(r=>r.ok?r.json():null)
  .then(config=>{
    if(!config?.ok)return;
    if(!config.passwordRecovery){
      recover.hidden=true;
      recover.parentElement.firstChild.textContent='Primeiro acesso ou esqueceu a senha? Solicite a ativação à equipe USBRIN. ';
    }
    if(config.mode==='zitadel'){
      form.elements.password.removeAttribute('minlength');
    }
  })
  .catch(()=>{recover.hidden=true;});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(button.disabled)return;
  button.disabled=true;
  button.textContent='Verificando acesso…';
  feedback.textContent='';
  const email=form.elements.email.value.trim();
  const password=form.elements.password.value;
  try{
    const response=await fetch('/api/native/login',{
      method:'POST',
      credentials:'same-origin',
      cache:'no-store',
      redirect:'manual',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({email,password})
    });
    if(response.type==='opaqueredirect')throw Error('Este ambiente ainda usa o acesso anterior. Entre em contato com a USBRIN.');
    const data=response.headers.get('content-type')?.includes('application/json')?await response.json():null;
    if(!response.ok||!data?.ok)throw Error(
      response.status===429?'Muitas tentativas. Aguarde antes de tentar novamente.':
      data?.error||'Não foi possível entrar. Verifique os dados e tente novamente.'
    );
    form.elements.password.value='';
    location.assign('/portal');
  }catch(error){
    form.elements.password.value='';
    feedback.textContent=error.message||'Não foi possível entrar. Tente novamente.';
    button.disabled=false;
    button.textContent='Entrar na USBRIN ID';
  }
});
