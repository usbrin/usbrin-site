'use strict';

const entry = document.getElementById('id-entry');
const status = document.getElementById('id-status');
const permittedRoles = new Set(['admin', 'representante', 'desenvolvedor']);
const deniedMessages = {
  account_not_approved: 'Este e-mail ainda não está autorizado. Confira sua candidatura ou fale com a USBRIN.',
  account_suspended: 'Esta conta está suspensa. Fale com a USBRIN para saber como regularizar o acesso.',
  mfa_required: 'Complete a verificação em duas etapas para acessar o painel.'
};

let probe;
function announce(message, state = '') {
  status.textContent = message;
  status.dataset.state = state;
  if (state === 'loading') {
    const spinner = document.createElement('span');
    spinner.className = 'id-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    status.prepend(spinner);
  }
}

async function checkSession() {
  probe?.abort();
  const controller = new AbortController();
  probe = controller;
  const timeout = setTimeout(() => controller.abort(), 4000);
  announce('Verificando se você já tem uma sessão…', 'loading');
  try {
    const response = await fetch('/api/private/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      signal: controller.signal
    });
    if (controller.signal.aborted) return;
    if (response.type === 'opaqueredirect' || response.status === 401) {
      announce('');
      return;
    }
    const result = response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : null;
    if (controller.signal.aborted) return;
    if (response.ok && result?.ok && permittedRoles.has(result.user?.role)) {
      announce('Sessão encontrada. Abrindo seu painel…', 'loading');
      window.location.replace(entry.href);
      return;
    }
    const denied = Object.hasOwn(deniedMessages, result?.code) ? deniedMessages[result.code] : '';
    if (denied) announce(denied, 'error');
    else if (response.status >= 500) announce('A verificação está indisponível. Você pode tentar entrar pelo botão acima.', 'error');
    else announce('');
  } catch {
    if (!controller.signal.aborted) announce('Não foi possível verificar a sessão. Você pode tentar entrar pelo botão acima.', 'error');
  } finally {
    clearTimeout(timeout);
    if (probe === controller && controller.signal.aborted && status.textContent.startsWith('Verificando')) announce('');
  }
}

entry.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  probe?.abort();
  announce('Abrindo o login seguro…', 'loading');
});

window.addEventListener('pageshow', event => {
  if (event.persisted) checkSession();
});
checkSession();
