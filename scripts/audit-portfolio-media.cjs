'use strict';
/* Diagnóstico informativo do lote de fotografias — não copia, redistribui ou trata dados pessoais.
 * Um status HTTP isolado não comprova que imagem funciona para todos os visitantes.
 */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const atelier=require('../js/portfolio-atelier.js');
const files=['demo-aurea-joias.html','demo-essencia-cosmeticos.html','portfolio.html'];
const urls=new Map();
for(const x of [...atelier.jewelry,...atelier.cosmetics])urls.set(x.photo,{url:x.photo,product:x.name});
for(const file of files){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 const pattern=/https:\/\/images\.unsplash\.com\/photo-[\w-]+(?:\?[^"'<>\s]+)?/g;
 for(const match of html.matchAll(pattern)){
  const url=match[0].replace(/&amp;/g,'&');
  const key=url.split('?')[0];
  if(!urls.has(key))urls.set(key,{url,product:'Página '+file});
 }
}
const deduped=new Map();
for(const val of urls.values())deduped.set(val.url.split('?')[0],val);
const targets=[...deduped.values()];
async function check(item){
 try{
  const response=await fetch(item.url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(9000),headers:{'User-Agent':'USBRIN-Portfolio-Image-QA/1.0'}});
  return {name:item.product,status:response.status,ok:response.ok&&(response.headers.get('content-type')||'').startsWith('image/'),url:item.url.split('?')[0],mime:response.headers.get('content-type')};
 }catch(error){return {name:item.product,status:0,ok:false,url:item.url.split('?')[0],reason:String(error.message||error).slice(0,100)};}
}
(async()=>{
 const results=[];
 for(let i=0;i<targets.length;i+=5)results.push(...await Promise.all(targets.slice(i,i+5).map(check)));
 console.log('PHOTO_AUDIT SUMMARY',JSON.stringify({checked:results.length,ok:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length}));
 for(const x of results)console.log('PHOTO_AUDIT',JSON.stringify(x));
 if(results.some(x=>!x.ok))console.warn('ATENÇÃO: existem imagens externas com falhas nesta checagem. Revisar e hospedar mídia confiável antes de publicar em produção.');
})().catch(error=>{console.error(error);process.exitCode=1;});
