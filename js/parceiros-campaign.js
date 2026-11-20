'use strict';
// Public campaign page. Reflects backend availability; it never unlocks
// registrations on its own. The API independently validates all submissions.
document.addEventListener('DOMContentLoaded',async()=>{
 const status=document.getElementById('representative-availability');
 const cta=document.getElementById('representative-cta');
 if(!status||!cta)return;
 cta.textContent='Conhecer candidatura';
 status.textContent='Inscrições sujeitas à abertura pela USBRIN.';
 status.classList.remove('good');
 try{
  const response=await fetch('/api/public-config',{cache:'no-store'});
  if(!response.ok)return;
  const config=await response.json();
  if(config?.applicationTypes?.includes('representante')){
    cta.textContent='Enviar candidatura de representante';
    status.textContent=config.representativePreview
      ?'Homologação: somente dados fictícios com e-mail @example.com.'
      :'Inscrições de representantes comerciais abertas. Envio sujeito a avaliação.';
    status.classList.toggle('good',!config.representativePreview);
  }else{
    status.textContent='Candidaturas de representantes ainda não abertas. Acompanhe esta página.';
  }
 }catch{
  // Fail closed: never promise enrollment if the availability endpoint fails.
  status.textContent='Não foi possível confirmar as inscrições. Consulte novamente mais tarde.';
 }
});
