'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const el=id=>document.getElementById(id);
 const feedback=el('proposal-feedback'),button=el('print-proposal'),doc=el('proposal-document');
 const q=new URLSearchParams(location.search),op=q.get('o')||'',proposalId=q.get('p')||'';
 if(!/^[a-zA-Z0-9-]{12,60}$/.test(op)||!/^[a-zA-Z0-9-]{12,60}$/.test(proposalId)){
  feedback.textContent='Link inválido. Volte ao portal e selecione uma proposta aprovada.';return;
 }
 try{
  const response=await fetch('/api/private/crm/proposals?id='+encodeURIComponent(op),{credentials:'same-origin',cache:'no-store'});
  const result=await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||'Você não tem acesso a esta proposta.');
  const p=result.proposals.find(x=>x.id===proposalId);
  if(!p||!['approved','sent'].includes(p.status))throw Error('Somente propostas aprovadas pela USBRIN podem ser impressas.');
  const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const date=v=>{const match=String(v||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?match[3]+'/'+match[2]+'/'+match[1]:'Não informada'};
  const set=(id,value)=>el(id).textContent=String(value??'');
  set('proposal-code',p.code);set('proposal-created',date(p.created_at));set('proposal-validity',date(p.valid_until));
  set('proposal-customer',p.customer_company);set('proposal-contact',p.customer_contact);
  const products={landing:'USBRIN Landing',business:'USBRIN Business',catalogo:'USBRIN Catálogo',personalizado:'Desenvolvimento personalizado'};
  set('proposal-product',products[p.product]||p.product);set('proposal-scope',p.scope);
  set('proposal-price',fmt.format(p.price_cents/100));
  set('proposal-duration',p.duration_days+' dias (estimativa)');
  set('proposal-terms',p.terms||'Condições comerciais e forma de pagamento sujeitas à confirmação por escrito pela USBRIN.');
  feedback.textContent='Documento aprovado. Revise o conteúdo antes de compartilhar.';
  doc.hidden=false;button.disabled=false;
  button.addEventListener('click',()=>window.print());
 }catch(error){feedback.textContent=error.message||'Não foi possível abrir a proposta.';}
});