'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const api=require('../js/portfolio-atelier.js');
test('Joias e cosméticos têm seis referências distintas por segmento',()=>{
 assert.equal(api.jewelry.length,6);assert.equal(api.cosmetics.length,6);
 assert.equal(new Set([...api.jewelry,...api.cosmetics].map(p=>p.id)).size,12);
 assert.equal(api.catalog('jewelry').length,6);assert.equal(api.catalog('cosmetics').length,6);
 assert.equal(api.catalog('jewelry','Brincos').length,2);
 assert.equal(api.catalog('cosmetics','Hidratar').length,2);
 assert.equal(api.catalog('jewelry','Todos','Colar').length,2);
 assert.equal(api.catalog('cosmetics','Todos','bruma').length,1);
 assert.equal(api.catalog('unknown').length,0);
 for(const product of [...api.jewelry,...api.cosmetics]){assert.ok(product.photo.startsWith('https://images.unsplash.com/photo-'));assert.ok(product.price>0);assert.ok(product.detail.length>25);}
});
test('Curadoria organiza sugestões de presentes por orçamento e ocasião',()=>{
 const b=api.giftFinder('aniversario',50000);
 assert.ok(b.length>0&&b.every(p=>p.price<=50000&&p.occasion.includes('aniversario')));
 const c=api.giftFinder('cotidiano',30000);
 assert.ok(c.every(p=>p.price<=30000&&p.occasion.includes('cotidiano')));
 assert.equal(api.giftFinder('desconhecida',50000),null);
 assert.equal(api.giftFinder('aniversario',10000),null);
 assert.equal(api.giftFinder('aniversario',Infinity),null);
 assert.equal(api.giftFinder('aniversario',500.5),null);
});
test('Comparador limita a duas joias e calcula embalagem opcional apenas uma vez',()=>{
 assert.deepEqual(api.comparison([]),{count:0,subtotal:0,wrapping:0,total:0,items:[]});
 const result=api.comparison(['j01','j02'],true);
 assert.equal(result.count,2);assert.equal(result.subtotal,68800);assert.equal(result.wrapping,2900);assert.equal(result.total,71700);
 assert.equal(api.comparison(['j01','j01']),null);
 assert.equal(api.comparison(['j01','j02','j03']),null);
 assert.equal(api.comparison(['unknown']),null);
 assert.equal(api.comparison(['j01'],'true'),null);
});
test('Routine Studio combina etapas e recusa escolhas incompatíveis',()=>{
 const a=api.routine('leve');
 assert.deepEqual(a.steps.map(p=>p.id),['c01','c03','c06']);
 assert.equal(a.total,27700);
 const b=api.routine('cremosa');
 assert.deepEqual(b.steps.map(p=>p.id),['c02','c04','c05']);
 assert.equal(b.total,31700);
 const c=api.routine('leve',{Hidratar:'c04'});
 assert.deepEqual(c.steps.map(p=>p.id),['c01','c04','c06']);
 assert.equal(api.routine('desconhecida'),null);
 assert.equal(api.routine('leve',{Hidratar:'c01'}),null);
 assert.equal(api.routine('leve',{Finalizar:'j01'}),null);
});
test('Documentos possuem navegação real, aviso conceitual, scripts e IDs únicos',()=>{
 for(const [file,kind] of [['demo-aurea-joias.html','jewelry'],['demo-essencia-cosmeticos.html','cosmetics']]){
  const html=read(file);assert.match(html,new RegExp('<body data-atelier="'+kind+'">'));
  assert.match(html,/PROJETO AUTORAL USBRIN/);
  assert.match(html,/noindex,follow/);
  assert.match(html,/não há vendas/i);
  assert.match(html,/src="js\/portfolio-atelier\.js"/);
  assert.match(html,/src="js\/demo-atelier-market\.js"/);
  assert.match(html,/href="portfolio\.html"/);
  assert.match(html,/href="studio\.html"/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,file+' IDs repetidos');
  for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),file+' âncora não resolvida: '+id);
 }
 for(const path of ['js/portfolio-atelier.js','js/demo-atelier-market.js'])new vm.Script(read(path),{filename:path});
});
test('Ferramentas específicas e feedback de interface estão presentes',()=>{
 const jewelry=read('demo-aurea-joias.html'),cos=read('demo-essencia-cosmeticos.html');
 for(const id of ['gift-occasion','gift-budget','gift-results','comparison-items','comparison-total','gift-wrap'])assert.ok(jewelry.includes('id="'+id+'"'));
 for(const id of ['routine-steps','routine-total','routine-reset','routine-texture-label'])assert.ok(cos.includes('id="'+id+'"'));
 assert.equal((cos.match(/data-texture=/g)||[]).length,2);
});
