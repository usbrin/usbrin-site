'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const portal=fs.readFileSync('portal.html','utf8');
const css=fs.readFileSync('css/portal-typography.css','utf8');
test('new typeface is loaded only by the authenticated partner portal',()=>{
  assert.match(portal,/Plus\+Jakarta\+Sans/);
  assert.match(portal,/href="css\/portal-typography\.css"/);
  assert.match(css,/#portal-content\s*\{/);
  assert.match(css,/font-family:\s*'Plus Jakarta Sans'/);
});
test('font override stays scoped and preserves CRM, prices and security markup',()=>{
  assert.match(portal,/id="portal-nav"/);
  assert.match(portal,/id="rep-command"/);
  assert.match(portal,/id="work-logout"/);
  assert.match(portal,/js\/rep-command\.js/);
  for(const rule of css.split('}').slice(0,-1)){
    const selector=rule.split('{')[0].replace(/\/\*[\s\S]*?\*\//g,'').trim();
    assert.ok(selector.startsWith('#portal-content'), 'Unscoped typography rule: '+selector);
  }
  for(const property of ['background:','color:','font-size:','line-height:','padding:','margin:','display:','grid-template']){
    assert.ok(!css.includes(property),'Only font-family may change: '+property);
  }
});
