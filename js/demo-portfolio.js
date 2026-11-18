'use strict';
/* USBRIN Portfolio | Interações dos quatro conceitos legados.
   Sem backend, persistência, reserva, pagamento ou coleta de dados. */
document.addEventListener('DOMContentLoaded', () => {
  const get = selector => document.querySelector(selector);
  const all = selector => Array.from(document.querySelectorAll(selector));
  const demo = document.body.dataset.demo;

  const menu = get('.menu-toggle'), nav = get('#site-nav');
  if (menu && nav) {
    function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.textContent = 'Menu'; }
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
      menu.textContent = open ? 'Fechar' : 'Menu';
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); }
    });
    window.matchMedia('(min-width:821px)').addEventListener('change', e => { if(e.matches) closeMenu(); });
  }
  all('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close());
  });
  all('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => { if(event.target === dialog) dialog.close(); });
  });

  const setPressed = (selector, active) => all(selector).forEach(button => {
    button.setAttribute('aria-pressed', String(button === active));
  });
  const text = (selector, value) => { const el=get(selector); if(el) el.textContent=value; };

  if (demo === 'restaurante') {
    const categories = all('[data-menu-filter]'), lists=all('[data-menu-type]');
    categories.forEach(button => button.addEventListener('click', () => {
      const category=button.dataset.menuFilter;
      setPressed('[data-menu-filter]', button);
      lists.forEach(list => { list.hidden=category!=='todos' && category!==list.dataset.menuType; });
    }));
    const gallery=get('#gallery-dialog');
    all('[data-gallery-src]').forEach(button => button.addEventListener('click', () => {
      const img=get('#gallery-large');
      img.src=button.dataset.gallerySrc;
      img.alt='Arte ilustrativa ampliada: '+button.dataset.galleryTitle;
      text('#gallery-title', button.dataset.galleryTitle);
      gallery?.showModal();
    }));

    const reservation=get('#reservation-dialog');
    let people='2', place='Salão';
    const updateSummary=()=>text('#reservation-summary',
      'Uma mesa para '+people+' pessoas, no '+place.toLowerCase()+'. Seleção demonstrativa; nenhuma reserva foi feita.');
    all('[data-open-reservation]').forEach(button => button.addEventListener('click', ()=>reservation?.showModal()));
    all('[data-reserve-people]').forEach(button => button.addEventListener('click', () => {
      people=button.dataset.reservePeople;
      setPressed('[data-reserve-people]',button); updateSummary();
    }));
    all('[data-reserve-place]').forEach(button => button.addEventListener('click', () => {
      place=button.dataset.reservePlace;
      setPressed('[data-reserve-place]',button); updateSummary();
    }));
  }

  if (demo === 'construtora') {
    const cards=all('[data-work-category]');
    all('[data-work-filter]').forEach(button => button.addEventListener('click',()=>{
      const category=button.dataset.workFilter; let visible=0;
      setPressed('[data-work-filter]',button);
      cards.forEach(card=>{
        card.hidden=category!=='todos' && card.dataset.workCategory!==category;
        if(!card.hidden)visible++;
      });
      text('#work-count',visible===1?'1 estudo disponível':visible+' estudos disponíveis');
    }));
    const works={
      vertice:{title:'Edifício Vértice',desc:'Conceito residencial com fachada modular, volumetria contemporânea e organização visual de etapas construtivas.',img:'assets/portfolio-alto.svg'},
      centro:{title:'Centro Empresarial Norte',desc:'Estudo comercial de fachada envidraçada e módulos de uso corporativo, com informações estruturadas para potenciais clientes.',img:'assets/portfolio-obra-comercial.svg'},
      galpao:{title:'Galpão Logístico Sul',desc:'Conceito industrial focado em amplitude espacial, circulação e comunicação clara de soluções técnicas.',img:'assets/portfolio-obra-industrial.svg'}
    };
    all('[data-work-open]').forEach(button => button.addEventListener('click',()=>{
      const study=works[button.dataset.workOpen];if(!study)return;
      text('#work-title',study.title);text('#work-detail',study.desc);
      const img=get('#work-dialog-img');img.src=study.img;img.alt='Ilustração conceitual de '+study.title;
      get('#work-dialog')?.showModal();
    }));
  }

  if (demo === 'clinica') {
    const specialties={
      cardiologia:{title:'Acompanhamento cardiovascular',desc:'Uma apresentação que organiza avaliações, orientações de atendimento e informações sobre consultas.',name:'Cardiologia'},
      clinica:{title:'Cuidado no cotidiano',desc:'Como apresentar consultas gerais e rotinas de acompanhamento de forma acessível.',name:'Clínica geral'},
      nutricao:{title:'Bem-estar e hábitos',desc:'Destaque para atendimento nutricional, orientação geral e jornada de agendamento.',name:'Nutrição'},
      oftalmologia:{title:'Atenção à saúde ocular',desc:'Uma abordagem visual para informações de atendimento em oftalmologia.',name:'Oftalmologia'}
    };
    const select=get('#journey-specialty');let period='Manhã';
    const updateJourney=()=>text('#journey-summary',(select?.value||'Cardiologia')+' · '+period);
    all('[data-spec-select]').forEach(button=>button.addEventListener('click',()=>{
      const item=specialties[button.dataset.specSelect];if(!item)return;
      setPressed('[data-spec-select]',button);text('#specialty-title',item.title);text('#specialty-copy',item.desc);
      if(select)select.value=item.name;updateJourney();
    }));
    select?.addEventListener('change',updateJourney);
    all('[data-period]').forEach(button=>button.addEventListener('click',()=>{
      period=button.dataset.period;setPressed('[data-period]',button);updateJourney();
    }));
  }

  if (demo === 'imobiliaria') {
    const cards=all('[data-prop-type]');
    all('[data-prop-filter]').forEach(button=>button.addEventListener('click',()=>{
      const kind=button.dataset.propFilter;let visible=0;
      setPressed('[data-prop-filter]',button);
      cards.forEach(card=>{
        card.hidden=kind!=='todos'&&card.dataset.propType!==kind;
        if(!card.hidden)visible++;
      });
      text('#property-count',visible===1?'1 imóvel ilustrativo':visible+' imóveis ilustrativos');
    }));
    const properties={
      apto:{name:'Apartamento Jardim Vitória',desc:'Apartamento ilustrativo para mostrar como plantas, características e localizações poderiam ser apresentadas em um catálogo imobiliário.',img:'assets/portfolio-imovel-apto.svg',facts:['3 quartos','92 m²','2 vagas','Venda · R$ 620.000 (exemplo)']},
      casa:{name:'Casa Residencial Bosque',desc:'Conceito de residência contemporânea com foco em área social e jardim, apresentado por meio de uma ficha organizada.',img:'assets/portfolio-prime.svg',facts:['4 quartos','210 m²','4 vagas','Venda · R$ 980.000 (exemplo)']},
      sala:{name:'Sala Comercial Centro',desc:'Exemplo de apresentação de espaço corporativo com condições de locação, localização e dados técnicos acessíveis.',img:'assets/portfolio-imovel-sala.svg',facts:['Comercial','48 m²','1 vaga','Aluguel · R$ 3.200/mês (exemplo)']}
    };
    all('[data-property-open]').forEach(button=>button.addEventListener('click',()=>{
      const item=properties[button.dataset.propertyOpen];if(!item)return;
      text('#property-title',item.name);text('#property-info',item.desc);
      const img=get('#property-image');img.src=item.img;img.alt='Ilustração de '+item.name;
      const facts=get('#property-facts');facts.replaceChildren();
      for(const fact of item.facts){const el=document.createElement('span');el.textContent=fact;facts.append(el);}
      get('#property-dialog')?.showModal();
    }));
  }
});
