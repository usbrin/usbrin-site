'use strict';
/* Build an allowlisted static bundle for deployment. Avoid exposing tests, docs or repository files. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.join(root,'dist');
const pages=['index.html','studio.html','privacidade.html','demo-clinica.html','demo-construtora.html','demo-imobiliaria.html','demo-restaurante.html','sitemap.xml'];
const folders=['assets','css','js'];
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
for(const name of pages){
  const from=path.join(root,name);
  if(!fs.existsSync(from))throw new Error('Arquivo obrigatório ausente: '+name);
  fs.copyFileSync(from,path.join(output,name));
}
for(const folder of folders){
  const from=path.join(root,folder);
  if(!fs.existsSync(from))throw new Error('Diretório obrigatório ausente: '+folder);
  fs.cpSync(from,path.join(output,folder),{recursive:true});
}
// Deploy paths change, but original navigation remains relative and portable.
const envSite=process.env.PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
let canonicalBase='';
if(envSite){
  const url=new URL(envSite);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('PUBLIC_SITE_URL precisa ser uma URL https pública e simples.');
  canonicalBase=url.origin+url.pathname.replace(/\\/$/,'');
  const oldBase='https://usbrin.github.io/usbrin-site/';
  let homepage=fs.readFileSync(path.join(output,'index.html'),'utf8');
  homepage=homepage.split(oldBase).join(canonicalBase+'/');
  if(process.env.VERCEL_ENV==='preview')homepage=homepage.replace('<head>','<head>\\n<meta name="robots" content="noindex,nofollow">');
  fs.writeFileSync(path.join(output,'index.html'),homepage);
  let studio=fs.readFileSync(path.join(output,'studio.html'),'utf8');
  if(process.env.VERCEL_ENV==='production')studio=studio.replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow">');
  studio=studio.replace('<title>','<link rel="canonical" href="'+canonicalBase+'/studio.html">\\n<meta property="og:url" content="'+canonicalBase+'/studio.html">\\n<title>');
  fs.writeFileSync(path.join(output,'studio.html'),studio);
  const urls=[canonicalBase+'/',canonicalBase+'/studio.html'];
  const sitemap='<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n'+urls.map(x=>'<url><loc>'+x+'</loc></url>').join('\\n')+'\\n</urlset>\\n';
  fs.writeFileSync(path.join(output,'sitemap.xml'),sitemap);
}
for(const name of ['studio.html','index.html']){
  const content=fs.readFileSync(path.join(output,name),'utf8');
  if(!content.includes('studio.html'))throw new Error('Acesso ao Studio não encontrado em '+name);
}
console.log('Bundle estático pronto em dist/ — '+pages.length+' páginas e '+folders.length+' diretórios.');
