'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const doce=require('../js/demo-doce-mira.js');
const opala=require('../js/demo-opala-cloud.js');
test('Doce Mira calcula em centavos e mantém opções hipotéticas determinísticas',()=>{
 assert.equal(Object.keys(doce.flavors).length,3);
 assert.equal(Object.keys(doce.sizes).length,3);
 assert.equal(doce.estimate('baunilha','10','classico','nenhum').totalCents,8900);
 assert.equal(doce.estimate('chocolate','20','floral','frutas').totalCents,18200);
 assert.equal(doce.estimate('limao','30','minimal','chocolate').totalCents,21200);
 assert.equal(doce.normalize('  CAÇÚ  '),'cacu');
 const summary=doce.summaryText(doce.estimate('baunilha','10','classico','nenhum'));
 assert.match(summary,/NÃO É ENCOMENDA/);assert.match(summary,/89,00/);
});
test('Doce Mira rejeita todos os parâmetros não previstos',()=>{
 for(const args of [['x','10','classico','nenhum'],['baunilha','8','classico','nenhum'],['baunilha','10','premium','nenhum'],['baunilha','10','classico','pedido']]){
  assert.throws(()=>doce.estimate(...args),RangeError);
 }
});
test('Opala Cloud tem custo simulado em centavos e limites de recursos',()=>{
 const a=opala.calculate('base',1,'50','standard');
 assert.equal(a.totalCents,13800);assert.equal(a.cpu,2);assert.equal(a.ram,4);
 const b=opala.calculate('growth',2,'200','extra');
 assert.equal(b.cpu,8);assert.equal(b.ram,16);assert.equal(b.totalCents,66100);
 assert.match(opala.summaryText(b),/NÃO É COTAÇÃO/);
});
test('Opala rejeita perfis, quantidades, armazenamento e políticas fora da lista',()=>{
 for(const args of [['invalid',1,'50','standard'],['base',0,'50','standard'],['base',5,'50','standard'],['base',1.5,'50','standard'],['base',NaN,'50','standard'],['base',1,'30','standard'],['base',1,'50','premium']]){
  assert.throws(()=>opala.calculate(...args),RangeError);
 }
});
test('Duas demos documentam caráter conceitual, links válidos e acessibilidade',()=>{
 for(const [htmlPath,cssPath,jsPath] of [['demo-doce-mira.html','css/demo-doce-mira.css','js/demo-doce-mira.js'],['demo-opala-cloud.html','css/demo-opala-cloud.css','js/demo-opala-cloud.js']]){
  const html=read(htmlPath);
  assert.match(html,/PROJETO AUTORAL USBRIN/);assert.match(html,/content="noindex,follow"/);
  assert.match(html,/href="portfolio.html"/);assert.match(html,/href="studio.html"/);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'ID duplicado: '+htmlPath);
  for(const id of [...html.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]))assert.ok(ids.includes(id),'Âncora ausente '+id);
  assert.ok(fs.existsSync(path.join(root,cssPath)));assert.ok(fs.existsSync(path.join(root,jsPath)));
  assert.ok(html.includes('src="'+jsPath+'"'));assert.ok(html.includes('href="'+cssPath+'"'));
  new vm.Script(read(jsPath),{filename:jsPath});
  assert.match(html,/aria-live="polite"/);
  assert.doesNotMatch(read(jsPath),/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon/);
 }
 const gallery=read('portfolio.html'),build=read('scripts/build-static.cjs');
 for(const page of ['demo-doce-mira.html','demo-opala-cloud.html']){
  assert.match(gallery,new RegExp('href="'+page+'"'));assert.ok(build.includes("'"+page+"'"));
 }
 assert.equal((read('demo-doce-mira.html').match(/class="product" data-category=/g)||[]).length,6);
 assert.equal((read('demo-opala-cloud.html').match(/class="service"/g)||[]).length,3);
});
