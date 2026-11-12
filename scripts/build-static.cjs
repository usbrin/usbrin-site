'use strict';
/* Build allowlisted static website for production and preview hosting. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const pages = ['index.html','studio.html','privacidade.html','parceiros.html','portfolio.html','demo-forno-82.html','demo-salao-orla.html','demo-eixo-consultoria.html','demo-doce-mira.html','demo-opala-cloud.html','demo-nara-derma.html','demo-pausa.html','demo-arena-movimento.html','demo-aflora-spa.html','demo-linho-interiores.html','demo-casa-smash.html','demo-aurora-eventos.html','demo-maia-advocacia.html','demo-brilho-casa.html','demo-luz-solar.html','demo-barbearia-quadro.html','demo-escola-trilhas.html','demo-oficio-tecnico.html','demo-aulas-prisma.html','demo-vertice-digital.html','demo-casa-rio.html','demo-rota-brasil.html','demo-selva-viva.html','demo-ponto-filmes.html','demo-grid-estudio.html','demo-harmonia-lab.html','demo-cafe-orvalho.html','demo-helena-luz.html','demo-vereda-planejados.html','demo-sorriso-claro.html','demo-vista-hotel.html','demo-motor-forma.html','demo-aurea-joias.html','demo-essencia-cosmeticos.html','demo-lume-moda.html','demo-base-norte.html','demo-volta-tech.html','demo-casa-patta.html','demo-norte-contabil.html','demo-nexo-automacao.html','demo-pilar.html','demo-nimbo.html','demo-atelier.html','demo-fluxo.html','demo-flor-raiz.html','demo-ponte-idiomas.html','demo-clinica.html','demo-construtora.html','demo-imobiliaria.html','demo-restaurante.html','sitemap.xml','_headers'];
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
const productionBranch='feature/usbrin-studio-mvp';
const configuredURL=process.env.PUBLIC_SITE_URL ||
  (process.env.CF_PAGES_BRANCH===productionBranch ? 'https://usbrin.com.br/' : '') ||
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
  if(process.env.CF_PAGES_BRANCH&&process.env.CF_PAGES_BRANCH!=='feature/usbrin-studio-mvp'){
    const partnersPath=path.join(output,'parceiros.html');
    const partners=fs.readFileSync(partnersPath,'utf8');
    fs.writeFileSync(partnersPath,partners.replace('<head>','<head><meta name="robots" content="noindex,nofollow">'));
  }
  // O índice comercial é público apenas na branch de produção.
  const portfolioPath=path.join(output,'portfolio.html');
  let gallery=fs.readFileSync(portfolioPath,'utf8');
  if(process.env.CF_PAGES_BRANCH===productionBranch)
    gallery=gallery.replace('<meta name="robots" content="noindex,follow">','<meta name="robots" content="index,follow">');
  else if(process.env.CF_PAGES_BRANCH)
    gallery=gallery.replace('<meta name="robots" content="noindex,follow">','<meta name="robots" content="noindex,nofollow">');
  fs.writeFileSync(portfolioPath,gallery);

  const urls=[base+'/',base+'/studio.html',base+'/parceiros',base+'/portfolio.html'];
  const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
    urls.map(x=>'<url><loc>'+x+'</loc></url>').join('\n')+'\n</urlset>\n';
  fs.writeFileSync(path.join(output,'sitemap.xml'),sitemap);
}
const homepage=fs.readFileSync(path.join(output,'index.html'),'utf8');
if(!homepage.includes('href="studio.html"')) throw new Error('Link do Studio ausente na página inicial.');
const studioPage=fs.readFileSync(path.join(output,'studio.html'),'utf8');
if(!studioPage.includes('id="studio-form"')) throw new Error('Formulário do Studio ausente.');
console.log('Bundle estático gerado em dist: '+pages.length+' páginas e '+folders.length+' diretórios.');