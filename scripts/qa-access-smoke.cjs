'use strict';

// Read-only, anonymous security smoke test for the isolated USBRIN ID QA host.
// No credentials, cookies, application submissions or mutations are sent.
const base = process.env.USBRIN_ID_QA_URL || 'https://usbrin-id-oidc-qa.pages.dev';
const url = new URL(base);
if (url.protocol !== 'https:' || url.hostname !== 'usbrin-id-oidc-qa.pages.dev' ||
    url.pathname !== '/' || url.search || url.hash) {
  throw new Error('Somente o host isolado de homologação USBRIN ID QA pode ser testado.');
}

const privatePaths = ['/portal', '/portal.html', '/api/private/me', '/proposta.html'];
const denyStatuses = new Set([302, 303, 307, 308, 401, 403]);
let failures = 0;

(async () => {
  for (const path of privatePaths) {
    try {
      const response = await fetch(new URL(path, url), {
        method: 'GET',
        redirect: 'manual',
        headers: {accept: 'application/json'},
        signal: AbortSignal.timeout(15000)
      });
      console.log(path + ': HTTP ' + response.status);
      if (!denyStatuses.has(response.status)) {
        console.error('Falha: rota privada sem autenticação não retornou bloqueio do Access.');
        failures++;
      }
      await response.body?.cancel();
    } catch (error) {
      console.error(path + ': não foi possível concluir a consulta de QA: ' + error.message);
      failures++;
    }
  }
  if (failures) {
    console.error('Proteção anônima QA: ' + failures + ' verificação(ões) falharam.');
    process.exitCode = 1;
  } else {
    console.log('Proteção anônima QA confirmada. Login real e MFA ainda exigem homologação manual.');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
