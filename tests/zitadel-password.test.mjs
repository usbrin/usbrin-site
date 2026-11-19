import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as publicConfig} from '../functions/api/native/config.js';

test('ZITADEL password recovery must stay disabled by default',async()=>{
  const env={USBRIN_AUTH_MODE:'zitadel'};
  const request=new Request('https://usbrin-id-native-qa.pages.dev/api/native/config');
  const response=publicConfig({request,env});
  assert.equal((await response.json()).passwordRecovery,false);
});
