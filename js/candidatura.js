'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
const form=document.getElementById('candidate-form'), availability=document.getElementById('availability'),result=document.getElementById('result'),button=document.getElementById('submit');
const area=new URLSearchParams(location.search).get('area');
const allowed=['representante','desenvolvedor'];
const stateCodes='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const select=document.getElementById('state');for(const s of stateCodes){const option=new Option(s,s);select.add(option);}
if(!allowed.includes(area)){availability.textContent='Escolha uma modalidade acima antes de se candidatar.';return;}
document.getElementById('heading').textContent=area==='representante'?'Candidatura — Representante comercial':'Candidatura — Desenvolvedor parceiro';
document.getElementById('intro').textContent=area==='representante'?'Conte sobre sua experiência comercial e sua relação com o mercado de empresas.':'Apresente sua experiência técnica, tecnologias utilizadas e projetos de sites.';
if(area==='desenvolvedor')document.querySelector('.developer-only').classList.remove('hidden');
let token='';
try{
 const request=await fetch('api/public-config',{cache:'no-store'});if(!request.ok)throw Error('Configuração indisponível');
 const config=await request.json();
 if(!config.applicationsOpen||!config.turnstileSiteKey){availability.textContent='As candidaturas ainda não estão abertas. A USBRIN está finalizando a estrutura de seleção.';return;}
 const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
 script.onload=()=>{window.turnstile.render('#turnstile',{sitekey:config.turnstileSiteKey,action:'usbrin_application',callback:(value)=>{token=value;button.disabled=false;},'expired-callback':()=>{token='';button.disabled=true;},'error-callback':()=>{token='';button.disabled=true;}})};
 script.onerror=()=>{availability.textContent='Verificação de segurança indisponível. Tente novamente mais tarde.';form.classList.add('hidden');};
 document.head.append(script);availability.textContent='Candidaturas abertas. Preencha suas informações e finalize a verificação de segurança.';form.classList.remove('hidden');
}catch{availability.textContent='Não foi possível verificar a disponibilidade das candidaturas. Tente mais tarde.';}
form.addEventListener('submit',async(e)=>{
 e.preventDefault();result.classList.add('hidden');
 if(!form.reportValidity()||!token)return;
 const fields=Object.fromEntries(new FormData(form));
 const payload={type:area,name:fields.name,email:fields.email,phone:fields.phone,city:fields.city,state:fields.state,availability:fields.availability,portfolio:fields.portfolio||'',experience:fields.experience,motivation:fields.motivation,privacy:fields.privacy==='on',website:fields.website||'',turnstileToken:token};
 button.disabled=true;button.textContent='Enviando...';
 try{
 const response=await fetch('api/applications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 const data=await response.json();
 result.classList.remove('hidden');result.classList.toggle('good',response.ok);result.classList.toggle('bad',!response.ok);
 if(!response.ok){result.textContent=data.error||'Não foi possível enviar sua candidatura.';return;}
 result.textContent='Candidatura recebida. Protocolo: '+data.protocol+'. Guarde este número. A equipe avaliará as informações antes de qualquer aprovação.';
 form.classList.add('hidden');availability.textContent='Recebimento confirmado.';
 }catch{result.classList.remove('hidden');result.classList.add('bad');result.textContent='Erro de conexão. Confirme se a candidatura foi recebida antes de tentar novamente.';}
 finally{button.textContent='Enviar candidatura';token='';if(window.turnstile){window.turnstile.reset('#turnstile')} }
});
});
