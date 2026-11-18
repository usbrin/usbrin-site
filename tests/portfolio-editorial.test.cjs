'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),model=require('../js/portfolio-editorial.js');
test('Café Orvalho: catálogo de nove itens, busca, filtros e ordenação',()=>{
 assert.equal(model.menu.length,9);assert.equal(new Set(model.menu.map(x=>x.id)).size,9);
 assert.equal(model.catalog('Cafés').length,3);assert.equal(model.catalog('Comidas').length,3);assert.equal(model.catalog('Doces').length,3);
 assert.equal(model.catalog('Todos','latte').length,1);assert.equal(model.catalog('Todos','Café').length>=1,true);
 assert.equal(model.catalog('Todos','','menor')[0].id,'o01');
 assert.equal(model.catalog('Todos','','maior')[0].id,'o06');
 for(const item of model.menu){assert.ok(item.price>0);assert.ok(item.photo.startsWith('https://images.unsplash.com/photo-'));assert.ok(item.note);}
});
test('Cafeteria: seleção limita quatro itens diferentes e soma quantidade corretamente',()=>{
 assert.deepEqual(model.selection([]),{items:[],total:0,quantity:0});
 const r=model.selection([{id:'o01',quantity:2},{id:'o08',quantity:1}]);
 assert.equal(r.total,3950);assert.equal(r.quantity,3);assert.equal(r.items.length,2);
 assert.match(model.sampleBrief([{id:'o01',quantity:2}]),/Não é pedido, reserva ou preço comercial/);
 assert.match(model.sampleBrief([{id:'o08',quantity:1}]),/alergênicos/);
 for(const bad of [[{id:'o01',quantity:0}],[{id:'o01',quantity:11}],[{id:'o01',quantity:1},{id:'o01',quantity:1}],
 [{id:'bad',quantity:1}],[{id:'o01',quantity:2.5}],[{id:'o01',quantity:1},{id:'o02',quantity:1},{id:'o03',quantity:1},{id:'o04',quantity:1},{id:'o05',quantity:1}]]){
  assert.equal(model.selection(bad),null);
 }
 assert.equal(model.selection(null),null);
});
test('Cafeteria: três sugestões por ocasião permanecem válidas',()=>{
 assert.equal(model.moments.length,3);
 for(const x of model.moments){assert.ok(x.ids.length>=2);assert.ok(x.ids.every(id=>model.menu.some(m=>m.id===id)));assert.equal(model.moment(x.id),x);}
 assert.equal(model.moment('unknown'),null);
});
test('Helena Luz: oito referências e filtros sem atribuição de autoria fictícia',()=>{
 assert.equal(model.work.length,8);assert.equal(new Set(model.work.map(x=>x.id)).size,8);
 assert.equal(model.gallery('Todos').length,8);assert.equal(model.gallery('Retratos').length,3);assert.equal(model.gallery('Editorial').length,3);assert.equal(model.gallery('Histórias').length,2);assert.equal(model.gallery('invalid').length,0);
 assert.ok(model.work.every(x=>x.photo.startsWith('https://images.unsplash.com/photo-')&&x.caption&&x.category));
});
test('Helena Luz: briefing somente institucional, com limites de texto',()=>{
 const settings={type:'editorial',place:'externo',delivery:'selecao',notes:'Luz natural e fotografias de produto'};
 const r=model.session(settings);
 assert.equal(r.type,'Editorial de marca');assert.equal(r.place,'Ambiente externo');
 const brief=model.sessionBrief(settings);assert.match(brief,/HELENA LUZ/);assert.match(brief,/Luz natural/);assert.match(brief,/Não há disponibilidade ou contratação confirmada/);
 for(const bad of [{...settings,type:'bad'},{...settings,place:'bad'},{...settings,delivery:'bad'},{...settings,notes:'x'.repeat(301)}])assert.equal(model.session(bad),null);
});
test('Estrutura fotográfica com links, âncoras, autoria conceitual e sem operação real',()=>{
 for(const [file,kind] of [['demo-cafe-orvalho.html','cafe'],['demo-helena-luz.html','photo']]){
  const html=read(file);
  assert.match(html,new RegExp('<body data-editorial="'+kind+'">'));
  assert.match(html,/PROJETO AUTORAL USBRIN/);assert.match(html,/noindex,follow/);
  assert.match(html,/src="js\/portfolio-editorial\.js"/);
  assert.match(html,/src="js\/demo-editorial\.js"/);
  assert.match(html,/href="portfolio\.html"/);assert.match(html,/href="studio\.html"/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size,file+' ID duplicado');
  for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),file+' âncora ausente '+id);
 }
 assert.match(read('demo-cafe-orvalho.html'),/sem pedidos ou reservas reais/);
 assert.match(read('demo-helena-luz.html'),/não são trabalhos de Helena/);
 for(const file of ['js/portfolio-editorial.js','js/demo-editorial.js'])new vm.Script(read(file),{filename:file});
 assert.doesNotMatch(read('js/demo-editorial.js'),/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon/);
});
