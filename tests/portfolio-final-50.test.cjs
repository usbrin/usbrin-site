'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const slugs=["nara-derma","pausa","arena-movimento","aflora-spa","linho-interiores","casa-smash","aurora-eventos","maia-advocacia","brilho-casa","luz-solar","barbearia-quadro","escola-trilhas","oficio-tecnico","aulas-prisma","vertice-digital","casa-rio","rota-brasil","selva-viva","ponto-filmes","grid-estudio","harmonia-lab"];
const ui=require('../js/portfolio-concepts-50.js');
test('Coleção completa contém 50 experiências e 50 briefings contextuais',()=>{
  const gallery=read('portfolio.html');
  assert.equal((gallery.match(/<article class="project" data-category=/g)||[]).length,50);
  assert.equal((gallery.match(/data-project-brief/g)||[]).length,50);
  assert.equal((gallery.match(/class="featured-card"/g)||[]).length,6);
  const refs=[...gallery.matchAll(/<a class="preview" href="(demo-[^"]+)"/g)].map(x=>x[1]);
  assert.equal(refs.length,50);assert.equal(new Set(refs).size,50);
});
test('Novas 21 demos são completas, únicas e incluídas no build',()=>{
 const build=read('scripts/build-static.cjs');const markup=read('portfolio.html');
 for(const slug of slugs){const name='demo-'+slug+'.html',html=read(name);
  assert.ok(build.includes("'"+name+"'"));assert.ok(markup.includes('href="'+name+'"'));
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.equal((html.match(/<img\b/g)||[]).length,5);
  assert.match(html,/PROJETO AUTORAL USBRIN/);
  assert.match(html,/content="noindex,follow"/);
  assert.match(html,/href="portfolio.html"/);
  assert.match(html,/href="studio.html"/);
  assert.match(html,/data-experience="portfolio-concept"/);
  assert.match(html,/css\/portfolio-concepts-50\.css/);
  assert.match(html,/js\/portfolio-concepts-50\.js/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length,'IDs duplicados '+name);
  for(const id of [...html.matchAll(/href="#([^"]+)"/g)].map(x=>x[1])) assert.ok(ids.includes(id),'Âncora '+id+' não existe em '+name);
  assert.ok(['chooser','tabs','explore'].some(m=>html.includes('data-widget="'+m+'"')),'Sem mecanismo interativo '+name);
 }
});
test('Interações compartilham código sem API, storage ou automação de contato',()=>{
 const code=read('js/portfolio-concepts-50.js');new vm.Script(code,{filename:'portfolio-concepts-50.js'});
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon/);
 assert.equal(ui.normalize('  INFORMAÇÃO  '),'informacao');
 assert.deepEqual(ui.uniqueSelection([],0),[0]);assert.deepEqual(ui.uniqueSelection([0],1),[0,1]);
 assert.deepEqual(ui.uniqueSelection([0,1],1),[0]);
 assert.throws(()=>ui.uniqueSelection([0,1],2),RangeError);
 assert.throws(()=>ui.uniqueSelection([],3.4),RangeError);
 assert.match(ui.summary('Marca',[{name:'A',desc:'B'}],[0]),/sem preço, contratação/i);
});
