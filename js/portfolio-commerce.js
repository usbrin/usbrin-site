/* USBRIN Commerce — dados e regras puras para lojas CONCEITUAIS.
 * Todas as fotos são de ambientação Unsplash, não imagens de produtos à venda.
 * Não há pagamento, estoque real, cadastro, frete real ou pedidos.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.USBRINCommerce=api;})(typeof window==='undefined'?null:window,function(){
'use strict';
const photo=id=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=980&q=78';
const collections=Object.freeze({
 tech:Object.freeze({name:'VOLTA / tech store',categories:['Todos','Áudio','Computadores','Fotografia','Acessórios'],hero:photo('photo-1695753456538-3d29fa0a4ba0')}),
 pet:Object.freeze({name:'CASA PATTA',categories:['Todos','Passeio','Alimentação','Conforto','Brincadeiras'],hero:photo('photo-1548199973-03cce0bbc87b')})
});
const stock=Object.freeze([
 {id:'t01',store:'tech',name:'Fone Studio One',category:'Áudio',price:42900,tag:'Destaque',variantLabel:'Cor',variants:['Preto','Areia'],description:'Um conceito de fone over-ear para trabalho e momentos de descanso.',image:photo('photo-1505740420928-5e560c06d30e'),alt:'Fotografia de headphone em cenário minimalista'},
 {id:'t02',store:'tech',name:'Fone Intra Air',category:'Áudio',price:24900,tag:'Compacto',variantLabel:'Cor',variants:['Branco','Preto'],description:'Conceito de fones compactos para uma rotina em movimento.',image:photo('photo-1572569511254-d8f925fe2cbb'),alt:'Fotografia de fones de ouvido sem fio'},
 {id:'t03',store:'tech',name:'Watch Motion',category:'Acessórios',price:67900,tag:'Coleção',variantLabel:'Pulseira',variants:['Grafite','Cinza'],description:'Visual urbano e interface de relógio ilustrados em um catálogo digital.',image:photo('photo-1546868871-7041f2a55e12'),alt:'Fotografia de relógio inteligente'},
 {id:'t04',store:'tech',name:'Notebook Nomad',category:'Computadores',price:389000,tag:'Novo',variantLabel:'Acabamento',variants:['Prata','Grafite'],description:'Notebook conceitual de linhas limpas para trabalho criativo.',image:photo('photo-1517336714731-489689fd1ca8'),alt:'Fotografia de computador portátil'},
 {id:'t05',store:'tech',name:'Camera Focus',category:'Fotografia',price:238000,tag:'Seleção',variantLabel:'Kit',variants:['Corpo','Corpo + lente'],description:'Câmera conceitual apresentada com um fluxo organizado de compra.',image:photo('photo-1526170375885-4d8ecf77b99f'),alt:'Fotografia de câmera fotográfica'},
 {id:'t06',store:'tech',name:'Headphone Quiet',category:'Áudio',price:79900,tag:'Conforto',variantLabel:'Cor',variants:['Preto','Branco'],description:'Estudo de produto de áudio com apresentação editorial.',image:photo('photo-1583394838336-acd977736f90'),alt:'Fotografia de fone de ouvido over-ear'},
 {id:'p01',store:'pet',name:'Guia Passeio Livre',category:'Passeio',price:8900,tag:'Passeio',variantLabel:'Tamanho',variants:['P','M','G'],description:'Conceito de acessório para caminhadas e passeios.',image:photo('photo-1548199973-03cce0bbc87b'),alt:'Fotografia de dois cães correndo ao ar livre, ambiente de passeio'},
 {id:'p02',store:'pet',name:'Coleira Dia a Dia',category:'Passeio',price:6900,tag:'Essenciais',variantLabel:'Tamanho',variants:['P','M','G'],description:'Produto conceitual para apresentar escolhas de tamanho.',image:photo('photo-1517849845537-4d257902454a'),alt:'Fotografia de cachorro em ambiente externo'},
 {id:'p03',store:'pet',name:'Kit Refeição',category:'Alimentação',price:15900,tag:'Cuidado',variantLabel:'Capacidade',variants:['Pequeno','Grande'],description:'Conceito de conjunto para alimentação com rotina simplificada.',image:photo('photo-1583511655857-d19b40a7a54e'),alt:'Fotografia de cachorro em ambiente doméstico'},
 {id:'p04',store:'pet',name:'Conforto Nuvem',category:'Conforto',price:23900,tag:'Aconchego',variantLabel:'Tamanho',variants:['P','M','G'],description:'Cama ilustrativa de ambiente para o descanso dos pets.',image:photo('photo-1573865526739-10659fec78a5'),alt:'Fotografia de gato em ambiente doméstico'},
 {id:'p05',store:'pet',name:'Arranha & Brinca',category:'Brincadeiras',price:17900,tag:'Gatos',variantLabel:'Tamanho',variants:['Compacto','Alto'],description:'Conceito de enriquecimento ambiental para gatos.',image:photo('photo-1543852786-1cf6624b9987'),alt:'Fotografia de gato em ambiente de descanso'},
 {id:'p06',store:'pet',name:'Brinquedo Trilha',category:'Brincadeiras',price:5900,tag:'Diversão',variantLabel:'Tamanho',variants:['Pequeno','Médio'],description:'Uma ideia de brinquedo para atividades e interação.',image:photo('photo-1601758228041-f3b2795255f1'),alt:'Fotografia de cachorro em atividade ao ar livre'}
]);
function normalize(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function list(store,category='Todos',search='',sort='destaques'){
 if(!Object.hasOwn(collections,store))return [];
 const filtered=stock.filter(p=>p.store===store && (category==='Todos'||p.category===category) && normalize([p.name,p.category,p.description].join(' ')).includes(normalize(search)));
 if(sort==='menor')filtered.sort((a,b)=>a.price-b.price);
 if(sort==='maior')filtered.sort((a,b)=>b.price-a.price);
 if(sort==='nome')filtered.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return filtered;
}
function byId(id){return stock.find(p=>p.id===id)||null;}
function add(cart,id,variant,quantity=1){
 const item=byId(id);if(!item||!Array.isArray(cart)||!item.variants.includes(variant)||!Number.isInteger(quantity)||quantity<1||quantity>10)return null;
 const safe=cart.filter(x=>x&&byId(x.id)&&byId(x.id).variants.includes(x.variant)&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=10).map(x=>({...x}));
 const entry=safe.find(x=>x.id===id&&x.variant===variant);
 if(entry){if(entry.quantity+quantity>10)return null;entry.quantity+=quantity;}else safe.push({id,variant,quantity});
 return safe;
}
function setQuantity(cart,id,variant,quantity){
 if(!Array.isArray(cart)||!Number.isInteger(quantity)||quantity<0||quantity>10)return null;
 const safe=cart.map(x=>({...x}));const index=safe.findIndex(x=>x.id===id&&x.variant===variant);
 if(index<0)return null;if(quantity===0)safe.splice(index,1);else safe[index].quantity=quantity;
 return safe;
}
function totals(cart){
 if(!Array.isArray(cart))return null;
 let subtotal=0,quantity=0;
 for(const line of cart){
  const item=byId(line?.id);
  if(!item||!item.variants.includes(line.variant)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>10)return null;
  subtotal+=item.price*line.quantity;quantity+=line.quantity;
 }
 // Entrega puramente hipotética, para demonstrar a soma do carrinho.
 const delivery=subtotal===0?0:subtotal>=29900?0:2490;
 return Object.freeze({subtotal,delivery,total:subtotal+delivery,quantity,freeDelivery:delivery===0&&subtotal>0});
}
return Object.freeze({collections,stock,byId,list,add,setQuantity,totals,normalize});
});
