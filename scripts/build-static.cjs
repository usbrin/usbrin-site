'use strict';
/* Build allowlisted static website for production and preview hosting. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const pages = ['index.html','studio.html','privacidade.html','demo-clinica.html','demo-construtora.html','demo-imobiliaria.html','demo-restaurante.html','parceiros.html','candidatura.html','status-candidatura.html','portal.html','privacidade-parceiros.html','privacidade-studio.html','proposta.html','sitemap.xml','_headers'];
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
// Isolated recruitment surface for Cloudflare Access path-scoped public preview.
// Only known public assets and explicitly public API functions live below /public/.
// Never copy admin interfaces, JS/portal.js, protected functions or private user data.
const recruitment=path.join(output,'public');
for(const dir of ['assets','css','js'])fs.mkdirSync(path.join(recruitment,dir),{recursive:true});
for(const filename of ['parceiros.html','candidatura.html','status-candidatura.html','privacidade-parceiros.html']){
  const source=path.join(root,filename);
  let page=fs.readFileSync(source,'utf8')
    .replaceAll('href="index.html"','href="https://usbrin-site.pages.dev/"')
    .replaceAll('href="studio.html"','href="https://usbrin-site.pages.dev/studio.html"')
    .replaceAll('href="privacidade.html"','href="https://usbrin-site.pages.dev/privacidade.html"')
    .replaceAll('href="portal.html"','href="/portal.html"');
  fs.writeFileSync(path.join(recruitment,filename),page);
}
fs.copyFileSync(path.join(recruitment,'parceiros.html'),path.join(recruitment,'index.html'));
for(const asset of [
  'assets/favicon-small.png','assets/usbrin-logo-sem-fundo.svg',
  'css/parceiros.css','js/candidatura.js','js/status-candidatura.js'
]){
  fs.copyFileSync(path.join(root,asset),path.join(recruitment,asset));
}
// PUBLIC_SITE_URL overrides the default for a later custom domain.
function cloudflareProductionUrl(raw){
  if(!raw)return '';
  const url=new URL(raw);
  const parts=url.hostname.split('.');
  // CF_PAGES_URL can point to a unique deployment; use stable project.pages.dev.
  if(parts.length===4 && url.hostname.endsWith('.pages.dev')){
    url.hostname=parts.slice(-3).join('.');
    url.pathname='/';
  }
  return url.origin+url.pathname;
}
const configuredURL=process.env.PUBLIC_SITE_URL ||
  cloudflareProductionUrl(process.env.CF_PAGES_URL) ||
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
const homepage=fs.readFileSync(path.join(output,'index.html'),'utf8');
if(!homepage.includes('href="studio.html"')) throw new Error('Link do Studio ausente na página inicial.');
const studioPage=fs.readFileSync(path.join(output,'studio.html'),'utf8');
if(!studioPage.includes('id="studio-form"')) throw new Error('Formulário do Studio ausente.');
console.log('Bundle estático gerado em dist: '+pages.length+' páginas e '+folders.length+' diretórios.');