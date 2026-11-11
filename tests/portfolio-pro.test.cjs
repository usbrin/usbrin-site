'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const engine=require('../js/portfolio-engine.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('O motor separa três estudos e seis modelos com IDs únicos e dados imutáveis',()=>{
  assert.equal(engine.projects.length,3);
  assert.equal(engine.items.length,6);
  assert.equal(new Set(engine.projects.map(p=>p.id)).size,3);
  assert.equal(new Set(engine.items.map(p=>p.id)).size,6);
  assert.ok(Object.isFrozen(engine.items));
  assert.ok(Object.isFrozen(engine.finishes));
});
test('Calculadora de engenharia usa premissas explícitas e resultados determinísticos',()=>{
  const x=engine.estimateConstruction({area:185,category:'residencial',complexity:'intermediaria'});
  assert.deepEqual(x,{base:633070,low:538110,high:728031,reserve:75968,unitCost:3422});
  assert.equal(engine.estimateConstruction({area:50,category:'industrial',complexity:'essencial'}).base,132500);
  assert.equal(engine.estimateConstruction({area:800,category:'corporativo',complexity:'detalhada'}).base,3748800);
  for(const bad of [0,49,801,Infinity,NaN,'185'])assert.equal(engine.estimateConstruction({area:bad,category:'residencial',complexity:'essencial'}),null);
  assert.equal(engine.estimateConstruction({area:100,category:'unknown',complexity:'essencial'}),null);
  assert.equal(engine.estimateConstruction({area:100,category:'residencial',complexity:'unknown'}),null);
});
test('Configuração de mobiliário usa dimensões, acabamento e ferragens corretamente',()=>{
  assert.deepEqual(engine.estimateFurniture({id:'n01',width:240,finish:'carvalho',premiumHardware:false}),{value:5400,base:5400,finish:'Carvalho claro',width:240});
  assert.equal(engine.estimateFurniture({id:'n01',width:280,finish:'nogueira',premiumHardware:true}).value,7900);
  assert.equal(engine.estimateFurniture({id:'n02',width:260,finish:'grafite',premiumHardware:false}).value,8610);
  assert.equal(engine.estimateFurniture({id:'n01',width:179,finish:'carvalho',premiumHardware:false}),null);
  assert.equal(engine.estimateFurniture({id:'n01',width:321,finish:'carvalho',premiumHardware:false}),null);
  assert.equal(engine.estimateFurniture({id:'n01',width:250,finish:'defeito',premiumHardware:false}),null);
  assert.equal(engine.estimateFurniture({id:'n01',width:250,finish:'carvalho',premiumHardware:'sim'}),null);
  assert.equal(engine.estimateFurniture({id:'inexistente',width:250,finish:'carvalho',premiumHardware:false}),null);
});
test('Filtros fazem busca por segmento e ignoram acentos',()=>{
  assert.equal(engine.filterProjects('Residencial').length,1);
  assert.equal(engine.filterProjects('Todos').length,3);
  assert.deepEqual(engine.filterItems('Escritório','estacao').map(i=>i.id),['n05']);
  assert.deepEqual(engine.filterItems('Todos','cozinha').map(i=>i.id),['n03']);
  assert.equal(engine.filterItems('Quarto','').length,2);
  assert.equal(engine.filterItems('Sala','inexistente').length,0);
});
test('Pilar e Nimbo possuem estrutura, conteúdo transparente, scripts e imagens locais',()=>{
  const entries=[['demo-pilar.html','css/demo-pilar.css','js/demo-pilar.js'],['demo-nimbo.html','css/demo-nimbo.css','js/demo-nimbo.js']];
  for(const [file,css,script] of entries){
    const html=read(file);
    assert.match(html,/<meta name="robots" content="noindex,follow">/);
    assert.match(html,/projeto autoral USBRIN/i);
    assert.match(html,/conceitua|hipotétic|ilustrativ/i);
    assert.match(html,new RegExp('href="'+css.replaceAll('.','\\.')+'"'));
    assert.match(html,new RegExp('src="'+script.replaceAll('.','\\.')+'"'));
    assert.match(html,/src="js\/portfolio-engine\.js"/);
    assert.match(html,/href="portfolio\.html"/);
    assert.match(html,/href="studio\.html"/);
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
    assert.equal(ids.length,new Set(ids).size,file+' contém ID repetido');
    for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),'Âncora faltante: '+id);
    for(const [,asset] of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(__dirname,'..',asset)),'Imagem inexistente: '+asset);
    new vm.Script(read(script),{filename:script});
  }
  new vm.Script(read('js/portfolio-engine.js'),{filename:'portfolio-engine.js'});
});
test('Catálogo oferece os seis produtos, filtros e configuração local',()=>{
  const html=read('demo-nimbo.html');
  assert.equal((html.match(/data-item-id=/g)||[]).length,6);
  assert.equal((html.match(/data-customize=/g)||[]).length,6);
  assert.equal((html.match(/data-compare=/g)||[]).length,6);
  assert.match(html,/id="config-form"/);assert.match(html,/id="compare-dialog"/);
});
test('Laboratório de engenharia mantém controles explícitos e mensagem de precaução',()=>{
  const html=read('demo-pilar.html');
  assert.equal((html.match(/data-project-category=/g)||[]).length,3);
  assert.equal((html.match(/data-phase=/g)||[]).length,4);
  assert.match(html,/id="lab-form"/);assert.match(html,/não é orçamento/i);
  assert.match(html,/id="project-dialog"/);
});
