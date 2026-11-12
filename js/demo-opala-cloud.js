'use strict';
/* Opala Cloud: cálculo didático local. Sem API, provisionamento, contas ou preços reais. */
(function(){
 const profiles=Object.freeze({
 base:{label:'Essencial',cpu:2,ram:4,cents:12000},
 growth:{label:'Crescimento',cpu:4,ram:8,cents:23500},
 high:{label:'Intensivo',cpu:8,ram:16,cents:41000}
 });
 const storageOptions=Object.freeze({'50':50,'100':100,'200':200,'500':500});
 const policies=Object.freeze({standard:{label:'Sem cópias adicionais',factor:0},extra:{label:'Com cópias adicionais',factor:1}});
 const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
 function calculate(profile,instances,storage,policy){
 if(!Object.hasOwn(profiles,profile))throw new RangeError('Perfil inválido.');
 if(!Number.isInteger(instances)||instances<1||instances>4)throw new RangeError('Selecione de 1 a 4 instâncias.');
 const key=String(storage);
 if(!Object.hasOwn(storageOptions,key)||!Object.hasOwn(policies,policy))throw new RangeError('Opção inválida.');
 const info=profiles[profile],base=info.cents*instances;
 const dataCents=storageOptions[key]*36;
 const copiesCents=policies[policy].factor*(dataCents+base/10);
 const cents=base+dataCents+copiesCents;
 if(!Number.isSafeInteger(cents))throw new RangeError('Resultado inválido.');
 return {profile:info.label,instances,cpu:info.cpu*instances,ram:info.ram*instances,storage:storageOptions[key],policy:policies[policy].label,baseCents:base,dataCents,copiesCents,totalCents:cents};
 }
 function summaryText(o){return ['OPALA CLOUD — ARQUITETURA SIMULADA (NÃO É COTAÇÃO)','Perfil: '+o.profile,'Instâncias: '+o.instances,'CPU total ilustrativa: '+o.cpu+' vCPU','RAM total ilustrativa: '+o.ram+' GB','Dados de referência: '+o.storage+' GB','Política: '+o.policy,'Custo hipotético: '+money(o.totalCents)+'/mês','Nenhum serviço provisionado. Sem preço comercial, disponibilidade ou performance garantida.'].join('\n');}
 if(typeof module!=='undefined'&&module.exports)module.exports={profiles,storageOptions,policies,calculate,summaryText};
 if(typeof document==='undefined')return;
 document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id);
 const fields=[$('opala-profile'),$('opala-instances'),$('opala-storage'),$('opala-policy')];
 let rendered=null;
 const status=$('opala-status'),notify=msg=>{status.textContent=msg;};
 const read=()=>calculate($('opala-profile').value,Number($('opala-instances').value),$('opala-storage').value,$('opala-policy').value);
 function preview(){try{$('opala-estimate').textContent=money(read().totalCents);}catch(e){$('opala-estimate').textContent='Verifique as opções';} rendered=null;$('opala-copy').disabled=true;}
 function paint(o){
 $('opala-arch-instances').textContent=o.instances+(o.instances===1?' instância':' instâncias');
 $('opala-arch-protection').textContent=o.policy;
 $('opala-cpu').textContent=o.cpu+' vCPU';
 $('opala-ram').textContent=o.ram+' GB';
 $('opala-data').textContent=o.storage+' GB';
 $('opala-monthly').textContent=money(o.totalCents);
 }
 fields.forEach(f=>f.addEventListener('input',()=>{preview();notify('Parâmetros alterados. Visualize novamente para atualizar o cenário.');}));
 $('opala-form').addEventListener('submit',e=>{e.preventDefault();try{rendered=read();paint(rendered);$('opala-copy').disabled=false;notify('Arquitetura simulada localmente. Nenhum serviço foi criado.');}catch(e){rendered=null;$('opala-copy').disabled=true;notify(e.message||'Confira os parâmetros.');}});
 $('opala-reset').addEventListener('click',()=>{$('opala-form').reset();preview();paint(calculate('base',1,'50','standard'));notify('Configuração ilustrativa restaurada.');});
 $('opala-copy').addEventListener('click',async()=>{if(!rendered)return;try{await navigator.clipboard.writeText(summaryText(rendered));notify('Cenário hipotético copiado. Não houve envio.');}catch{notify('Não foi possível copiar automaticamente neste navegador.');}});
 const toggle=document.querySelector('.mobile-toggle'),nav=$('opala-mobile');
 const close=()=>{nav.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.textContent='Menu';};
 toggle.addEventListener('click',()=>{const open=nav.hidden;nav.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Fechar':'Menu';});
 nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!nav.hidden){close();toggle.focus();}});
 preview();paint(calculate('base',1,'50','standard'));
 });
})();