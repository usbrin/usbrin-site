/* USBRIN Portfolio — Café Orvalho e Helena Luz: dados e regras puras.
 * Demonstrações conceituais, sem pedidos, fotografia autoral comprovada ou contratações reais.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.USBRINEditorial=api;})(typeof window==='undefined'?null:window,()=>{
'use strict';
const photo=(id,w=1080)=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w='+w+'&q=79';
const menu=Object.freeze([
 Object.freeze({id:'o01',name:'Espresso da Casa',category:'Cafés',price:1250,photo:photo('photo-1510707577719-ae7c14805e3a'),description:'Um clássico intenso para começar bem uma pausa.',note:'Xícara pequena · composição ilustrativa'}),
 Object.freeze({id:'o02',name:'Latte Cremoso',category:'Cafés',price:1950,photo:photo('photo-1461023058943-07fcbe16d735'),description:'Café com leite em uma interpretação delicada.',note:'Bebida com leite · composição ilustrativa'}),
 Object.freeze({id:'o03',name:'Cappuccino Orvalho',category:'Cafés',price:2200,photo:photo('photo-1509042239860-f550ce710b93'),description:'Uma escolha aconchegante para quem gosta de textura.',note:'Bebida com leite · composição ilustrativa'}),
 Object.freeze({id:'o04',name:'Toast Artesanal',category:'Comidas',price:2850,photo:photo('photo-1484723091739-30a097e8f929'),description:'Pão tostado e sabores simples de uma manhã tranquila.',note:'Foto editorial de comida · receita não especificada'}),
 Object.freeze({id:'o05',name:'Sanduíche da Horta',category:'Comidas',price:3250,photo:photo('photo-1528735602780-2552fd46c7af'),description:'Uma refeição leve em uma composição conceitual.',note:'Ingredientes e alergênicos não verificados'}),
 Object.freeze({id:'o06',name:'Brunch da Casa',category:'Comidas',price:3950,photo:photo('photo-1490645935967-10de6ba17061'),description:'Um convite para desacelerar e aproveitar o momento.',note:'Foto de ambientação · composição ilustrativa'}),
 Object.freeze({id:'o07',name:'Bolo do Dia',category:'Doces',price:2150,photo:photo('photo-1578985545062-69928b1d9587'),description:'Uma fatia para acompanhar histórias e conversas.',note:'Produto conceitual · sabores hipotéticos'}),
 Object.freeze({id:'o08',name:'Cookie de Chocolate',category:'Doces',price:1450,photo:photo('photo-1499636136210-6f4ee915583e'),description:'Uma pequena pausa doce entre um compromisso e outro.',note:'Produto conceitual · alergênicos não verificados'}),
 Object.freeze({id:'o09',name:'Cheesecake Leve',category:'Doces',price:2550,photo:photo('photo-1533134242443-d4fd215305ad'),description:'Um final de tarde com textura delicada e sabor imaginado.',note:'Produto conceitual · ingredientes não verificados'})
]);
const moments=Object.freeze([
 Object.freeze({id:'pausa',label:'Uma pausa só minha',summary:'Um café e algo doce para uma pausa breve.',ids:['o01','o08']}),
 Object.freeze({id:'trabalho',label:'Café com foco',summary:'Um café mais suave com um acompanhamento.',ids:['o02','o04']}),
 Object.freeze({id:'encontro',label:'Um encontro sem pressa',summary:'Dois cafés e um doce para dividir como referência.',ids:['o02','o03','o07']})
]);
const work=Object.freeze([
 Object.freeze({id:'h01',title:'Luz de manhã',category:'Retratos',photo:photo('photo-1544005313-94ddf0286df2',1280),caption:'Retrato editorial de referência com luz suave e composição simples.',shape:'vertical'}),
 Object.freeze({id:'h02',title:'Entre luzes',category:'Retratos',photo:photo('photo-1534528741775-53994a69daeb',1280),caption:'Retrato fotográfico usado como estudo de atmosfera e enquadramento.',shape:'vertical'}),
 Object.freeze({id:'h03',title:'Presença',category:'Retratos',photo:photo('photo-1524504388940-b1c1722653e1',1280),caption:'Ensaio fotográfico de referência, sem vínculo com clientes da marca.',shape:'vertical'}),
 Object.freeze({id:'h04',title:'Movimento',category:'Editorial',photo:photo('photo-1483985988355-763728e1935b',1280),caption:'Fotografia editorial de moda como inspiração visual.',shape:'wide'}),
 Object.freeze({id:'h05',title:'Contraste',category:'Editorial',photo:photo('photo-1492691527719-9d1e07e534b4',1280),caption:'Imagem de referência sobre o universo da fotografia e seus detalhes.',shape:'wide'}),
 Object.freeze({id:'h06',title:'Enquadramento',category:'Editorial',photo:photo('photo-1542038784456-1ea8e935640e',1280),caption:'Estudo de luz, processo e linguagem fotográfica.',shape:'vertical'}),
 Object.freeze({id:'h07',title:'Um instante',category:'Histórias',photo:photo('photo-1519741497674-611481863552',1280),caption:'Fotografia documental de referência de uma celebração.',shape:'wide'}),
 Object.freeze({id:'h08',title:'Memória',category:'Histórias',photo:photo('photo-1511285560929-80b456fea0bc',1280),caption:'Cena de celebração apresentada como referência de narrativa visual.',shape:'wide'})
]);
const sessionTypes=Object.freeze({retrato:'Retrato pessoal',editorial:'Editorial de marca',historia:'Registro de celebração'});
const sessionPlaces=Object.freeze({estudio:'Estúdio',externo:'Ambiente externo',definir:'Local a definir'});
const sessionDeliverables=Object.freeze({digital:'Galeria digital',selecao:'Seleção de fotos editadas',album:'Galeria e álbum a discutir'});
const normalize=t=>String(t??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
function catalog(category='Todos',query='',order='destaques'){
 const items=menu.filter(x=>(category==='Todos'||category===x.category)&&normalize(x.name+' '+x.description).includes(normalize(query)));
 if(order==='menor')items.sort((a,b)=>a.price-b.price);
 else if(order==='maior')items.sort((a,b)=>b.price-a.price);
 else if(order==='nome')items.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return items;
}
function selection(lines){
 if(!Array.isArray(lines)||lines.length>4||new Set(lines.map(x=>x?.id)).size!==lines.length)return null;
 let total=0,quantity=0;
 const results=[];
 for(const line of lines){
  const item=menu.find(x=>x.id===line?.id);
  if(!item||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>10)return null;
  const subtotal=item.price*line.quantity;
  results.push(Object.freeze({id:item.id,name:item.name,quantity:line.quantity,subtotal}));
  total+=subtotal;quantity+=line.quantity;
 }
 return Object.freeze({items:results,total,quantity});
}
function moment(id){return moments.find(x=>x.id===id)||null;}
function sampleBrief(lines){
 const result=selection(lines);if(!result)return null;
 return ['CAFÉ ORVALHO — SELEÇÃO ILUSTRATIVA','Não é pedido, reserva ou preço comercial válido.','',
 ...result.items.map(x=>x.quantity+' × '+x.name),
 'Valor hipotético: '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(result.total/100),
 '','Informações de ingredientes e alergênicos devem ser verificadas no estabelecimento real.'].join('\n');
}
function gallery(category='Todos'){
 if(category==='Todos')return work.slice();
 if(!['Retratos','Editorial','Histórias'].includes(category))return [];
 return work.filter(x=>x.category===category);
}
function session({type,place,delivery,notes=''}={}){
 if(!Object.hasOwn(sessionTypes,type)||!Object.hasOwn(sessionPlaces,place)||!Object.hasOwn(sessionDeliverables,delivery)||typeof notes!=='string'||notes.length>300)return null;
 return Object.freeze({type:sessionTypes[type],place:sessionPlaces[place],delivery:sessionDeliverables[delivery],notes:notes.trim()});
}
function sessionBrief(input){
 const r=session(input);if(!r)return null;
 const parts=['HELENA LUZ — BRIEFING CONCEITUAL','Este portfólio é demonstrativo. Não há disponibilidade ou contratação confirmada.','',
 'Tipo de sessão: '+r.type,'Local preferido: '+r.place,'Entrega de interesse: '+r.delivery];
 if(r.notes)parts.push('Informações adicionais: '+r.notes);
 parts.push('','As condições, autorizações de imagem, direitos de uso, duração e valores dependem de proposta real.');
 return parts.join('\n');
}
return Object.freeze({menu,moments,work,sessionTypes,sessionPlaces,sessionDeliverables,catalog,selection,moment,sampleBrief,gallery,session,sessionBrief});
});
