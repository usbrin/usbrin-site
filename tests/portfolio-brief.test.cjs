'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Os vinte e sete conceitos têm CTA de referência sem alterar o Studio',()=>{
 const html=read('portfolio.html');
 assert.equal((html.match(/<article class="project" data-category=/g)||[]).length,27);
 assert.equal((html.match(/data-project-brief/g)||[]).length,27);
 assert.match(html,/id="project-brief-dialog"/);
 assert.match(html,/id="brief-email"/);
 assert.match(html,/id="brief-preview"/);
 assert.match(html,/id="brief-objective"/);
 assert.match(html,/id="brief-notes"/);
 assert.match(html,/src="js\/portfolio-brief\.js"/);
 assert.ok(read('studio.html').includes('id="studio-form"'));
});
test('O briefing não realiza solicitação silenciosa nem coleta por rede',()=>{
 const js=read('js/portfolio-brief.js');
 new vm.Script(js,{filename:'portfolio-brief.js'});
 assert.match(js,/mailto:usbrin\.contato@gmail\.com/);
 assert.match(js,/navigator\.clipboard/);
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon/);
});
