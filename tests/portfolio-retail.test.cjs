'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const lab=require('../js/portfolio-retail.js');
test('Motor define 12 fichas conceituais e categorias válidas',()=>{
 assert.equal(lab.fashion.length,6);assert.equal(lab.materials.length,6);
 assert.equal(new Set([...lab.fashion,...lab.materials].map(p=>p.id)).size,12);
 assert.equal(lab.catalog('fashion').length,6);assert.equal(lab.catalog('materials').length,6);
 assert.equal(lab.catalog('unknown').length,0);
 assert.equal(lab.catalog('fashion','Alfaiataria').length,2);
 assert.equal(lab.catalog('materials','Revestimentos').length,2);
 assert.equal(lab.catalog('fashion','Todos','camisa').length,1);
 assert.equal(lab.catalog('materials','Todos','pintura').length,2);
 for(const product of [...lab.fashion,...lab.materials])assert.ok(/^https:\/\/images\.unsplash\.com\/photo-/.test(product.photo));
});
test('Composição permite três peças e recusa duplicadas ou desconhecidas',()=>{
 assert.deepEqual(lab.outfit(['f01','f02']),{pieces:2,total:65800});
 assert.deepEqual(lab.outfit([]),{pieces:0,total:0});
 assert.equal(lab.outfit(['f01','f01']),null);
 assert.equal(lab.outfit(['f01','f02','f03','f04']),null);
 assert.equal(lab.outfit(['x']),null);
 assert.deepEqual(lab.sizeGuide({size:'M'}),{size:'M',reference:100,note:'Circunferência da peça ilustrativa em centímetros; não equivale a medidas corporais ou recomendação automática de tamanho.'});
 assert.equal(lab.sizeGuide({size:'XXL'}),null);
});
test('Revestimentos calculam perdas e número de caixas hipotéticas',()=>{
 assert.deepEqual(lab.calculateFloor({area:36,loss:10,boxCoverage:2}),{area:36,loss:10,boxCoverage:2,effective:39.6,boxes:20,coverage:40});
 assert.equal(lab.calculateFloor({area:1,loss:0,boxCoverage:1}).boxes,1);
 for(const bad of [{area:0,loss:10,boxCoverage:2},{area:501,loss:10,boxCoverage:2},{area:36,loss:-1,boxCoverage:2},{area:36,loss:26,boxCoverage:2},{area:36,loss:10,boxCoverage:0},{area:NaN,loss:10,boxCoverage:2}])assert.equal(lab.calculateFloor(bad),null);
});
test('Pintura calcula consumo por demãos e latas ilustrativas',()=>{
 assert.deepEqual(lab.calculatePaint({area:48,coats:2,yieldM2PerLiter:10,canLiters:18}),{liters:9.6,cans:1,coverageLiters:18});
 assert.equal(lab.calculatePaint({area:150,coats:3,yieldM2PerLiter:9,canLiters:18}).cans,3);
 for(const bad of [{area:0,coats:2,yieldM2PerLiter:10,canLiters:18},{area:48,coats:0,yieldM2PerLiter:10,canLiters:18},{area:48,coats:2.5,yieldM2PerLiter:10,canLiters:18},{area:48,coats:2,yieldM2PerLiter:0,canLiters:18},{area:48,coats:2,yieldM2PerLiter:10,canLiters:0}])assert.equal(lab.calculatePaint(bad),null);
});
test('Lista de referência soma valores e rejeita quantidades inválidas',()=>{
 assert.deepEqual(lab.quote([{id:'m01',quantity:40},{id:'m03',quantity:1}]),{lines:2,units:41,total:353500});
 assert.deepEqual(lab.quote([]),{lines:0,units:0,total:0});
 assert.equal(lab.quote([{id:'m01',quantity:0}]),null);
 assert.equal(lab.quote([{id:'m01',quantity:501}]),null);
 assert.equal(lab.quote([{id:'unknown',quantity:1}]),null);
 assert.equal(lab.quote(null),null);
});
test('Páginas têm rotas, fotos, ferramentas e transparência',()=>{
 for(const [file,kind] of [['demo-lume-moda.html','fashion'],['demo-base-norte.html','materials']]){
  const html=read(file);assert.match(html,new RegExp('<body data-retail="'+kind+'">'));
  assert.match(html,/noindex,follow/);assert.match(html,/PROJETO AUTORAL USBRIN/);
  assert.match(html,/nenhuma venda real/i);
  assert.match(html,/src="js\/portfolio-retail\.js"/);
  assert.match(html,/src="js\/demo-retail\.js"/);
  assert.match(html,/href="portfolio\.html"/);
  assert.match(html,/href="studio\.html"/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(v=>v[1]);assert.equal(ids.length,new Set(ids).size,file+' id duplicado');
  for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),file+' âncora não encontrada '+id);
 }
 for(const file of ['js/portfolio-retail.js','js/demo-retail.js'])new vm.Script(read(file),{filename:file});
});
test('Lume mostra look e medidas; Base Norte mostra estimativas e cotação',()=>{
 const fashion=read('demo-lume-moda.html'),materials=read('demo-base-norte.html');
 for(const id of ['look-items','look-total','clear-look','detail-size','size-guide'])assert.ok(fashion.includes('id="'+id+'"'),id);
 for(const id of ['floor-area','floor-loss','floor-box','floor-result','paint-area','paint-coats','paint-yield','paint-result','quote-items','quote-total','copy-quote'])assert.ok(materials.includes('id="'+id+'"'),id);
});
