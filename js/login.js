'use strict';
const form=document.getElementById('login-form');
const button=document.getElementById('login-submit');
const feedback=document.getElementById('login-feedback');
const recover=document.getElementById('password-recovery-link');
const adminMfa=document.getElementById('admin-mfa');
const totpInput=document.getElementById('admin-totp');
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
// A second factor is requested only after the provider confirmed the admin password.
function requireAdminCode(){
  adminMfa.hidden=false;
  totpInput.required=true;
  totpInput.focus();
  button.textContent='Verificar e entrar';
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(button.disabled)return;
  button.disabled=true;
  button.textContent='Verificando acesso…';
  feedback.textContent='';
  const email=form.elements.email.value.trim();
  const password=form.elements.password.value;
  const totp=adminMfa.hidden?undefined:totpInput.value.trim();
  try{
    const response=await fetch('/api/native/login',{
      method:'POST',
      credentials:'same-origin',
      cache:'no-store',
      redirect:'manual',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({email,password,...(totp===undefined?{}:{totp})})
    });
    if(response.type==='opaqueredirect')
      throw Error('Este ambiente ainda utiliza o acesso anterior. Contate a USBRIN.');
    const data=response.headers.get('content-type')?.includes('application/json')?await response.json():null;
    if(!response.ok||!data?.ok){
      if(data?.code==='mfa_required'){
        requireAdminCode();
        feedback.textContent='Informe o código do aplicativo autenticador para continuar.';
        return;
      }
      if(data?.code==='invalid_totp'){
        totpInput.value='';
        feedback.textContent='Código inválido. Confira no aplicativo autenticador.';
        totpInput.focus();
        return;
      }
      throw Error(response.status===429?'Muitas tentativas. Aguarde antes de tentar novamente.':
        data?.error||'Não foi possível entrar. Verifique os dados e tente novamente.');
    }
    form.elements.password.value='';
    totpInput.value='';
    location.assign('/portal');
  }catch(error){
    form.elements.password.value='';
    totpInput.value='';
    feedback.textContent=error.message||'Não foi possível entrar. Tente novamente.';
  }finally{
    button.disabled=false;
    button.textContent=adminMfa.hidden?'Entrar na USBRIN ID':'Verificar e entrar';
  }
});
