'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pricing=require('../js/studio-pricing.js');
const home=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const money=raw=>Number(raw.replace(/\./g,'').replace(',','.'));
const extractPlan=(title)=>{
  const at=home.indexOf('<h3>'+title+'</h3>');
  assert.ok(at>=0,'Plano ausente do site: '+title);
  const articleEnd=home.indexOf('</article>',at);
  assert.ok(articleEnd>at,'Artigo do plano não encontrado: '+title);
  const source=home.slice(at,articleEnd);
  const price=source.match(/<div class="commercial-price">[\s\S]*?<strong>R\$\s*([\d.,]+)<\/strong>/);
  assert.ok(price,'Preço ausente do plano: '+title);
  return {price:money(price[1]),source};
};
for(const [title,key,slug] of [
  ['Landing Page','landing','landing'],
  ['Site Business','business','business'],
  ['Catálogo Digital','catalogo','catalogo']
]){
  test('site e Studio coincidem para '+title,()=>{
    const p=extractPlan(title);
    assert.equal(p.price,pricing.PRODUCTS[key].base,'O site e o Studio não podem anunciar valores diferentes');
    assert.ok(p.source.includes('studio.html?tipo='+slug+'#modelos'),'Botão do plano deve continuar levando ao Studio');
    assert.ok(p.source.includes('Pagamento único'),'Condição de pagamento não deve ficar ambígua');
  });
}
const addon=(title)=>{
  const at=home.indexOf('<h4>'+title+'</h4>');
  assert.ok(at>=0,'Serviço ausente: '+title);
  const source=home.slice(at,home.indexOf('</article>',at));
  const price=source.match(/class="addon-price">R\$\s*([\d.,]+)/);
  assert.ok(price,'Preço do serviço ausente: '+title);
  const value=price[1];
  const href=source.match(/<a href="([^"]+)"/);
  assert.ok(href,'Falta link do serviço: '+title);
  return {value,link:decodeURIComponent(href[1])};
};
for(const title of ['USBRIN Publicação','Registro USBRIN','Publicação Completa (Recomendado)']){
  test('serviço '+title+' mantém preço coerente com link do WhatsApp',()=>{
    const a=addon(title);
    assert.ok(a.link.includes('R$ '+a.value),'WhatsApp anuncia preço diferente do site');
    assert.ok(money(a.value)>0);
  });
}
test('USBRIN Care informa mensalidade consistente no contato',()=>{
  const start=home.indexOf('class="commercial-care"');
  const source=home.slice(start,home.indexOf('</section>',start));
  const shown=source.match(/<strong>R\$\s*([\d.,]+)<\/strong>/);
  assert.ok(shown,'Mensalidade USBRIN Care não encontrada');
  const links=[...source.matchAll(/href="([^"]+)"/g)].map(m=>decodeURIComponent(m[1]));
  assert.ok(links.some(link=>link.includes('R$ '+shown[1]+'/mês')),
    'WhatsApp precisa mostrar a mesma mensalidade do site');
  assert.ok(source.includes('opcional'));
});
test('cotação e USBRIN Studio continuam presentes na experiência comercial',()=>{
  assert.ok(home.includes('id="planos-usbrin"'));
  assert.ok(home.includes('href="studio.html"'));
  assert.ok(home.includes('id="studio"')||home.includes('USBRIN Studio'));
});
