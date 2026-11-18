'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {catalog,MAX_QUANTITY,normalize,calculateSelection,totalCents,totalQuantity}=require('../js/demo-forno-82.js');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Seis sabores com preços exemplificativos em centavos',()=>{
 assert.equal(Object.keys(catalog).length,6);
 assert.ok(Object.values(catalog).every(x=>Number.isSafeInteger(x.cents)&&x.cents>0));
});
test('Busca normaliza acentos e maiúsculas',()=>{assert.equal(normalize('  MANJERICÃO  '),'manjericao');});
test('Cálculo determinístico por tamanho, borda e quantidade',()=>{
 let item=calculateSelection('brasata','grande','recheada',2);
 assert.equal(item.unitCents,9500);assert.equal(item.totalCents,19000);
 assert.equal(calculateSelection('napoli','individual','simples',1).totalCents,4700);
 assert.equal(totalQuantity([item]),2);assert.equal(totalCents([item]),19000);
});
test('Rejeita sabores, parâmetros e quantidades inválidas',()=>{
 for(const args of [['inexistente','individual','simples',1],['margherita','imenso','simples',1],['margherita','grande','premium',1],['margherita','grande','simples',0],['margherita','grande','simples',6],['margherita','grande','simples',1.5],['margherita','grande','simples',NaN]]){
  assert.throws(()=>calculateSelection(...args),RangeError);
 }
 assert.equal(MAX_QUANTITY,8);
});
test('Página contém metadados, feedback acessível e declarações de simulação',()=>{
 const html=read('demo-forno-82.html');
 assert.match(html,/data-demo="forno82"/);
 assert.match(html,/meta name="robots" content="noindex,follow"/);
 for(const id of ['pizza-form','pizza-search','pizza-flavor','pizza-size','pizza-edge','pizza-qty','order-items','order-total','order-status'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Não realiza pedidos ou pagamentos/);
 assert.match(html,/Fotos?|Fotografias/);
 assert.match(read('portfolio.html'),/href="demo-forno-82.html"/);
 assert.match(read('scripts/build-static.cjs'),/'demo-forno-82.html'/);
 assert.match(read('.github/workflows/portfolio-validation.yml'),/portfolio-forno\.test\.cjs/);
});
test('Página separa HTML, CSS e JavaScript por arquivo',()=>{
 const html=read('demo-forno-82.html');
 assert.match(html,/css\/demo-forno-82\.css/);assert.match(html,/js\/demo-forno-82\.js/);
 assert.equal((html.match(/<article class="pizza"/g)||[]).length,6);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.ok(!/localStorage|sessionStorage|fetch\(/.test(read('js/demo-forno-82.js')));
});
