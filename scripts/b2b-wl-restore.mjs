// Quiescent synthetic full-database + media/config restore into separate resources.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createAuth } from '../apps/b2b-api/src/auth.ts';
import { migrate } from '../apps/b2b-api/src/migrate.ts';
import { seedWhiteLabelDemo } from '../apps/b2b-api/src/white-label-demo.ts';
import { createApiServer } from '../apps/b2b-api/src/http.ts';
const requireApi=createRequire(new URL('../apps/b2b-api/package.json',import.meta.url));
const {Pool}=requireApi('pg');
const base=new URL(process.env.B2B_TEST_DATABASE_URL ?? '');
assert.match(base.pathname,/b2b.*test|test.*b2b/i);assert.equal(base.searchParams.has('options'),false);
assert.ok(['127.0.0.1','localhost'].includes(base.hostname),'Restore harness only permits loopback test PostgreSQL');
const container=process.env.B2B_WL_TEST_POSTGRES_CONTAINER;
assert.match(container ?? '',/^[a-zA-Z0-9_-]+$/,'Set the explicitly selected local test PostgreSQL container');
const suffix=randomUUID().replaceAll('-','').slice(0,12);
const sourceName=`klisteni_b2b_test_wl_${suffix}`,restoreName=`${sourceName}_restore`;
const workspace=mkdtempSync(join(tmpdir(),'klisteni-wl-restore-'));
const owner=new Pool({connectionString:base.href});const pools=[];const created=[];const servers=[];
const report={schemaVersion:1,startedAt:new Date().toISOString(),git:{},checks:[],limitations:['Synthetic local PostgreSQL/runtime; not a public deployment or physical-device acceptance.','Quiescent source: no post-backup writes to reconcile in this rehearsal.','Deferred previews were not regenerated or claimed green.']};
function command(program,args,options={}) {const result=spawnSync(program,args,{...options,encoding:options.encoding ?? 'utf8'});if(result.status!==0)throw new Error(`${program} failed: ${String(result.stderr ?? '').slice(0,1500)}`);return result.stdout;}
function check(name){report.checks.push({name,status:'passed'});console.info(`PASS ${name}`);}
async function stop(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
async function start(config,pool){const server=createApiServer({config,pool,auth:createAuth(pool,config)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));servers.push(server);return {server,url:`http://127.0.0.1:${server.address().port}/api/b2b`};}
async function context(runtime,config,host){return fetch(`${runtime.url}/context`,{headers:{'x-klisteni-b2b-host':host,'x-klisteni-b2b-proto':'http','x-klisteni-b2b-proxy-secret':config.proxySecret}});}
try {
  report.git={commit:command('git',['rev-parse','HEAD']).trim(),diffSha256:createHash('sha256').update(command('git',['diff','HEAD'])).digest('hex'),dirty:Boolean(command('git',['status','--porcelain']).trim()),untracked:command('git',['ls-files','--others','--exclude-standard']).trim().split('\n').filter(Boolean).map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))};
  report.runtime={node:process.version,postgres:(await owner.query('SELECT version() version')).rows[0].version};
  for(const name of [sourceName,restoreName]){await owner.query(`CREATE DATABASE ${name}`);created.push(name);}
  const sourceUrl=new URL(base);sourceUrl.pathname=`/${sourceName}`;
  const source=new Pool({connectionString:sourceUrl.href});pools.push(source);
  const sourceMedia=join(workspace,'source-media'),restoreMedia=join(workspace,'restore-media');mkdirSync(sourceMedia);
  const config={databaseUrl:sourceUrl.href,secret:randomBytes(32).toString('hex'),origin:'http://atlas.b2b.test',host:'127.0.0.1',port:0,production:false,demoMode:true,whiteLabel:true,domainProtocol:'http',proxySecret:randomBytes(32).toString('hex'),mediaRoot:sourceMedia};
  const auth=createAuth(source,config);await migrate(source,auth);const fixture=await seedWhiteLabelDemo(source,auth,config,'isolated-restore-fixture-password');
  const sourceRuntime=await start(config,source);
  const before={};for(const gym of fixture.gyms){const response=await context(sourceRuntime,config,gym.host);assert.equal(response.status,200);before[gym.host]=await response.json();assert.equal(before[gym.host].branches.length,2);}
  check('two brands and four branches resolve in original runtime');
  // Persist a real immutable object in the API layout with an owned metadata row.
  await source.query("INSERT INTO b2b_invitation(id,organization_id,branch_id,email,name,role,token_hash,expires_at,created_by) VALUES($1,'atlas-demo','atlas-demo-norte','pending@restore.example.test','Pendiente','member',$2,now()+interval '1 day',$3)",[randomUUID(),createHash('sha256').update(randomBytes(32)).digest('hex'),fixture.gyms[0].admin.id]);
  const mediaId=randomUUID(),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==','base64');
  const sha=createHash('sha256').update(bytes).digest('hex');
  const relative=`${mediaId.slice(0,2)}/${mediaId}.png`;mkdirSync(join(sourceMedia,mediaId.slice(0,2)));writeFileSync(join(sourceMedia,relative),bytes,{mode:0o600});
  await source.query("INSERT INTO b2b_media(id,organization_id,branch_id,created_by,kind,label,relative_path,mime,bytes,sha256) VALUES($1,'atlas-demo','atlas-demo-principal',$2,'image','Restore fixture',$3,'image/png',$4,$5)",[mediaId,fixture.gyms[0].admin.id,relative,bytes.length,sha]);
  const executionId=randomUUID();const branch=fixture.gyms[0].branches[0];
  const snapshot=(await source.query('SELECT snapshot FROM b2b_program_version WHERE organization_id=$1 AND program_id=$2 AND version=1',['atlas-demo',branch.programId])).rows[0].snapshot;
  const execution={id:executionId,assignmentId:branch.assignmentId,status:'partial',sets:[{stepId:snapshot.steps[0].id,set:1,exerciseId:snapshot.steps[0].exerciseId,reps:10,durationSeconds:null,loadKg:null,rpe:null,reason:''}],notes:'Restore evidence',completedAt:new Date().toISOString()};
  await source.query('INSERT INTO b2b_execution(organization_id,id,member_id,assignment_id,data,branch_id) VALUES($1,$2,$3,$4,$5,$6)',['atlas-demo',executionId,branch.member.id,branch.assignmentId,execution,branch.id]);
  await stop(sourceRuntime.server);check('writes stopped before consistent backup');
  const dump=join(workspace,'backup.dump'),out=openSync(dump,'wx',0o600);
  try{command('docker',['exec',container,'pg_dump','-U','postgres','--format=custom','--no-owner','--dbname',sourceName],{stdio:['ignore',out,'pipe']});}finally{closeSync(out);}
  cpSync(sourceMedia,restoreMedia,{recursive:true});writeFileSync(join(workspace,'configuration.private.json'),JSON.stringify(config),{mode:0o600});
  const input=openSync(dump,'r');try{command('docker',['exec','-i',container,'pg_restore','-U','postgres','--exit-on-error','--no-owner','--dbname',restoreName],{stdio:[input,'pipe','pipe']});}finally{closeSync(input);}
  const restoreUrl=new URL(base);restoreUrl.pathname=`/${restoreName}`;
  const restoreConfig={...JSON.parse(readFileSync(join(workspace,'configuration.private.json'),'utf8')),databaseUrl:restoreUrl.href,mediaRoot:restoreMedia};
  const restored=new Pool({connectionString:restoreUrl.href});pools.push(restored);
  await migrate(restored,createAuth(restored,restoreConfig,{migrating:true}));
  const restoredRuntime=await start(restoreConfig,restored);
  for(const gym of fixture.gyms){const response=await context(restoredRuntime,restoreConfig,gym.host);assert.equal(response.status,200);assert.deepEqual(await response.json(),before[gym.host]);}
  check('restored registry, independent themes, modules and public branch content match');
  for(const table of ['b2b_auth_user','b2b_membership','b2b_branch_grant','b2b_invitation','b2b_program_version','b2b_program_assignment','b2b_execution','b2b_domain','b2b_theme_version']){
    const previous=(await source.query(`SELECT to_jsonb(t) AS data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    const current=(await restored.query(`SELECT to_jsonb(t) AS data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;assert.deepEqual(current,previous);
  }
  check('identity IDs, permissions, invitations and immutable history preserved');
  const media=(await restored.query('SELECT * FROM b2b_media WHERE id=$1',[mediaId])).rows[0];assert.equal(createHash('sha256').update(readFileSync(join(restoreMedia,media.relative_path))).digest('hex'),media.sha256);
  check('media bytes and metadata restored together with configuration');
  const headers={'x-klisteni-b2b-host':'atlas.b2b.test','x-klisteni-b2b-proto':'http','x-klisteni-b2b-proxy-secret':restoreConfig.proxySecret,origin:'http://atlas.b2b.test','content-type':'application/json'};
  const login=await fetch(`${restoredRuntime.url}/auth/sign-in/email`,{method:'POST',headers,body:JSON.stringify({email:branch.member.email,password:'isolated-restore-fixture-password'})});assert.equal(login.status,200);
  const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  const history=await fetch(`${restoredRuntime.url}/history/executions`,{headers:{...headers,cookie}});assert.equal(history.status,200);assert.ok((await history.json()).executions.some(e=>e.id===executionId));
  const cross=await fetch(`${restoredRuntime.url}/me`,{headers:{...headers,cookie,'x-klisteni-b2b-host':'sur.b2b.test',origin:'http://sur.b2b.test'}});assert.equal(cross.status,401);
  check('restored runtime authenticates and reads own history while rejecting copied brand cookie');
  report.migrations=(await restored.query('SELECT id FROM b2b_migration ORDER BY id')).rows.map(r=>r.id);report.backup={format:'pg_dump custom',sha256:createHash('sha256').update(readFileSync(dump)).digest('hex'),quiescent:true,separateDatabase:true,separateMedia:true};report.status='passed';
} catch(error){report.status='failed';report.error=String(error);process.exitCode=1;console.error(error);} finally {
  for(const server of servers)if(server.listening)await stop(server);
  for(const pool of pools)await pool.end();
  for(const name of created.reverse())await owner.query(`DROP DATABASE IF EXISTS ${name}`);
  await owner.end();rmSync(workspace,{recursive:true,force:true});report.completedAt=new Date().toISOString();
  mkdirSync('.cache/wl',{recursive:true});writeFileSync('.cache/wl/restore-report.json',JSON.stringify(report,null,2)+'\n');
}
