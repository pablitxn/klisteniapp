import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {readFile,readdir} from 'node:fs/promises'
import {chromium} from './node_modules/playwright-core/index.mjs'
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value)
const receipts=new Map(), calls=[];let lost=false
const access={schemaVersion:2,organizationId:'gym',userId:'member',role:'member',accessMode:'active',accessRevision:1,branches:[{branchId:'east',role:'member'}],capabilities:['edit-own-sessions','export-own-records']}
const server=createServer(async(req,res)=>{
 try {
  if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile('/harness/dist/probe.iife.js'));return}
  if(req.url==='/probe.css'){res.setHeader('Content-Type','text/css');res.end(await readFile('/harness/dist/probe.css'));return}
  if(req.url.startsWith('/api/b2b/')){
   assert.equal(req.headers['x-klisteni-b2b-account'],'member');assert.equal(req.headers['x-klisteni-b2b-branch'],'east');assert.equal(req.headers['x-klisteni-b2b-contract'],'2')
   res.setHeader('Content-Type','application/json; charset=utf-8')
   if(req.url.endsWith('/access')){res.end(JSON.stringify(access));return}
   req.setEncoding('utf8');let body='';for await(const part of req)body+=part
   const input=JSON.parse(body), hash=createHash('sha256').update(canonical({organizationId:'gym',branchId:'east',actorId:'member',action:'session.save',input})).digest('hex')
   calls.push({id:input.operationId,hash,body})
   let result=receipts.get(input.operationId)
   if(result){assert.equal(result.receipt.requestHash,hash)}else{
    const session={schemaVersion:2,id:input.id,scope:{organizationId:'gym',branchId:'east',memberId:'member'},origin:input.origin,revision:input.expectedRevision+1,operationId:input.operationId,content:input.content,actorId:'member',acceptedAt:'2026-10-17T12:00:01.000Z'}
    result={session,receipt:{schemaVersion:2,operationId:input.operationId,resourceId:input.id,revision:session.revision,requestHash:hash,acceptedAt:session.acceptedAt}};receipts.set(input.operationId,result)
   }
   if(!lost){lost=true;res.destroy();return}
   res.end(JSON.stringify(result));return
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/probe.css"><body><div id="root"></div><script src="/probe.js"></script></body></html>')
 }catch(error){console.error(String(error));res.writeHead(500);res.end('{}')}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
let browser
try {
 browser=await chromium.launch({headless:true,chromiumSandbox:true,args:['--host-resolver-rules=MAP wp09-http.test 127.0.0.1','--proxy-bypass-list=wp09-http.test']})
 const context=await browser.newContext({viewport:{width:320,height:740},ignoreHTTPSErrors:false});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)))
 await page.goto(`http://wp09-http.test:${server.address().port}`);await page.waitForFunction(()=>Boolean(window.httpProbe))
 const flags=await page.evaluate(()=>window.httpProbe.flags())
 assert.deepEqual(flags,{secureContext:false,subtle:'undefined',randomUUID:'undefined',getRandomValues:'function'})
 const opened=await page.evaluate(()=>window.httpProbe.mount());await page.getByRole('heading',{name:'Routine',exact:true}).waitFor()
 await page.waitForFunction(()=>document.body.textContent.includes('Sincronizado'),null,{timeout:15000})
 assert.equal(receipts.size,1);assert.equal(calls.length,2);assert.equal(calls[0].id,calls[1].id);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].hash,calls[1].hash)
 assert.equal([...receipts.values()][0].session.content.explicitCompletion,false)
 assert.equal(opened.utf8Hash,createHash('sha256').update('Entrené 🏋🏽‍♀️ · mañana · 東京').digest('hex'))
 assert.match(opened.generatedId,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
 assert.deepEqual(await page.evaluate(()=>window.httpProbe.flags()),flags)
 const processes=await Promise.all((await readdir('/proc')).filter(x=>/^\d+$/.test(x)).map(async pid=>{try{return(await readFile(`/proc/${pid}/cmdline`,'utf8')).split('\0')}catch{return[]}}));const chrome=processes.filter(args=>args[0]?.includes('chrome-headless-shell'));assert.ok(chrome.length);assert.equal(chrome.some(args=>args.includes('--no-sandbox')),false)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({engine:'chromium',version:browser.version(),origin:'http://wp09-http.test',flags,opened:true,utf8Parity:true,lostResponseReplay:{requests:calls.length,acceptedOperations:receipts.size,sameIdAndBytes:true},explicitCompletion:false,sandbox:true,securityPropertiesUnmodified:true,fullApplicationOrAuthAcceptance:false},null,2))
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
