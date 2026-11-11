/* USBRIN Portfolio — coleção de joias e cosméticos conceituais.
 * Fotos são referências editoriais e NÃO documentam mercadoria, composição, procedência ou disponibilidade.
 * Valores hipotéticos; sem checkout, saúde, armazenamento ou APIs externas.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.USBRINAtelier=api;})(typeof window==='undefined'?null:window,function(){
'use strict';
const u=(id)=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=920&q=78';
const p=(id)=>'https://images.pexels.com/photos/'+id+'/pexels-photo-'+id+'.jpeg?auto=compress&cs=tinysrgb&w=920';
const jewelry=Object.freeze([
 {id:'j01',name:'Colar Aurora',category:'Colares',occasion:['aniversario','celebracao'],price:42900,photo:u('photo-1599643477877-530eb83abc8e'),detail:'Linha delicada com ponto de luz em composição ilustrativa.',finish:'Tom dourado',presentation:'Acessório de inspiração delicada'},
 {id:'j02',name:'Argolas Forma',category:'Brincos',occasion:['cotidiano','aniversario'],price:25900,photo:u('photo-1630019852942-f89202989a59'),detail:'Um desenho essencial de argolas para acompanhar diversas composições.',finish:'Tom dourado',presentation:'Acessório versátil'},
 {id:'j03',name:'Anel Horizonte',category:'Anéis',occasion:['celebracao','aniversario'],price:59000,photo:u('photo-1605100804763-247f67b3557e'),detail:'Volume e brilho em uma proposta de presente marcante.',finish:'Tom prateado',presentation:'Referência de anel especial'},
 {id:'j04',name:'Pulseira Trama',category:'Pulseiras',occasion:['cotidiano','aniversario'],price:31900,photo:u('photo-1611591437281-460bfbe1220a'),detail:'Composição leve e texturizada para o dia a dia.',finish:'Tom dourado',presentation:'Estudo de acessório'},
 {id:'j05',name:'Colar Essência',category:'Colares',occasion:['cotidiano','celebracao'],price:34900,photo:u('photo-1617038220319-276d3cfab638'),detail:'Uma ideia de colar minimalista para usar em diferentes momentos.',finish:'Tom dourado',presentation:'Peça conceitual'},
 {id:'j06',name:'Brincos Elo',category:'Brincos',occasion:['celebracao','cotidiano'],price:18900,photo:u('photo-1535632066927-ab7c9ab60908'),detail:'Referência de brincos pequenos com desenho contemporâneo.',finish:'Tom prateado',presentation:'Peça conceitual'}
]);
const cosmetics=Object.freeze([
 {id:'c01',name:'Gel Primeiro Passo',stage:'Limpar',texture:'leve',price:6900,photo:u('photo-1556228720-195a672e8a03'),detail:'Gel cosmético conceitual para uma experiência de rotina simples.',format:'Frasco ilustrativo · 150 mL'},
 {id:'c02',name:'Espuma Suave',stage:'Limpar',texture:'cremosa',price:7900,photo:u('photo-1608248543803-ba4f8c70ae0b'),detail:'Textura espumosa ilustrativa para a etapa de limpeza cosmética.',format:'Frasco ilustrativo · 160 mL'},
 {id:'c03',name:'Loção Dia Claro',stage:'Hidratar',texture:'leve',price:11900,photo:u('photo-1620916566398-39f1143ab7be'),detail:'Loção de textura leve apresentada como conceito de produto.',format:'Frasco ilustrativo · 100 mL'},
 {id:'c04',name:'Creme Horizonte',stage:'Hidratar',texture:'cremosa',price:13900,photo:u('photo-1601049541289-9b1b7bbbfe19'),detail:'Creme cosmético conceitual de textura mais encorpada.',format:'Pote ilustrativo · 50 g'},
 {id:'c05',name:'Óleo Ritual',stage:'Finalizar',texture:'cremosa',price:9900,photo:u('photo-1608571423902-eed4a5ad8108'),detail:'Conceito de óleo corporal para o momento final de autocuidado.',format:'Frasco ilustrativo · 60 mL'},
 {id:'c06',name:'Bruma Leve',stage:'Finalizar',texture:'leve',price:8900,photo:u('photo-1571781926291-c477ebfd024b'),detail:'Bruma cosmética conceitual para encerrar um ritual de cuidados.',format:'Frasco ilustrativo · 80 mL'}
]);
const categories=Object.freeze({jewelry:['Todos','Colares','Brincos','Anéis','Pulseiras'],cosmetics:['Todos','Limpar','Hidratar','Finalizar']});
const stages=Object.freeze(['Limpar','Hidratar','Finalizar']);
function norm(t){return String(t??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function catalog(kind,category='Todos',query='',sort='destaques'){
 const data=kind==='jewelry'?jewelry:kind==='cosmetics'?cosmetics:[];
 const results=data.filter(x=>(category==='Todos'||(kind==='jewelry'?x.category:x.stage)===category)&&norm([x.name,x.detail,x.category||x.stage].join(' ')).includes(norm(query)));
 if(sort==='menor')results.sort((a,b)=>a.price-b.price);
 if(sort==='maior')results.sort((a,b)=>b.price-a.price);
 if(sort==='nome')results.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return results;
}
function giftFinder(occasion,budget){
 if(!['cotidiano','aniversario','celebracao'].includes(occasion)||!Number.isInteger(budget)||budget<15000||budget>150000)return null;
 return jewelry.filter(p=>p.price<=budget&&p.occasion.includes(occasion)).sort((a,b)=>a.price-b.price);
}
function comparison(ids,wrapped=false){
 if(!Array.isArray(ids)||ids.length>2||new Set(ids).size!==ids.length||typeof wrapped!=='boolean')return null;
 const found=ids.map(id=>jewelry.find(p=>p.id===id));
 if(found.some(x=>!x))return null;
 const subtotal=found.reduce((s,p)=>s+p.price,0);
 const wrapping=wrapped&&ids.length?2900:0;
 return Object.freeze({count:found.length,subtotal,wrapping,total:subtotal+wrapping,items:found});
}
function routine(texture,custom={}){
 if(!['leve','cremosa'].includes(texture)||!custom||typeof custom!=='object')return null;
 const result=[];
 for(const stage of stages){
  const pick=custom[stage];
  const item=pick?cosmetics.find(p=>p.id===pick):cosmetics.find(p=>p.stage===stage&&p.texture===texture);
  if(!item||item.stage!==stage)return null;
  result.push(item);
 }
 return Object.freeze({steps:result,total:result.reduce((sum,item)=>sum+item.price,0),texture});
}
return Object.freeze({jewelry,cosmetics,categories,stages,norm,catalog,giftFinder,comparison,routine});
});
