/* USBRIN Portfolio / Retail Lab — regras puras.
 * Valores e produtos inteiramente ilustrativos. Fotos de ambientação, sem atribuição a estoque real.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.USBRINRetail=api;})(typeof window==='undefined'?null:window,()=>{
'use strict';
const photo=id=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=1000&q=80';
const fashion=Object.freeze([
{id:'f01',name:'Camisa Essencial',type:'Camisas',price:18900,fit:'Regular',photo:photo('photo-1598032895397-b9472444bf93'),description:'Camisa conceitual de linhas limpas, para composições cotidianas.'},
{id:'f02',name:'Blazer Linha',type:'Alfaiataria',price:46900,fit:'Estruturado',photo:photo('photo-1591047139829-d91aecb6caea'),description:'Estudo de alfaiataria contemporânea em cores neutras.'},
{id:'f03',name:'Calça Forma',type:'Alfaiataria',price:32900,fit:'Reto',photo:photo('photo-1511196044526-5cb3bcb7071b'),description:'Peça de referência para combinações versáteis.'},
{id:'f04',name:'Malha Textura',type:'Malhas',price:21900,fit:'Conforto',photo:photo('photo-1576566588028-4147f3842f27'),description:'Malha essencial apresentada em composição editorial.'},
{id:'f05',name:'Vestido Aura',type:'Vestidos',price:39900,fit:'Fluido',photo:photo('photo-1539008835657-9e8e9680c956'),description:'Inspiração de vestido de caimento leve.'},
{id:'f06',name:'Jaqueta Urbana',type:'Casacos',price:44900,fit:'Solto',photo:photo('photo-1544923246-77307dd654cb'),description:'Proposta casual de sobreposição com linguagem urbana.'}
]);
const materials=Object.freeze([
{id:'m01',name:'Revestimento Areia',type:'Revestimentos',price:8290,unit:'m²',photo:photo('photo-1600607687939-ce8a6c25118c'),description:'Referência de acabamento em tom natural para ambientes internos.'},
{id:'m02',name:'Porcelanato Mineral',type:'Revestimentos',price:11990,unit:'m²',photo:photo('photo-1600566753190-17f0baa2a6c3'),description:'Estudo de superfície contemporânea em projeto residencial.'},
{id:'m03',name:'Tinta Neutra',type:'Pintura',price:21900,unit:'lata (18 L)',photo:photo('photo-1562259949-e8e7689d7828'),description:'Proposta de pintura com acabamento neutro e uniforme.'},
{id:'m04',name:'Tinta Acento',type:'Pintura',price:13900,unit:'lata (3,6 L)',photo:photo('photo-1579783902614-a3fb3927b6a5'),description:'Referência de cor para destacar um ambiente.'},
{id:'m05',name:'Cimento Base',type:'Estrutura',price:4590,unit:'saco (50 kg)',photo:photo('photo-1504307651254-35680f356dfd'),description:'Exemplo de material de obra para montar uma lista de cotação.'},
{id:'m06',name:'Madeira Natural',type:'Acabamentos',price:8990,unit:'m²',photo:photo('photo-1600566753086-00f18fb6b3ea'),description:'Inspiração em texturas amadeiradas para interiores.'}
]);
const measurements=Object.freeze({P:92,M:100,G:108,GG:116});
const shoppingFilters=Object.freeze({fashion:['Todos','Camisas','Alfaiataria','Malhas','Vestidos','Casacos'],materials:['Todos','Revestimentos','Pintura','Estrutura','Acabamentos']});
function norm(t){return String(t??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function catalog(kind,category='Todos',query='',sort='destaques'){
 const pool=kind==='fashion'?fashion:kind==='materials'?materials:[];
 const r=pool.filter(p=>(category==='Todos'||p.type===category)&&norm([p.name,p.type,p.description].join(' ')).includes(norm(query)));
 if(sort==='menor')r.sort((a,b)=>a.price-b.price);
 if(sort==='maior')r.sort((a,b)=>b.price-a.price);
 if(sort==='nome')r.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return r;
}
function outfit(ids){
 if(!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length)return null;
 let total=0;for(const id of ids){const p=fashion.find(x=>x.id===id);if(!p)return null;total+=p.price;}
 return Object.freeze({pieces:ids.length,total});
}
function sizeGuide(input){
 if(!input||!Object.hasOwn(measurements,input.size))return null;
 return Object.freeze({size:input.size,reference:measurements[input.size],note:'Circunferência da peça ilustrativa em centímetros; não equivale a medidas corporais ou recomendação automática de tamanho.'});
}
function calculateFloor({area,loss,boxCoverage}={}){
 if(![area,loss,boxCoverage].every(Number.isFinite)||area<1||area>500||loss<0||loss>25||boxCoverage<=0||boxCoverage>10)return null;
 const effective=area*(1+loss/100),boxes=Math.ceil(effective/boxCoverage);
 return Object.freeze({area,loss,boxCoverage,effective:Number(effective.toFixed(2)),boxes,coverage:Number((boxes*boxCoverage).toFixed(2))});
}
function calculatePaint({area,coats,yieldM2PerLiter,canLiters}={}){
 if(![area,coats,yieldM2PerLiter,canLiters].every(Number.isFinite)||area<1||area>1000||!Number.isInteger(coats)||coats<1||coats>4||yieldM2PerLiter<1||yieldM2PerLiter>20||canLiters<=0||canLiters>20)return null;
 const liters=area*coats/yieldM2PerLiter,cans=Math.ceil(liters/canLiters);
 return Object.freeze({liters:Number(liters.toFixed(2)),cans,coverageLiters:Number((cans*canLiters).toFixed(2))});
}
function quote(lines){
 if(!Array.isArray(lines))return null;
 let total=0,count=0;for(const line of lines){
  const p=materials.find(x=>x.id===line?.id);
  if(!p||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>500)return null;
  count+=line.quantity;total+=p.price*line.quantity;
 }
 return Object.freeze({lines:lines.length,units:count,total});
}
return Object.freeze({fashion,materials,measurements,shoppingFilters,norm,catalog,outfit,sizeGuide,calculateFloor,calculatePaint,quote});
});
