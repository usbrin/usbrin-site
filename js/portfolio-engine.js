/* USBRIN Portfolio · motor determinístico de demonstrações.
 * Dados, preços e coeficientes inventados exclusivamente para simular interfaces.
 * Sem rede, persistência, cobrança ou decisões de engenharia.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.USBRINPro = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const deepFreeze = object => {
    Object.freeze(object);
    for (const value of Object.values(object)) if (value && typeof value === 'object' && !Object.isFrozen(value)) deepFreeze(value);
    return object;
  };
  const projects = deepFreeze([
    {id:'residencial',name:'Residencial Horizonte',category:'Residencial',location:'Estudo conceitual A',area:185,phase:'Concepção',discipline:'Arquitetura e coordenação',summary:'Implantação, iluminação e compatibilização visual de disciplinas.',points:['Concepção volumétrica','Estudo de espaços','Painel de marcos'],image:'assets/pilar-residencial.svg'},
    {id:'corporativo',name:'Edifício Eixo',category:'Corporativo',location:'Estudo conceitual B',area:520,phase:'Desenvolvimento',discipline:'Modelagem e documentação',summary:'Organização de fachadas, soluções e documentos de referência.',points:['Estudo da fachada','Documentação organizada','Acompanhamento por etapa'],image:'assets/pilar-corporativo.svg'},
    {id:'logistico',name:'Complexo Base',category:'Industrial',location:'Estudo conceitual C',area:760,phase:'Planejamento',discipline:'Planejamento e processos',summary:'Organização ilustrativa de fluxos, implantação e execução.',points:['Fluxos operacionais','Implantação de áreas','Relatório ilustrativo'],image:'assets/pilar-industrial.svg'}
  ]);
  const constructionRates = deepFreeze({residencial:2950,corporativo:3550,industrial:2650});
  const complexityFactors = deepFreeze({essencial:1,intermediaria:1.16,detalhada:1.32});
  const items = deepFreeze([
    {id:'n01',name:'Linha Horizonte',category:'Sala',type:'Estante modular',base:5400,width:240,range:'180–320 cm',description:'Nichos abertos, superfícies contínuas e composição modular.',image:'assets/nimbo-estante.svg'},
    {id:'n02',name:'Casa Nativa',category:'Quarto',type:'Roupeiro',base:7900,width:260,range:'180–320 cm',description:'Portas de proporção vertical e organização interior.',image:'assets/nimbo-roupeiro.svg'},
    {id:'n03',name:'Orla',category:'Cozinha',type:'Armário',base:8600,width:280,range:'180–320 cm',description:'Frentes limpas e armazenamento adaptável.',image:'assets/nimbo-cozinha.svg'},
    {id:'n04',name:'Arco',category:'Sala',type:'Rack',base:4100,width:220,range:'180–320 cm',description:'Volumes leves com organização de cabos simulada.',image:'assets/nimbo-rack.svg'},
    {id:'n05',name:'Nexo',category:'Escritório',type:'Estação de trabalho',base:3700,width:200,range:'180–320 cm',description:'Superfície ampla e módulos de apoio.',image:'assets/nimbo-estacao.svg'},
    {id:'n06',name:'Vale',category:'Quarto',type:'Cabeceira',base:2900,width:210,range:'180–320 cm',description:'Revestimentos e linhas horizontais discretas.',image:'assets/nimbo-cabeceira.svg'}
  ]);
  const finishes = deepFreeze({carvalho:{label:'Carvalho claro',factor:1},nogueira:{label:'Nogueira natural',factor:1.14},grafite:{label:'Grafite fosco',factor:1.09}});
  function estimateConstruction(input) {
    if (!input || !Number.isFinite(input.area) || input.area < 50 || input.area > 800) return null;
    if (!Object.hasOwn(constructionRates,input.category) || !Object.hasOwn(complexityFactors,input.complexity)) return null;
    const base = input.area * constructionRates[input.category] * complexityFactors[input.complexity];
    return {base:Math.round(base),low:Math.round(base*0.85),high:Math.round(base*1.15),reserve:Math.round(base*0.12),unitCost:Math.round(base/input.area)};
  }
  function estimateFurniture(input) {
    const item = items.find(i=>i.id===input?.id);
    if (!item || !Number.isFinite(input.width) || input.width<180 || input.width>320 || !Object.hasOwn(finishes,input.finish) || typeof input.premiumHardware!=='boolean') return null;
    const raw = item.base * (input.width/item.width) * finishes[input.finish].factor + (input.premiumHardware?720:0);
    return {value:Math.round(raw/10)*10,base:item.base,finish:finishes[input.finish].label,width:input.width};
  }
  function filterProjects(category) {return projects.filter(p=>category==='Todos'||p.category===category);}
  function filterItems(category,query) {
    const normalized = String(query||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    return items.filter(i=>(category==='Todos'||i.category===category) && [i.name,i.type,i.category,i.description].some(v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(normalized)));
  }
  return deepFreeze({projects,items,finishes,constructionRates,complexityFactors,estimateConstruction,estimateFurniture,filterProjects,filterItems});
});
