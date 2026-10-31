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
for(const name of ['studio.html','index.html']){
  const content=fs.readFileSync(path.join(output,name),'utf8');
  if(!content.includes('studio.html'))throw new Error('Acesso ao Studio não encontrado em '+name);
}
console.log('Bundle estático pronto em dist/ — '+pages.length+' páginas e '+folders.length+' diretórios.');
