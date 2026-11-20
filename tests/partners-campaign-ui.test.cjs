'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('parceiros.html','utf8');
const script=fs.readFileSync('js/parceiros-campaign.js','utf8');
const makeElement=()=>({textContent:'',classList:{
  items:new Set(),add(c){this.items.add(c)},remove(c){this.items.delete(c)},toggle(c,on){if(on)this.items.add(c);else this.items.delete(c)}
}});
async function render(options){
 const status=makeElement(),cta=makeElement();
 let onReady;
 const ctx={
  document:{addEventListener(type,cb){if(type==='DOMContentLoaded')onReady=cb},
    getElementById(id){return id==='representative-availability'?status:id==='representative-cta'?cta:null}},
  fetch:options.fetch
 };
 vm.runInNewContext(script,ctx,{filename:'parceiros-campaign.js'});
 assert.equal(typeof onReady,'function');
 await onReady();
 return {status,cta};
}
test('partners landing contains an accessible availability notice and real registration URL',()=>{
 assert.match(html,/id="representative-availability"[^>]*aria-live="polite"/);
 assert.match(html,/id="representative-cta" href="candidatura.html\?area=representante"/);
 assert.match(html,/src="js\/parceiros-campaign.js"/);
});
test('closed registration is never presented as open',async()=>{
 const ui=await render({fetch:async()=>({ok:true,json:async()=>({applicationTypes:[]})})});
 assert.match(ui.status.textContent,/ainda não abertas/i);
 assert.equal(ui.cta.textContent,'Conhecer candidatura');
});
test('representative-only API flag shows call-to-action without opening developer signups',async()=>{
 const ui=await render({fetch:async()=>({ok:true,json:async()=>({applicationTypes:['representante'],representativePreview:false})})});
 assert.match(ui.status.textContent,/abertas/i);
 assert.match(ui.cta.textContent,/representante/i);
 assert.equal(ui.status.classList.items.has('good'),true);
});
test('preview mode must warn users to submit synthetic data',async()=>{
 const ui=await render({fetch:async()=>({ok:true,json:async()=>({applicationTypes:['representante'],representativePreview:true})})});
 assert.match(ui.status.textContent,/@example.com/);
 assert.equal(ui.status.classList.items.has('good'),false);
});
test('network failure fails closed rather than claiming registration open',async()=>{
 const ui=await render({fetch:async()=>{throw Error('network failure')}});
 assert.match(ui.status.textContent,/Não foi possível confirmar/);
 assert.equal(ui.cta.textContent,'Conhecer candidatura');
});
