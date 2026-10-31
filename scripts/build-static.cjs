'use strict';
/* Build allowlisted static website for production and preview hosting. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const pages = ['index.html','studio.html','privacidade.html','demo-clinica.html','demo-construtora.html','demo-imobiliaria.html','demo-restaurante.html','sitemap.xml'];
const folders = ['assets','css','js'];
fs.rmSync(output, {recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
for(const filename of pages){
  const source=path.join(root,filename);
  if(!fs.existsSync(source)) throw new Error('Arquivo obrigatório ausente: '+filename);
  fs.copyFileSync(source,path.join(output,filename));
}
for(const folder of folders){
  const source=path.join(root,folder);
  if(!fs.existsSync(source)) throw new Error('Diretório obrigatório ausente: '+folder);
  fs.cpSync(source,path.join(output,folder),{recursive:true});
}
const configuredURL=process.env.PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
if(configuredURL){
  const website=new URL(configuredURL);
  if(website.protocol!=='https:'||website.username||website.password||website.search||website.hash)
    throw new Error('PUBLIC_SITE_URL deve ser uma URL https pública e simples.');
  const base=website.origin+website.pathname.replace(/\/$/,'');
  const old='https://usbrin.github.io/usbrin-site/';
  let home=fs.readFileSync(path.join(output,'index.html'),'utf8');
  home=home.split(old).join(base+'/');
  if(process.env.VERCEL_ENV==='preview') home=home.replace('<head>','<head>\n<meta name="robots" content="noindex,nofollow">');
  fs.writeFileSync(path.join(output,'index.html'),home);
  let studio=fs.readFileSync(path.join(output,'studio.html'),'utf8');
  if(process.env.VERCEL_ENV==='production')
    studio=studio.replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow">');
  studio=studio.replace('<title>','<link rel="canonical" href="'+base+'/studio.html">\n<meta property="og:url" content="'+base+'/studio.html">\n<title>');
  fs.writeFileSync(path.join(output,'studio.html'),studio);
  const urls=[base+'/',base+'/studio.html'];
  const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
    urls.map(x=>'<url><loc>'+x+'</loc></url>').join('\n')+'\n</urlset>\n';
  fs.writeFileSync(path.join(output,'sitemap.xml'),sitemap);
}
for(const filename of ['studio.html','index.html']){
  const content=fs.readFileSync(path.join(output,filename),'utf8');
  if(!content.includes('studio.html')) throw new Error('Acesso ao Studio ausente: '+filename);
}
console.log('Bundle estático gerado em dist: '+pages.length+' páginas e '+folders.length+' diretórios.');