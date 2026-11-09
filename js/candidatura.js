'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const el=id=>document.getElementById(id);
 const form=el('candidate-form'),availability=el('availability'),result=el('result'),button=el('submit');
 const challengeStatus=el('challenge-status'),area=new URLSearchParams(location.search).get('area');
 const representative=area==='representante';
 if(!representative&&area!=='desenvolvedor'){
   availability.textContent='Escolha uma modalidade acima antes de se candidatar.';
   return;
 }

 el(representative?'link-rep':'link-dev').setAttribute('aria-current','true');
 el('heading').textContent=representative?'Candidatura para representante comercial':'Candidatura para desenvolvedor parceiro';
 el('intro').textContent=representative
   ?'Conte como você abordaria empresas e apresentaria os serviços da USBRIN. Experiências informais também contam.'
   :'Apresente sua experiência técnica, tecnologias utilizadas e projetos de sites.';
 if(representative){
   el('experience-label').textContent='Experiência com vendas *';
   el('experience').placeholder='Conte o que já fez em vendas, atendimento ou prospecção. Se estiver começando, descreva sua experiência até aqui.';
   el('motivation-label').textContent='Como você pretende conquistar clientes? *';
   el('motivation').placeholder='Dê um exemplo de empresa que procuraria e como iniciaria a conversa.';
 }else{
   document.querySelectorAll('.developer-only').forEach(field=>field.classList.remove('hidden'));
 }
 for(const state of 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')){
   el('state').add(new Option(state,state));
 }

 let token='',widgetId,submitting=false,completed=false;
 const updateChallenge=(value,text)=>{
   token=value;
   challengeStatus.textContent=text;
   button.disabled=!token||submitting||completed;
 };
 try{
   const response=await fetch('api/public-config',{cache:'no-store'});
   if(!response.ok)throw Error();
   const config=await response.json();
   if(!config.applicationTypes?.includes(area)||!config.turnstileSiteKey){
     availability.textContent='As candidaturas desta modalidade estão fechadas no momento.';
     return;
   }
   el('preview-notice').classList.toggle('hidden',!config.representativePreview);
   const script=document.createElement('script');
   script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
   script.async=true;
   const unavailable=()=>updateChallenge('','Verificação indisponível. Recarregue a página para tentar novamente.');
   script.onload=()=>{
     try{
       widgetId=window.turnstile.render('#turnstile',{
         size:el('turnstile').clientWidth<300?'compact':'flexible',sitekey:config.turnstileSiteKey,action:'usbrin_application',
         callback:value=>updateChallenge(value,'Verificação de segurança concluída.'),
         'expired-callback':()=>updateChallenge('','Verificação expirada. Aguarde a renovação.'),
         'error-callback':unavailable
       });
     }catch{unavailable();}
   };
   script.onerror=unavailable;
   challengeStatus.textContent='Carregando a verificação de segurança…';
   availability.textContent='Preencha os campos obrigatórios e conclua a verificação de segurança.';
   form.classList.remove('hidden');
   document.head.append(script);
 }catch{
   availability.textContent='Não foi possível verificar a disponibilidade das candidaturas. Tente mais tarde.';
   return;
 }

 form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!token||submitting||completed||!form.reportValidity())return;
   const fields=Object.fromEntries(new FormData(form));
   const {name,email,phone,city,state,experience,motivation,website}=fields;
   const payload={type:area,name,email,phone,city,state,experience,motivation,website,privacy:fields.privacy==='on',turnstileToken:token};
   if(!representative)Object.assign(payload,{availability:fields.availability,portfolio:fields.portfolio});
   submitting=true;
   button.disabled=true;
   button.textContent='Enviando…';
   result.className='status';
   result.textContent='Registrando sua candidatura…';
   try{
     const response=await fetch('api/applications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
     const data=await response.json();
     if(!response.ok){
       result.className='status bad';
       result.textContent=data.error||'Não foi possível enviar sua candidatura.';
       return;
     }
     completed=true;
     form.classList.add('hidden');
     availability.classList.add('hidden');
     result.className='status good';
     result.textContent='Candidatura recebida. Guarde o protocolo '+data.protocol+' para consultar o andamento. A equipe avaliará suas informações.';
     const link=document.createElement('a');
     link.href='status-candidatura.html';
     link.textContent='Acompanhar candidatura';
     result.append(document.createElement('br'),link);
   }catch{
     result.className='status bad';
     result.textContent='A confirmação não chegou. Tente enviar novamente. O sistema bloqueia uma segunda candidatura ativa com o mesmo e-mail.';
   }finally{
     submitting=false;
     button.textContent='Enviar candidatura';
     if(!completed){
       updateChallenge('','Renovando a verificação de segurança…');
       if(widgetId!==undefined)window.turnstile.reset(widgetId);
     }
     result.focus();
   }
 });
});
