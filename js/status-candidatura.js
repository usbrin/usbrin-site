'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const el=id=>document.getElementById(id),info=el('lookup-status'),form=el('status-form'),button=el('status-button'),output=el('status-result');
 let token='';
 const names={received:'Recebida',review:'Em análise',requested:'Informações adicionais solicitadas',interview:'Em entrevista ou avaliação',preapproved:'Pré-aprovada',documentation:'Formalização pendente',approved:'Aprovada',rejected:'Não selecionada',withdrawn:'Encerrada'};
 try{
   const resp=await fetch('api/public-config',{cache:'no-store'});
   const cfg=await resp.json();
   if(!cfg.applicationsOpen||!cfg.turnstileSiteKey){info.textContent='Acompanhamento indisponível enquanto o programa não recebe candidaturas.';return;}
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
   script.onload=()=>window.turnstile.render('#status-turnstile',{size:document.getElementById('status-turnstile').clientWidth<300?'compact':'flexible',sitekey:cfg.turnstileSiteKey,action:'usbrin_status',callback:t=>{token=t;button.disabled=false;},'expired-callback':()=>{token='';button.disabled=true;},'error-callback':()=>{token='';button.disabled=true;}});
   script.onerror=()=>{info.textContent='Verificação de segurança temporariamente indisponível.';form.classList.add('hidden');};
   document.head.append(script);form.classList.remove('hidden');info.textContent='Consulte o andamento de sua candidatura.';
 }catch{info.textContent='Não foi possível carregar a consulta.';}
 form.addEventListener('submit',async event=>{
   event.preventDefault();if(!form.reportValidity()||!token)return;button.disabled=true;output.classList.add('hidden');
   try{
     const data=new FormData(form);
     const response=await fetch('api/application-status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({protocol:data.get('protocol'),email:data.get('email'),turnstileToken:token})});
     const body=await response.json();
     output.classList.remove('hidden');output.classList.toggle('good',response.ok);output.classList.toggle('bad',!response.ok);
     output.textContent=response.ok?'Situação atual: '+(names[body.status]||'Em análise')+'. Última atualização: '+(body.updatedAt||'não informada')+'.':(body.error||'Consulta indisponível.');
   }catch{output.classList.remove('hidden');output.classList.add('bad');output.textContent='Falha na conexão. Tente novamente mais tarde.';}
   finally{token='';if(window.turnstile)window.turnstile.reset('#status-turnstile');}
 });
});
