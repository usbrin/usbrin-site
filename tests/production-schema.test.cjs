'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');

const root=path.join(__dirname,'..');
const directory=path.join(root,'migrations');
const fileNames=fs.readdirSync(directory).filter(s=>s.endsWith('.sql')).sort();
const expected=Array.from({length:19},(_,i)=>String(i+1).padStart(4,'0')+'_');
test('migration inventory has exactly one numbered SQL file for 0001–0019',()=>{
 assert.equal(fileNames.length,19,'All schema migrations must be accounted for');
 fileNames.forEach((file,i)=>assert.ok(file.startsWith(expected[i]),'Missing/duplicate migration '+expected[i]));
});
test('all migrations apply to a newly created empty database in numeric order',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('PRAGMA foreign_keys=ON;');
  for(const file of fileNames)db.exec(fs.readFileSync(path.join(directory,file),'utf8'));
  const names=new Set(db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'').all().map(x=>x.name));
  for(const table of [
   'users','applications','audit_events','opportunities','commissions',
   'zitadel_identity_links','zitadel_app_sessions','zitadel_login_attempts',
   'native_password_request_limits'
  ])assert.ok(names.has(table),'Missing table: '+table);
  for(const table of ['users','applications','zitadel_identity_links','zitadel_app_sessions']){
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,0,'Fresh database must not have real accounts/data: '+table);
  }
  const candidates=db.prepare("PRAGMA table_info(applications)").all().map(x=>x.name);
  for(const column of ['protocol','type','name','email','status','created_at','updated_at']){
    assert.ok(candidates.includes(column),'Missing applicant field '+column);
  }
 }finally{db.close();}
});
