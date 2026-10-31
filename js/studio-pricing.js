/* USBRIN Studio — regras comerciais provisórias (não constituem proposta). */
(function(root,factory){
  'use strict';
  const engine=factory();
  if(typeof module==='object'&&module.exports) module.exports=engine;
  else root.USBRIN_PRICING=engine;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='mvp-2026-10-30';
  const PRODUCTS=Object.freeze({
    landing:Object.freeze({label:'USBRIN Landing',base:690,pages:1,maxPages:1,description:'Uma página com até seis seções padrão'}),
    business:Object.freeze({label:'USBRIN Business',base:1190,pages:5,maxPages:15,description:'Até cinco páginas padronizadas'}),
    catalogo:Object.freeze({label:'USBRIN Catálogo',base:1790,pages:5,maxPages:15,description:'Até 20 itens de catálogo, sem checkout'})
  });
  const FEATURES=Object.freeze({
    whatsapp:Object.freeze({label:'Botão de WhatsApp',price:0}),
    formulario:Object.freeze({label:'Formulário avançado',price:150}),
    galeria:Object.freeze({label:'Galeria de projetos',price:180}),
    blog:Object.freeze({label:'Blog gerenciável',price:450})
  });
  const PAGE_PRICE=120;
  const STYLES=Object.freeze(['moderno','minimalista','elegante','editorial']);
  function normalize(payload){
    const s=payload&&typeof payload==='object'?payload:{};
    const product=Object.hasOwn(PRODUCTS,s.product)?s.product:'business';
    const item=PRODUCTS[product];
    const rawPages=Number(s.pages);
    const pages=Number.isInteger(rawPages)?Math.max(1,Math.min(item.maxPages,rawPages)):item.pages;
    const features=Array.isArray(s.features)?[...new Set(s.features.filter(x=>typeof x==='string'&&Object.hasOwn(FEATURES,x)))]:['whatsapp'];
    const style=STYLES.includes(s.style)?s.style:'moderno';
    const special=Boolean(s.special);
    const largeCatalog=product==='catalogo'&&Boolean(s.largeCatalog);
    return {product,pages,features,style,special,largeCatalog};
  }
  function calculate(payload){
    const s=normalize(payload);
    const product=PRODUCTS[s.product];
    const extraPages=Math.max(0,s.pages-product.pages);
    const featuresTotal=s.features.reduce((n,key)=>n+FEATURES[key].price,0);
    const estimate=product.base+extraPages*PAGE_PRICE+featuresTotal;
    const reviewRequired=s.special||s.largeCatalog;
    const lineItems=[
      {label:product.label,amount:product.base},
      ...(extraPages?[{label:extraPages+' página(s) adicional(is)',amount:extraPages*PAGE_PRICE}]:[]),
      ...s.features.map(key=>({label:FEATURES[key].label,amount:FEATURES[key].price}))
    ];
    return {...s,estimate,reviewRequired,lineItems,version:VERSION,description:product.description};
  }
  function money(amount){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(amount)}
  return Object.freeze({VERSION,PRODUCTS,FEATURES,STYLES,PAGE_PRICE,normalize,calculate,money});
});
