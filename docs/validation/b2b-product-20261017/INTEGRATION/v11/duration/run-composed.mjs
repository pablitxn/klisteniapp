import { execFileSync, spawnSync } from 'node:child_process'
const inspection=JSON.parse(execFileSync('docker',['inspect','klisteni-integration-postgres'],{encoding:'utf8'}))[0]
const env=Object.fromEntries(inspection.Config.Env.map(entry=>{const split=entry.indexOf('=');return [entry.slice(0,split),entry.slice(split+1)]}))
if(!env.POSTGRES_USER||!env.POSTGRES_PASSWORD)throw new Error('Synthetic database credentials unavailable')
const source=new URL('postgresql://127.0.0.1:55441/klisteni_b2b_integration_test')
source.username=env.POSTGRES_USER;source.password=env.POSTGRES_PASSWORD
const run=spawnSync(process.execPath,['--test','--test-concurrency=1','scripts/b2b-product-composed-harness.test.mjs'],{cwd:'/workspace/klisteniapp',env:{...process.env,B2B_TEST_DATABASE_URL:source.href},stdio:'inherit'})
if(run.error)throw new Error('Synthetic composed test process could not start')
process.exitCode=run.status??1
