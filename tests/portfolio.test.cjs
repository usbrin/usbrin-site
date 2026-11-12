'use strict';
/* USBRIN Portfolio — regressão estrutural sem dependências externas.
   Executar: node --test tests/portfolio.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const portfolio = read('portfolio.html');
const build = read('scripts/build-static.cjs');
const titles = [...portfolio.matchAll(/<article class="project"[^>]*data-category="([^"]+)"[^>]*>/g)];
const cards = [...portfolio.matchAll(/<article class="project"[^>]*data-category="([^"]+)"[^>]*>\s*<a class="preview" href="([^"]+)"/g)];
const filters = new Set([...portfolio.matchAll(/data-filter="([^"]+)"/g)].map(x => x[1]));
const imagePaths = [...portfolio.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)].map(x => x[1]);
const localFiles = new Set(fs.readdirSync(root));

test('O portfólio lista exatamente cinquenta projetos disponíveis nesta fase', () => {
  assert.equal(titles.length, 50);
  assert.equal(cards.length, 50);
  assert.equal(new Set(cards.map(x => x[2])).size, 50);
});

test('Todos os projetos publicados têm arquivo, rótulo de autoria e noindex', () => {
  for (const [, category, url] of cards) {
    assert.ok(filters.has(category), 'Categoria sem filtro: ' + category);
    assert.ok(localFiles.has(url), 'Demonstração ausente: ' + url);
    assert.ok(build.includes("'" + url + "'"), 'Fora do build estático: ' + url);
    const page = read(url);
    assert.match(page, /<meta name="robots" content="noindex,\s*follow"/i, url);
    assert.match(page, /projeto (autoral|demonstrativo)/i, url);
  }
});

test('As prévias visuais e o CSS/JS do portfólio existem', () => {
  for (const name of [...imagePaths, 'css/portfolio.css', 'js/portfolio.js']) {
    if(name.startsWith('https://')) {
      assert.match(name, /^https:\/\/images\.unsplash\.com\/photo-/, 'Foto deve usar fonte aprovada: ' + name);
    } else {
      assert.ok(fs.existsSync(path.join(root, name)), 'Asset ausente: ' + name);
    }
  }
});

test('Links de navegação por âncora nas novas páginas são válidos', () => {
  for (const name of ['portfolio.html','demo-cafe-orvalho.html','demo-helena-luz.html','demo-forno-82.html','demo-salao-orla.html','demo-eixo-consultoria.html','demo-doce-mira.html','demo-opala-cloud.html','demo-nara-derma.html','demo-pausa.html','demo-arena-movimento.html','demo-aflora-spa.html','demo-linho-interiores.html','demo-casa-smash.html','demo-aurora-eventos.html','demo-maia-advocacia.html','demo-brilho-casa.html','demo-luz-solar.html','demo-barbearia-quadro.html','demo-escola-trilhas.html','demo-oficio-tecnico.html','demo-aulas-prisma.html','demo-vertice-digital.html','demo-casa-rio.html','demo-rota-brasil.html','demo-selva-viva.html','demo-ponto-filmes.html','demo-grid-estudio.html','demo-harmonia-lab.html','demo-vereda-planejados.html','demo-sorriso-claro.html','demo-vista-hotel.html','demo-motor-forma.html','demo-aurea-joias.html','demo-essencia-cosmeticos.html','demo-lume-moda.html','demo-base-norte.html','demo-volta-tech.html','demo-casa-patta.html','demo-norte-contabil.html','demo-nexo-automacao.html','demo-pilar.html','demo-nimbo.html','demo-atelier.html','demo-fluxo.html','demo-flor-raiz.html','demo-ponte-idiomas.html']) {
    const html = read(name);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
    assert.equal(ids.length, new Set(ids).size, 'IDs repetidos em ' + name);
    const links = [...html.matchAll(/href="#([^"]+)"/g)].map(x => x[1]);
    for (const id of links) assert.ok(ids.includes(id), 'Âncora #' + id + ' não existe em ' + name);
  }
});

test('Scripts do portfólio são sintaticamente válidos', () => {
  new vm.Script(read('js/portfolio.js'), {filename:'portfolio.js'});
  new vm.Script(read('js/demo-portfolio.js'), {filename:'demo-portfolio.js'});
  for (const name of ['demo-restaurante.html','demo-construtora.html','demo-clinica.html','demo-imobiliaria.html','demo-cafe-orvalho.html','demo-helena-luz.html','demo-forno-82.html','demo-salao-orla.html','demo-eixo-consultoria.html','demo-doce-mira.html','demo-opala-cloud.html','demo-nara-derma.html','demo-pausa.html','demo-arena-movimento.html','demo-aflora-spa.html','demo-linho-interiores.html','demo-casa-smash.html','demo-aurora-eventos.html','demo-maia-advocacia.html','demo-brilho-casa.html','demo-luz-solar.html','demo-barbearia-quadro.html','demo-escola-trilhas.html','demo-oficio-tecnico.html','demo-aulas-prisma.html','demo-vertice-digital.html','demo-casa-rio.html','demo-rota-brasil.html','demo-selva-viva.html','demo-ponto-filmes.html','demo-grid-estudio.html','demo-harmonia-lab.html','demo-vereda-planejados.html','demo-sorriso-claro.html','demo-vista-hotel.html','demo-motor-forma.html','demo-aurea-joias.html','demo-essencia-cosmeticos.html','demo-lume-moda.html','demo-base-norte.html','demo-volta-tech.html','demo-casa-patta.html','demo-norte-contabil.html','demo-nexo-automacao.html','demo-pilar.html','demo-nimbo.html','demo-atelier.html','demo-fluxo.html','demo-flor-raiz.html','demo-ponte-idiomas.html']) {
    const html = read(name);
    for (const [, js] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      new vm.Script(js, {filename:name});
    }
  }
});


test('Todos os conceitos têm estrutura válida, imagens locais e acesso ao Portfolio ou Studio', () => {
  const paths = ['demo-restaurante.html','demo-construtora.html','demo-clinica.html','demo-imobiliaria.html'];
  for(const name of paths){
    const html=read(name);
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
    assert.equal(ids.length,new Set(ids).size,'ID duplicado: '+name);
    const anchors=[...html.matchAll(/href="#([^"]+)"/g)].map(x=>x[1]);
    for(const id of anchors)assert.ok(ids.includes(id),'Âncora ausente '+id+' em '+name);
    assert.match(html,/<body data-demo="[^"]+">/,'demo-id ausente em '+name);
    assert.match(html,/src="js\/demo-portfolio\.js"/,'script demo ausente em '+name);
    assert.match(html,/href="portfolio\.html"/,'volta ao Portfolio ausente em '+name);
    const imgs=[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(x=>x[1]);
    assert.ok(imgs.length>=2,'falta arte no demo '+name);
    for(const img of imgs)assert.ok(fs.existsSync(path.join(root,img)),'Imagem não existe: '+img);
  }
});
test('Interações por segmento são expostas como controles reais', () => {
  assert.match(read('demo-restaurante.html'), /data-menu-filter="entradas"/);
  assert.match(read('demo-restaurante.html'), /id="reservation-dialog"/);
  assert.match(read('demo-restaurante.html'), /id="gallery-dialog"/);
  assert.equal((read('demo-construtora.html').match(/data-work-category=/g)||[]).length,3);
  assert.equal((read('demo-clinica.html').match(/data-spec-select=/g)||[]).length,4);
  assert.match(read('demo-clinica.html'), /id="journey-summary"/);
  assert.equal((read('demo-imobiliaria.html').match(/data-prop-filter=/g)||[]).length,4);
  assert.equal((read('demo-imobiliaria.html').match(/data-prop-type=/g)||[]).length,3);
  assert.match(read('demo-imobiliaria.html'), /id="property-dialog"/);
});
test('Capa da galeria atualizada corresponde às artes autorais locais',()=>{
  for(const path of ['index.html','portfolio.html']){
    const html=read(path);
    for(const name of ['brasa','alto','vitta','prime']){
      assert.match(html,new RegExp('assets/portfolio-'+name+'\\.svg'),path+' sem capa '+name);
    }
  }
});

test('Coleção de cinquenta: inventário numerado e links existentes', () => {
  const doc = read('docs/USBRIN-PORTFOLIO-PLANO.md');
  const ids = [...doc.matchAll(/^\| (\d+) \|/gm)].map(x=>Number(x[1]));
  assert.equal(ids.length, 50);
  assert.deepEqual(ids, Array.from({length:50},(_,i)=>i+1));
  assert.match(doc, /50\/50 páginas HTML autorais/);
  assert.match(portfolio, /50 projetos disponíveis/);
  assert.match(portfolio, /A coleção reúne 50 projetos conceituais/);
});

test('Studio, parceiros e estrutura comercial permanecem na entrega', () => {
  for(const name of ['index.html','studio.html','parceiros.html','js/studio.js','js/studio-pricing.js']){
    assert.ok(fs.existsSync(path.join(root,name)), 'Arquivo preexistente ausente: '+name);
  }
  assert.match(read('index.html'), /href="studio.html"/);
  assert.match(build, /'studio.html'/);
  assert.match(build, /'parceiros.html'/);
});
