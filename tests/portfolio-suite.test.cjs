'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../js/portfolio-suite.js');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Cenários de contabilidade têm regras determinísticas, sem tributação presumida',()=>{
  const b=api.finance(api.scenarios.base);
  assert.deepEqual(b,{variableCost:16640,contribution:35360,result:11860,marginRate:.68,breakeven:34559,cashGap:24197,viable:true});
  const c=api.finance(api.scenarios.conservador);
  assert.equal(c.result,-1180);assert.equal(c.viable,false);
  assert.equal(api.finance(api.scenarios.expansao).result,19160);
});
test('Valida entrada e limites em indicadores de negócios',()=>{
  assert.equal(api.finance({revenue:0,fixed:0,variable:0,receivable:0,payable:0}).result,0);
  const initial=api.scenarios.base;
  for(const [field,value] of [['revenue',-1],['fixed',-1],['variable',100],['receivable',91],['payable',91],['revenue',Infinity],['fixed',NaN]]){
    assert.equal(api.finance({...initial,[field]:value}),null,field);
  }
  assert.equal(api.finance({}),null);
  assert.ok(Object.isFrozen(api.scenarios.base));
});
test('Automação cria quatro etapas configuráveis, sem conexão externa',()=>{
  for(const template of ['comercial','atendimento','operacoes']){
    const result=api.flow({template,channel:'site',priority:'alta',delay:10});
    assert.equal(result.steps.length,4);
    assert.match(result.steps[1].note,/Alta/);
    assert.match(result.steps[2].note,/10 minutos/);
    assert.ok(Object.isFrozen(result.steps));
  }
  assert.match(api.flow({template:'comercial',channel:'email',priority:'normal',delay:0}).steps[2].note,/Sem espera/);
  assert.equal(api.flow({template:'unknown',channel:'site',priority:'alta',delay:10}),null);
  assert.equal(api.flow({template:'comercial',channel:'invalid',priority:'alta',delay:10}),null);
  assert.equal(api.flow({template:'comercial',channel:'site',priority:'invalid',delay:10}),null);
  assert.equal(api.flow({template:'comercial',channel:'site',priority:'alta',delay:61}),null);
});
test('Novas páginas têm assets locais, navegação e identidade de demonstração explícita',()=>{
  for(const [page,id] of [['demo-norte-contabil.html','norte'],['demo-nexo-automacao.html','nexo']]){
    const html=read(page);
    assert.match(html,new RegExp('<body data-suite="'+id+'">'));
    assert.match(html,/projeto autoral USBRIN/i);
    assert.match(html,/noindex,follow/);
    assert.match(html,/href="portfolio\.html"/);
    assert.match(html,/href="studio\.html"/);
    assert.match(html,/src="js\/portfolio-suite\.js"/);
    assert.match(html,/src="js\/demo-suite\.js"/);
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(ids.length,new Set(ids).size,'ID repetido em '+page);
    for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),'Âncora inválida '+id);
    for(const [,src] of html.matchAll(/<img[^>]+src="([^"]+)"/g))assert.ok(fs.existsSync(path.join(root,src)),'Asset ausente '+src);
  }
  for(const script of ['js/portfolio-suite.js','js/demo-suite.js'])new vm.Script(read(script),{filename:script});
});
test('Nexo tem simulador e Norte tem entradas e indicadores acessíveis',()=>{
  const norte=read('demo-norte-contabil.html'),nexo=read('demo-nexo-automacao.html');
  for(const id of ['finance-form','finance-revenue','finance-fixed','finance-variable','finance-receivable','finance-payable','finance-result','finance-cash'])
    assert.ok(norte.includes('id="'+id+'"'),id);
  for(const id of ['flow-form','flow-template','flow-channel','flow-delay','flow-next','flow-restart','flow-nodes','flow-log'])
    assert.ok(nexo.includes('id="'+id+'"'),id);
  assert.equal((nexo.match(/data-step=/g)||[]).length,4);
  assert.equal((norte.match(/data-scenario=/g)||[]).length,3);
  assert.match(nexo,/Nenhum sistema externo é conectado/);
  assert.match(norte,/Não presta serviços contábeis/);
});
