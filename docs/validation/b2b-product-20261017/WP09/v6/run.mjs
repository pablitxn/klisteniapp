import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {readFile,readdir} from 'node:fs/promises'
import {chromium} from './node_modules/playwright-core/index.mjs'
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value)
const receipts=new Map(),calls=[]
async function until(page, predicate, label) {
 const end=Date.now()+15000;let last
 while(Date.now()<end){last=await page.evaluate(()=>window.correctionProbe.read());if(predicate(last))return last;await new Promise(r=>setTimeout(r,100))}
 throw new Error(label+': '+JSON.stringify(last))
}
const access={schemaVersion:2,organizationId:'gym',userId:'member',role:'member',accessMode:'active',accessRevision:1,branches:[{branchId:'east',role:'member'}],capabilities:['edit-own-sessions','export-own-records']}
const server=createServer(async(req,res)=>{try{
 if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('/harness/dist/probe.iife.js'));return}
 if(req.url==='/probe.css'){res.setHeader('Content-Type','text/css');res.end(await readFile('/harness/dist/probe.css'));return}
 if(req.url.startsWith('/api/')){
  assert.equal(req.headers['x-klisteni-b2b-account'],'member');assert.equal(req.headers['x-klisteni-b2b-branch'],'east');res.setHeader('Content-Type','application/json')
  if(req.url.endsWith('/access')){res.end(JSON.stringify(access));return}
  req.setEncoding('utf8');let body='';for await(const chunk of req)body+=chunk
  const input=JSON.parse(body),hash=createHash('sha256').update(canonical({organizationId:'gym',branchId:'east',actorId:'member',action:'session.save',input})).digest('hex');calls.push({input,body,hash})
  let result=receipts.get(input.operationId)
  if(!result){const session={schemaVersion:2,id:input.id,scope:{organizationId:'gym',branchId:'east',memberId:'member'},origin:input.origin,revision:input.expectedRevision+1,operationId:input.operationId,content:input.content,actorId:'member',acceptedAt:'2026-10-17T12:00:01.000Z'};result={session,receipt:{schemaVersion:2,operationId:input.operationId,resourceId:input.id,revision:session.revision,requestHash:hash,acceptedAt:session.acceptedAt}};receipts.set(input.operationId,result)}else assert.equal(result.receipt.requestHash,hash)
  res.end(JSON.stringify(result));return
 }
 res.setHeader('Content-Type','text/html');res.end('<html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/probe.css"><div id="root"></div><script src="/probe.js"></script></html>')
}catch(e){console.error(String(e));res.writeHead(500);res.end('{}')}})
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,args:['--host-resolver-rules=MAP wp09-correction.test 127.0.0.1','--proxy-bypass-list=wp09-correction.test']})
 const context=await browser.newContext({viewport:{width:320,height:740},ignoreHTTPSErrors:false}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(`http://wp09-correction.test:${server.address().port}`);await page.waitForFunction(()=>Boolean(window.correctionProbe));assert.equal(await page.evaluate(()=>isSecureContext),false)
 await page.evaluate(()=>window.correctionProbe.mountCompletedFlow());await page.getByRole('heading',{name:'Routine',exact:true}).waitFor()
 const amounts=page.getByLabel(/cantidad$/),loads=page.getByLabel('Carga realizada kg',{exact:true});await amounts.nth(0).fill('7');await loads.nth(0).fill('20');await amounts.nth(1).fill('8');await loads.nth(1).fill('20')
 await page.getByRole('button',{name:'Completar sesión explícitamente',exact:true}).click()
 const completed=await until(page,d=>d?.accepted?.content.status==='completed'&&d.operations.every(op=>op.state==='accepted'),'completed acceptance');const completedOperations=JSON.stringify(completed.operations),completedRevision=completed.accepted.revision
 const reason=page.getByLabel('Motivo de corrección',{exact:true});await reason.pressSequentially('Correct completed actuals',{delay:30});assert.equal(await reason.inputValue(),'Correct completed actuals')
 await until(page,d=>d?.accepted?.content.correctionReason==='Correct completed actuals'&&d.operations.every(op=>op.state==='accepted'),'reason acceptance')
 assert.equal(await reason.inputValue(),'Correct completed actuals')
 const notes=page.getByLabel('Notas de la sesión',{exact:true});await notes.fill('Captured notes after completion');await until(page,d=>d?.content.notes==='Captured notes after completion','notes capture')
 const date=page.getByLabel('Fecha y hora realizada (ISO con zona)',{exact:true});await date.fill('2026-10-17T13:00:00.000Z');await until(page,d=>d?.content.performedAt==='2026-10-17T13:00:00.000Z','date capture')
 const corrected=await page.evaluate(()=>window.correctionProbe.read());assert.equal(JSON.stringify(corrected.operations.slice(0,completed.operations.length)),completedOperations);assert.equal(corrected.content.explicitCompletion,false);assert.ok(corrected.accepted.revision>completedRevision)
 const beforeLegacy=calls.length;await page.evaluate(()=>window.correctionProbe.mountLegacy());await page.getByRole('heading',{name:'Original legacy',exact:true}).waitFor();await page.waitForTimeout(1000);assert.equal(calls.length,beforeLegacy)
 await page.getByLabel('Motivo de corrección',{exact:true}).fill('Explicit manual variant correction');await page.waitForTimeout(1000);assert.equal(calls.length,beforeLegacy)
 await page.getByLabel(/cantidad$/).nth(0).fill('6');await page.waitForTimeout(1000);assert.equal(calls.length,beforeLegacy)
 await page.getByRole('button',{name:'Confirmar los valores corregidos que registré para esta serie',exact:true}).click()
 await until(page,d=>Boolean(d?.accepted),'legacy acceptance')
 const legacy=await page.evaluate(()=>window.correctionProbe.reloadLegacy());assert.equal(legacy.original.revision,0);assert.equal(legacy.original.original.sets[0].exerciseId,'manual-target');assert.equal(legacy.accepted.id,'original-execution');assert.equal(legacy.accepted.revision,1);assert.equal(legacy.accepted.content.explicitCompletion,false)
 const processes=await Promise.all((await readdir('/proc')).filter(x=>/^\d+$/.test(x)).map(async pid=>{try{return(await readFile(`/proc/${pid}/cmdline`,'utf8')).split('\0')}catch{return[]}}));assert.equal(processes.filter(a=>a[0]?.includes('chrome-headless-shell')).some(a=>a.includes('--no-sandbox')),false);assert.deepEqual(errors,[])
 console.log(JSON.stringify({browser:browser.version(),playwright:'1.63.0',nativeInsecureHTTP:true,sandbox:true,acceptedCompletionThenReasonEntry:true,notesAndDateCaptured:true,priorOperationBytesPreserved:true,noImplicitCompletion:true,legacyFirstCorrection:{initialRequests:0,afterReasonRequests:0,afterExplicitEntryBeforeConfirmation:0,afterConfirmation:calls.length-beforeLegacy,revision:legacy.accepted.revision,originalPreserved:true},realIndexedDB:true,typedHTTPFixture:true,fullApplicationOrAuthAcceptance:false},null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
