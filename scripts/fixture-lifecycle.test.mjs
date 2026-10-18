import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {fixtureDatabaseUrl,cleanupFixture} from './fixture-safety.ts';
const candidate=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
for(const kind of ['admin','accounts']) for(const phase of ['create','create-failure','migrate','seed','listen','normal']) {
test(kind+' fixture cleanup coordinates with '+phase, async () => {
 const filename=kind==='admin'?'b2c-admin-fixtures.ts':'accounts-e2e-server.ts';
 const source=fs.readFileSync(path.join(candidate,'scripts',filename),'utf8');
 const body=kind==='admin'?source.slice(source.indexOf('  const config = fixtureConfig();'),source.lastIndexOf('\n}\nif (process.argv')):source.slice(source.indexOf('const databaseUrl'));
 let ready,release,ended;
 const readyPromise=new Promise(r=>ready=r), pending=new Promise(r=>release=r), endedPromise=new Promise(r=>ended=r);
 const events=[],signals={};let paused=false, poolCount=0, scopedQueries=0;
 const pause=async step=>{events.push(step);if(!paused&&(phase===step||(phase==='create-failure'&&step==='create'))){paused=true;ready();await pending;if(phase==='create-failure')throw Error('Synthetic create failure');}};
 const schema='klisteni_admin_'+'a'.repeat(32);
 const process={env:{TEST_DATABASE_URL:'postgresql://localhost/fixture_test',KLISTENI_ADMIN_SCHEMA:schema},once:(name,fn)=>signals[name]=fn,exitCode:undefined};
 const config={databaseUrl:'postgresql://localhost/fixture_test',host:'127.0.0.1',port:4188};
 const admin={query:async sql=>{if(sql.startsWith('CREATE SCHEMA'))return pause('create');assert.match(sql,/^DROP SCHEMA "klisteni_(?:admin|e2e)_[a-f0-9]{32}" CASCADE$/);events.push('drop');},end:async()=>{events.push('admin-end');ended();}};
 const pool={query:async()=>{scopedQueries++;},end:async()=>events.push('pool-end')};
 const server={listening:false,closeRecovery:async()=>events.push('recovery'),once:()=>{},listen:(_port,_host,cb)=>{server.listening=true;void pause('listen').then(cb);},closeAllConnections:()=>events.push('http-connections'),close:cb=>{events.push('http-close');server.listening=false;cb();}};
 class AccountAdministration {async bootstrap(){return {url:'http://localhost/#token=fixture'};}async activate(){await pause('seed');}}
 class StateRepository {async addLog(){}async yoga(){}}
 const args={process,fixtureConfig:()=>config,fixtureDatabaseUrl,cleanupFixture,createPool:()=>++poolCount===1?admin:pool,createAuth:()=>({}),createApiServer:()=>server,migrate:()=>pause('migrate'),AccountAdministration,StateRepository,createProvisionedUser:async()=>{await pause('seed');return {id:'fixture-user'};},adminPassword:'synthetic-fixture-value',readConfig:()=>config,randomUUID:()=> 'b'.repeat(32),console:{info:()=>{},error:()=>{}}};
 const run=new AsyncFunction(...Object.keys(args),stripTypeScriptTypes(body)+'\nreturn {close};');
 const running=run(...Object.values(args));
 const observed=running.then(value=>({value}),()=>({failed:true}));
 if(phase!=='normal'){
  await readyPromise;signals.SIGTERM();await Promise.resolve();await Promise.resolve();
  assert.equal(events.includes('pool-end'),false);assert.equal(events.includes('admin-end'),false);assert.equal(events.includes('drop'),false);
  release();
 }
 const result=await observed;
 if(result.value)await result.value.close();
 else await endedPromise;
 assert.equal(events.filter(x=>x==='drop').length,phase==='create-failure'?0:1);
 assert.equal(events.filter(x=>x==='pool-end').length,1);assert.equal(events.filter(x=>x==='admin-end').length,1);
 if(result.value){await result.value.close();assert.equal(events.filter(x=>x==='drop').length,phase==='create-failure'?0:1);}
 if(phase==='create'||phase==='create-failure'){assert.equal(events.includes('migrate'),false);assert.equal(events.includes('seed'),false);assert.equal(events.includes('listen'),false);}
 if(phase==='migrate'){assert.equal(events.includes('seed'),false);assert.equal(events.includes('listen'),false);}
 if(phase==='seed')assert.equal(events.includes('listen'),false);
 assert.equal(server.listening,false);
});
}
