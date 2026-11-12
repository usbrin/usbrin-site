'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const commerce=require('../js/portfolio-commerce.js');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Cada vitrine tem categorias e seis produtos diferentes',()=>{
 for(const store of ['tech','pet']){
  assert.ok(commerce.collections[store]);
  assert.equal(commerce.list(store).length,6);
  assert.equal(new Set(commerce.list(store).map(p=>p.id)).size,6);
  for(const p of commerce.list(store)){assert.ok(p.variants.length>=2);assert.ok(p.price>0);assert.ok(/^https:\/\/images\.(unsplash\.com\/photo-|pexels\.com\/photos\/)/.test(p.image));assert.ok(p.alt.length>12);}
 }
 assert.equal(commerce.list('invalid').length,0);
 assert.equal(commerce.byId('none'),null);
});
test('Filtros, busca com acentos e ordenação são determinísticos',()=>{
 assert.equal(commerce.list('tech','Áudio').length,3);
 assert.equal(commerce.list('pet','Brincadeiras').length,2);
 assert.deepEqual(commerce.list('tech','Todos','fone').map(p=>p.id),['t01','t02']);
 assert.equal(commerce.list('tech','Todos','camera').length,1);
 assert.equal(commerce.list('pet','Todos','coleira').length,1);
 const prices=commerce.list('tech','Todos','','menor').map(p=>p.price);
 assert.deepEqual(prices,[...prices].sort((a,b)=>a-b));
 const expensive=commerce.list('pet','Todos','','maior').map(p=>p.price);
 assert.deepEqual(expensive,[...expensive].sort((a,b)=>b-a));
 assert.equal(commerce.list('pet','Todos','inexistente').length,0);
});
test('Carrinho imutável soma itens e respeita variações, limites e frete demonstrativo',()=>{
 const first=commerce.add([],'t02','Branco',1);
 assert.deepEqual(first,[{id:'t02',variant:'Branco',quantity:1}]);
 assert.deepEqual(commerce.totals(first),{subtotal:24900,delivery:2490,total:27390,quantity:1,freeDelivery:false});
 const same=commerce.add(first,'t02','Branco',1);
 assert.equal(first[0].quantity,1);assert.equal(same[0].quantity,2);
 assert.deepEqual(commerce.totals(same),{subtotal:49800,delivery:0,total:49800,quantity:2,freeDelivery:true});
 const different=commerce.add(same,'t02','Preto',1);
 assert.equal(different.length,2);
 const deleted=commerce.setQuantity(different,'t02','Branco',0);
 assert.equal(deleted.length,1);
 assert.equal(commerce.totals([]).total,0);
 assert.equal(commerce.add([],'t02','Vermelho',1),null);
 assert.equal(commerce.add([],'t02','Branco',11),null);
 assert.equal(commerce.add([],'not-real','Branco',1),null);
 assert.equal(commerce.setQuantity([], 't02','Branco',2),null);
 assert.equal(commerce.setQuantity(first,'t02','Branco',11),null);
 assert.equal(commerce.totals([{id:'t02',variant:'Branco',quantity:999}]),null);
});
test('Novos e-commerces têm estrutura sem checkout e imagens fotográficas',()=>{
 for(const [filename,store] of [['demo-volta-tech.html','tech'],['demo-casa-patta.html','pet']]){
  const html=read(filename);
  assert.match(html,new RegExp('<body data-shop="'+store+'">'));
  assert.match(html,/USBRIN \/ PROJETO AUTORAL/);
  assert.match(html,/noindex,follow/);
  assert.match(html,/sem pedidos ou pagamentos reais/i);
  assert.match(html,/Finalização de compra indisponível/);
  assert.match(html,/https:\/\/images\.unsplash\.com\/photo-/);
  assert.match(html,/href="portfolio\.html"/);
  assert.match(html,/href="studio\.html"/);
  for(const id of ['catalog-search','catalog-sort','category-filters','product-grid','product-dialog','cart-dialog','detail-variant','detail-quantity','cart-items','cart-total']){
   assert.ok(html.includes('id="'+id+'"'),filename+' campo ausente: '+id);
  }
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size,filename+' IDs repetidos');
  for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),filename+' âncora inválida: '+id);
 }
 for(const f of ['js/portfolio-commerce.js','js/demo-commerce.js'])new vm.Script(read(f),{filename:f});
});
