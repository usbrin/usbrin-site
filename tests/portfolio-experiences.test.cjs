'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('../js/portfolio-experiences.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('Catálogo de hotelaria tem três suítes, capacidades e preços ilustrativos coerentes',()=>{
 assert.equal(model.rooms.length,3);
 assert.equal(new Set(model.rooms.map(x=>x.id)).size,3);
 assert.ok(model.rooms.every(x=>x.night>0&&x.guests>=2&&x.features.length===3&&x.photo.startsWith('https://images.unsplash.com/photo-')));
});
test('Simulador de hotel usa noites de calendário, hóspedes e opcionais',()=>{
 const q=model.lodging({roomId:'classic',arrival:'2027-01-05',departure:'2027-01-08',guests:2,breakfast:true});
 assert.deepEqual(q,{room:'Suíte Jardim',nights:3,guests:2,base:237000,supplement:51000,total:288000,perNight:79000,breakfast:true});
 assert.equal(model.lodging({roomId:'vista',arrival:'2027-02-02',departure:'2027-02-04',guests:3,breakfast:false}).total,224000);
 assert.equal(model.lodging({roomId:'residence',arrival:'2027-08-02',departure:'2027-08-05',guests:4,breakfast:false}).guests,4);
 for(const p of [
  {roomId:'none',arrival:'2027-01-05',departure:'2027-01-08',guests:2},
  {roomId:'classic',arrival:'2027-01-05',departure:'2027-01-05',guests:2},
  {roomId:'classic',arrival:'2027-01-10',departure:'2027-01-09',guests:2},
  {roomId:'classic',arrival:'2027-01-05',departure:'2027-02-03',guests:2},
  {roomId:'classic',arrival:'2027-01-05',departure:'2027-01-08',guests:3},
  {roomId:'classic',arrival:'2027-02-30',departure:'2027-03-02',guests:2},
  {roomId:'classic',arrival:'2027-01-05',departure:'2027-01-08',guests:2,breakfast:'yes'}
 ])assert.equal(model.lodging(p),null,JSON.stringify(p));
});
test('Estética automotiva aplica porte, complementos e horas exemplificativas',()=>{
 assert.equal(model.services.length,3);
 assert.equal(model.extras.length,3);
 const basic=model.automobile({serviceId:'express',size:'sedan',selectedExtras:['glass']});
 assert.deepEqual(basic,{name:'Cuidado Essencial',size:'sedan',base:38400,extras:12000,total:50400,hours:4,extrasCount:1});
 const premium=model.automobile({serviceId:'signature',size:'suv',selectedExtras:['interior','paint']});
 assert.deepEqual(premium,{name:'Detalhamento Signature',size:'suv',base:193500,extras:42000,total:235500,hours:15,extrasCount:2});
 assert.equal(model.automobile({serviceId:'none',size:'sedan'}),null);
 assert.equal(model.automobile({serviceId:'express',size:'truck'}),null);
 assert.equal(model.automobile({serviceId:'express',size:'suv',selectedExtras:['glass','glass']}),null);
 assert.equal(model.automobile({serviceId:'express',size:'suv',selectedExtras:['invalid']}),null);
});
test('Experiências novas têm identidade própria, navegação, imagens e nenhum checkout real',()=>{
 for(const [file,type] of [['demo-vista-hotel.html','hotel'],['demo-motor-forma.html','auto']]){
  const html=read(file);
  assert.match(html,new RegExp('<body data-experience="'+type+'">'));
  assert.match(html,/PROJETO AUTORAL/);
  assert.match(html,/noindex,follow/);
  assert.match(html,/src="js\/portfolio-experiences\.js"/);
  assert.match(html,/src="js\/demo-experiences\.js"/);
  assert.match(html,/href="portfolio\.html"/);
  assert.match(html,/href="studio\.html"/);
  assert.match(html,/https:\/\/images\.unsplash\.com\/photo-/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size,file+' duplicate IDs');
  for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),file+' invalid anchor: '+id);
 }
 for(const name of ['js/portfolio-experiences.js','js/demo-experiences.js'])new vm.Script(read(name),{filename:name});
});
test('Formulários são didáticos e sem redes, pagamentos ou dados pessoais',()=>{
 const hotel=read('demo-vista-hotel.html'),auto=read('demo-motor-forma.html');
 for(const id of ['hotel-arrival','hotel-departure','hotel-guests','hotel-breakfast','hotel-nights','hotel-total','hotel-error','room-options'])
  assert.ok(hotel.includes('id="'+id+'"'),id);
 for(const id of ['service-options','vehicle-options','auto-extras','auto-price-total','auto-duration','auto-copy'])
  assert.ok(auto.includes('id="'+id+'"'),id);
 assert.match(hotel,/Sem reservas reais/i);
 assert.match(auto,/Sem agenda, orçamento formal ou execução real/i);
 const ui=read('js/demo-experiences.js');
 assert.doesNotMatch(ui,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
});
