'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const orla=require('../js/demo-salao-orla.js');
const eixo=require('../js/demo-eixo-consultoria.js');
test('Salão Orla organiza seis serviços, valida seleção e calcula tempo ilustrativo',()=>{
 assert.equal(Object.keys(orla.services).length,6);assert.equal(orla.MAX,3);
 assert.equal(orla.totalMinutes(['corte','luzes']),210);
 assert.match(orla.createBrief(['corte','spa'],'natural','tarde'),/135 minutos/);
 assert.throws(()=>orla.createBrief([], 'natural','tarde'),/Selecione/);
 assert.throws(()=>orla.createBrief(['corte','corte'],'natural','tarde'),RangeError);
 assert.throws(()=>orla.createBrief(['corte','escova','cor','spa'],'natural','tarde'),RangeError);
 assert.throws(()=>orla.createBrief(['invalido'],'natural','tarde'),RangeError);
 assert.throws(()=>orla.createBrief(['corte'],'outro','tarde'),RangeError);
});
test('Eixo Consultoria produz três orientações editoriais determinísticas',()=>{
 const map=eixo.generateMap('expansao',['margem','caixa'],'trimestre');
 assert.equal(map.steps.length,3);assert.match(map.steps[0],/demanda repetível/);
 assert.match(map.steps[1],/custos diretos/);assert.match(map.steps[2],/liquidez/);
 assert.match(eixo.toSummary(map),/NÃO É DIAGNÓSTICO/);
 const one=eixo.generateMap('inicio',['receita'],'agora');
 assert.equal(one.steps.length,3);assert.match(one.steps[2],/indicador/);
 assert.deepEqual(eixo.generateMap('inicio',['receita'],'agora'),one);
});
test('Eixo rejeita parâmetros não previstos, duplicados e ausência de escolha',()=>{
 for(const [stage,selection,horizon] of [['x',['caixa'],'agora'],['inicio',[],'agora'],['inicio',['caixa','caixa'],'agora'],['inicio',['caixa','receita','margem'],'agora'],['inicio',['x'],'agora'],['inicio',['caixa'],'nunca']])
 assert.throws(()=>eixo.generateMap(stage,selection,horizon),RangeError);
});
test('Dois sites têm contexto conceitual, identidade própria e recursos de acessibilidade',()=>{
 for(const file of ['demo-salao-orla.html','demo-eixo-consultoria.html']){
  const html=read(file);
  assert.match(html,/meta name="robots" content="noindex,follow"/);
  assert.match(html,/PROJETO AUTORAL USBRIN/);
  assert.match(html,/href="portfolio.html"/);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size,'IDs repetidos em '+file);
  for(const id of [...html.matchAll(/href="#([^"]+)"/g)].map(x=>x[1]))assert.ok(ids.includes(id),'Âncora inválida: '+id);
  const scripts=[...html.matchAll(/src="(js\/[^"]+\.js)"/g)].map(x=>x[1]);
  assert.equal(scripts.length,1);for(const script of scripts)new vm.Script(read(script),{filename:script});
  assert.match(html,/aria-live="polite"/);
 }
 assert.equal((read('demo-salao-orla.html').match(/class="service-card"/g)||[]).length,6);
 assert.equal((read('demo-eixo-consultoria.html').match(/name="challenge"/g)||[]).length,4);
});
test('Nenhuma integração de transação ou armazenamento entra nas demonstrações',()=>{
 for(const file of ['js/demo-salao-orla.js','js/demo-eixo-consultoria.js']){
  const js=read(file);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon/i);
 }
 for(const file of ['demo-salao-orla.html','demo-eixo-consultoria.html']){
  assert.doesNotMatch(read(file),/type="email"|type="tel"|name="email"|action="https?:/i);
 }
 const gallery=read('portfolio.html'),build=read('scripts/build-static.cjs');
 for(const [demo,css,js] of [['demo-salao-orla.html','css/demo-salao-orla.css','js/demo-salao-orla.js'],['demo-eixo-consultoria.html','css/demo-eixo-consultoria.css','js/demo-eixo-consultoria.js']]){
  assert.match(gallery,new RegExp('href="'+demo+'"'));
  assert.ok(build.includes("'"+demo+"'"));
  assert.ok(fs.existsSync(path.join(root,css)));assert.ok(fs.existsSync(path.join(root,js)));
 }
});
