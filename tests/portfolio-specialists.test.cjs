'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const m=require('../js/portfolio-specialists.js');
test('Vereda tem referências de três ambientes, acabamentos e layouts',()=>{
 assert.equal(m.rooms.length,3);assert.equal(m.finishes.length,3);assert.equal(m.layouts.length,3);
 assert.equal(new Set(m.rooms.map(x=>x.id)).size,3);
 assert.ok(m.rooms.every(x=>x.photo.startsWith('https://images.unsplash.com/photo-')&&x.highlights.length===3));
});
test('Vereda gera briefing sem preço, usando dimensões apenas aproximadas',()=>{
 const p={room:'cozinha',finish:'madeira',layout:'linear',width:3.2,height:2.5,notes:'Espaços fechados para utensílios'};
 const r=m.cabinetry(p);
 assert.equal(r.room,'Cozinha');assert.equal(r.finish,'Madeira natural');
 assert.deepEqual(r.dimensions,{width:3.2,height:2.5,illustrativeArea:8});
 assert.equal(r.notes,'Espaços fechados para utensílios');
 const summary=m.cabinetrySummary(p);
 assert.match(summary,/VEREDA PLANEJADOS/);assert.match(summary,/3,2 m/);
 assert.match(summary,/Espaços fechados para utensílios/);
 assert.match(summary,/não é orçamento/);
 for(const invalid of [
  {...p,width:0.5},{...p,width:13},{...p,width:NaN},{...p,height:1},{...p,height:4.2},
  {...p,room:'unknown'},{...p,finish:'gold'},{...p,layout:'circular'},
  {...p,notes:'x'.repeat(401)}
 ])assert.equal(m.cabinetry(invalid),null,JSON.stringify(invalid));
});
test('Sorriso Claro prepara apenas mensagem institucional sem dados pessoais',()=>{
 assert.equal(m.specialties.length,4);
 assert.equal(new Set(m.specialties.map(x=>x.id)).size,4);
 const a=m.dentalMessage({specialty:'clinica',topic:'informacoes',shift:'manha'});
 assert.match(a,/SORRISO CLARO/);assert.match(a,/Clínica geral/);assert.match(a,/manhã/);
 assert.match(a,/Não inclua dados de saúde/);
 assert.equal(m.dentalMessage({specialty:'invalid',topic:'informacoes',shift:'manha'}),null);
 assert.equal(m.dentalMessage({specialty:'clinica',topic:'diagnostico',shift:'manha'}),null);
 assert.equal(m.dentalMessage({specialty:'clinica',topic:'informacoes',shift:'invalid'}),null);
});
test('Páginas não representam serviços reais e não possuem âncoras ou IDs quebrados',()=>{
 for(const [file,mode] of [['demo-vereda-planejados.html','cabinetry'],['demo-sorriso-claro.html','dental']]){
  const html=read(file);
  assert.match(html,new RegExp('<body data-specialist="'+mode+'">'));
  assert.match(html,/PROJETO AUTORAL USBRIN/);
  assert.match(html,/noindex,follow/);
  assert.match(html,/src="js\/portfolio-specialists\.js"/);
  assert.match(html,/src="js\/demo-specialists\.js"/);
  assert.match(html,/href="portfolio\.html"/);
  assert.match(html,/href="studio\.html"/);
  assert.match(html,/https:\/\/images\.unsplash\.com\/photo-/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length,file+' ID duplicado');
  for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),file+' âncora ausente: '+id);
 }
 for(const path of ['js/portfolio-specialists.js','js/demo-specialists.js'])new vm.Script(read(path),{filename:path});
});
test('Nenhum backend, dado clínico ou envio automático é implementado',()=>{
 const js=read('js/demo-specialists.js');
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
 const dental=read('demo-sorriso-claro.html');
 assert.match(dental,/sem coleta de dados clínicos|não solicita sintomas|não inclua sintomas/i);
 assert.match(dental,/Não há envio nem marcação de consulta/);
 const cabinetry=read('demo-vereda-planejados.html');
 assert.match(cabinetry,/não calculamos área de mobiliário, preço, consumo ou viabilidade/i);
 assert.ok(dental.includes('id="dental-message"'));
 assert.ok(cabinetry.includes('id="vereda-summary-room"'));
});
