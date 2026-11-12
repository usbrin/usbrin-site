/* USBRIN Portfolio 2.0: briefing por referência, sem API, cookies ou armazenamento. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const modal = document.querySelector('#project-brief-dialog');
  if (!modal) return;
  const nameEl = modal.querySelector('#brief-project-name');
  const descriptionEl = modal.querySelector('#brief-project-description');
  const objective = modal.querySelector('#brief-objective');
  const notes = modal.querySelector('#brief-notes');
  const preview = modal.querySelector('#brief-preview');
  const email = modal.querySelector('#brief-email');
  const whatsapp = modal.querySelector('#brief-whatsapp');
  const copy = modal.querySelector('#brief-copy');
  const close = modal.querySelector('#brief-close');
  const targets = Array.from(document.querySelectorAll('[data-project-brief]'));
  const purposes = Object.freeze({
    apresentar: 'Apresentar minha empresa',
    contatos: 'Conquistar contatos e orçamentos',
    catalogo: 'Mostrar produtos ou serviços em catálogo',
    vender: 'Vender produtos online',
    processos: 'Organizar um processo digital'
  });
  const defaults = {comercio:'catalogo', moda:'catalogo', tecnologia:'processos', construcao:'contatos', gastronomia:'contatos', saude:'contatos', servicos:'contatos', educacao:'contatos'};
  let projectName = '', projectDescription = '';
  function buildBrief() {
    const lines = [
      'Olá, equipe USBRIN!',
      '',
      'Gostaria de conversar sobre um site profissional para minha empresa.',
      'Referência no USBRIN Portfolio: ' + projectName,
      'Experiência que chamou minha atenção: ' + projectDescription,
      'Meu principal objetivo: ' + (purposes[objective.value] || purposes.apresentar)
    ];
    if (notes.value.trim()) lines.push('Informações adicionais: ' + notes.value.trim());
    lines.push('', 'Quero uma proposta personalizada, não uma cópia do projeto conceitual.');
    return lines.join('\n');
  }
  function refresh() {
    const value = buildBrief();
    preview.textContent = value;
    email.href = 'mailto:usbrin.contato@gmail.com?subject=' +
      encodeURIComponent('Projeto USBRIN — referência ' + projectName) +
      '&body=' + encodeURIComponent(value);
    if (whatsapp) whatsapp.href = 'https://wa.me/5569992967459?text=' + encodeURIComponent(value);
  }
  for (const link of targets) link.addEventListener('click', event => {
    const card = link.closest('.project');
    if (!card) return;
    event.preventDefault();
    projectName = card.querySelector('h3')?.textContent.trim() || 'Projeto USBRIN';
    projectDescription = card.querySelector('.project-body p')?.textContent.trim() || 'Site profissional';
    nameEl.textContent = projectName;
    descriptionEl.textContent = projectDescription;
    objective.value = defaults[card.dataset.category] || 'apresentar';
    notes.value = '';
    copy.textContent = 'Copiar resumo';
    refresh();
    modal.showModal();
  });
  objective.addEventListener('change', refresh);
  notes.addEventListener('input', refresh);
  close.addEventListener('click', () => modal.close());
  modal.addEventListener('click', event => { if (event.target === modal) modal.close(); });
  copy.addEventListener('click', async () => {
    const value = buildBrief();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard não disponível');
      await navigator.clipboard.writeText(value);
      copy.textContent = 'Resumo copiado ✓';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(preview);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      copy.textContent = 'Texto selecionado — copie manualmente';
    }
  });
});
