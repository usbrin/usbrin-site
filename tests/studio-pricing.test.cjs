/* Execute: node --test tests/studio-pricing.test.cjs */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const pricing=require('../js/studio-pricing.js');

test('institucional padrão',()=>{
  const q=pricing.calculate({});
  assert.equal(q.estimate,1190);
  assert.equal(q.pages,5);
  assert.equal(q.reviewRequired,false);
});
test('landing é limitada a uma página',()=>{
  const q=pricing.calculate({product:'landing',pages:9,features:[]});
  assert.equal(q.pages,1);
  assert.equal(q.estimate,690);
});
test('páginas extras só são cobradas acima da franquia',()=>{
  assert.equal(pricing.calculate({pages:3,features:[]}).estimate,1190);
  assert.equal(pricing.calculate({pages:7,features:[]}).estimate,1430);
});
test('preços de complementos e deduplicação',()=>{
  const q=pricing.calculate({features:['blog','blog','galeria','formulario','whatsapp','unexpected']});
  assert.equal(q.estimate,1970);
  assert.deepEqual(q.features,['blog','galeria','formulario','whatsapp']);
});
test('projeto especial exige análise e não é precificado automaticamente',()=>{
  const q=pricing.calculate({special:true});
  assert.equal(q.reviewRequired,true);
  assert.equal(q.estimate,1190);
});
test('catálogo ampliado exige análise',()=>{
  const q=pricing.calculate({product:'catalogo',largeCatalog:true});
  assert.equal(q.reviewRequired,true);
  assert.equal(q.estimate,1790);
});
test('flag de catálogo ampliado não afeta outros produtos',()=>{
  const q=pricing.calculate({product:'business',largeCatalog:true});
  assert.equal(q.largeCatalog,false);
  assert.equal(q.reviewRequired,false);
});
test('limite e valores inválidos não entram nos cálculos',()=>{
  assert.equal(pricing.calculate({product:'business',pages:9999,features:[]}).pages,15);
  assert.equal(pricing.calculate({product:'business',pages:-3,features:[]}).pages,1);
  assert.equal(pricing.calculate({product:'invalid',features:['invalid']}).estimate,1190);
  assert.equal(pricing.calculate({product:'catalogo',pages:'não é um número',features:[]}).pages,5);
});
test('estilo visual não altera o preço no MVP',()=>{
  assert.equal(pricing.calculate({style:'elegante'}).estimate,pricing.calculate({style:'moderno'}).estimate);
});
test('retorno usa valores inteiros não negativos',()=>{
  for(const product of Object.keys(pricing.PRODUCTS)){
    for(let pages=-2;pages<=20;pages++){
      const x=pricing.calculate({product,pages,features:['formulario','blog']});
      assert.ok(Number.isInteger(x.estimate)&&x.estimate>=0);
    }
  }
});
