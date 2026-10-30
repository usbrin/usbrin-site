'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#quote-form');
  if (!form) return;
  const result = document.querySelector('#quote-result');
  const preview = document.querySelector('#quote-preview');
  const link = document.querySelector('#quote-whatsapp');
  const name = form.elements.namedItem('name');
  const demos = {restaurante:'Restaurante', construtora:'Construtora', clinica:'Clínica', imobiliaria:'Imobiliária'};
  const slug = new URLSearchParams(window.location.search).get('demo');
  const reference = Object.hasOwn(demos, slug) ? demos[slug] : '';
  if (reference) {
    const context = document.querySelector('#quote-context');
    context.textContent = `Demonstração selecionada: ${reference}.`;
    context.hidden = false;
  }
  const reset = () => {
    name.setCustomValidity('');
    result.hidden = true;
    link.removeAttribute('href');
    preview.textContent = '';
  };
  form.addEventListener('input', reset);
  form.addEventListener('change', reset);
  form.addEventListener('submit', event => {
    event.preventDefault();
    name.setCustomValidity(name.value.trim() ? '' : 'Digite seu nome. O campo não pode conter apenas espaços.');
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const value = key => String(data.get(key) || '').trim();
    const message = [
      'Olá, USBRIN! Gostaria de solicitar um orçamento.',
      '', `Nome: ${value('name')}`,
      value('company') ? `Empresa: ${value('company')}` : '',
      `Tipo de site: ${value('type')}`,
      `Objetivo: ${value('goal')}`,
      `Funcionalidades: ${data.getAll('features').join(', ') || 'A definir com a orientação da USBRIN'}`,
      reference ? `Demonstração de referência: ${reference}` : '',
      value('notes') ? `Informações adicionais: ${value('notes')}` : ''
    ].filter((line, index) => line || index === 1).join('\n');
    preview.textContent = message;
    link.href = 'https://wa.me/5569992967459?text=' + encodeURIComponent(message);
    result.hidden = false;
    link.focus();
  });
  form.hidden = false;
});
