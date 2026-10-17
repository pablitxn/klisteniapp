import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile,readdir} from 'node:fs/promises'
import {chromium} from './node_modules/playwright-core/index.mjs'
let apiRequests=0
const server=createServer(async(req,res)=>{if(req.url.startsWith('/api/')){apiRequests++;res.writeHead(500);res.end('{}');return}if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile('/harness/dist/probe.iife.js'));return}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body><div id="root"></div><script src="/probe.js"></script></body></html>')})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
let browser
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,args:['--host-resolver-rules=MAP wp09-recovery.test 127.0.0.1','--proxy-bypass-list=wp09-recovery.test']})
 const context=await browser.newContext({viewport:{width:320,height:740},ignoreHTTPSErrors:false}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)))
 await page.goto(`http://wp09-recovery.test:${server.address().port}`);await page.waitForFunction(()=>Boolean(window.recoveryProbe))
 assert.equal(await page.evaluate(()=>isSecureContext),false)
 const seeded=await page.evaluate(()=>window.recoveryProbe.seed())
 await page.reload();await page.waitForFunction(()=>Boolean(window.recoveryProbe))
 const inactive=await page.evaluate(()=>window.recoveryProbe.inactiveReload());assert.equal(inactive.operations,seeded.operations);assert.equal(inactive.readOnly,true)
 await context.setOffline(true);const offline=await page.evaluate(()=>window.recoveryProbe.inactiveReload());assert.equal(offline.operations,seeded.operations);await context.setOffline(false)
 const boundaries=await page.evaluate(()=>window.recoveryProbe.boundaries())
 const races=await page.evaluate(()=>window.recoveryProbe.races())
 const tamper=await page.evaluate(()=>window.recoveryProbe.tamper())
 await page.evaluate(()=>window.recoveryProbe.mountChoice())
 const choice=page.getByRole('region',{name:'Elegir sesión anterior o nueva'})
 await page.getByRole('heading',{name:'¿Retomar o empezar una sesión nueva?'}).waitFor()
 await page.getByRole('button',{name:'Retomar este borrador',exact:true}).waitFor()
 assert.deepEqual(await page.evaluate(()=>window.choiceState.selected),[])
 const start=page.getByRole('button',{name:'Empezar una sesión nueva',exact:true});assert.equal(await start.isDisabled(),true)
 await page.getByRole('checkbox').check();await start.click();await page.waitForFunction(()=>window.choiceState.selected.length===1)
 const choiceResult=await page.evaluate(()=>window.recoveryProbe.choiceResult());assert.equal(choiceResult.status,'draft');assert.equal(choiceResult.operations,0);assert.notEqual(choiceResult.id,'previous-session')
 await page.evaluate(()=>window.recoveryProbe.mountRecoveryView())
 await page.waitForFunction(()=>Boolean(document.querySelector('[data-testid=selected]')?.textContent))
 const immediate=await page.evaluate(()=>window.switchRecovery(true));assert.equal(immediate,'')
 await page.waitForFunction(()=>document.querySelector('[data-testid=selected]')?.textContent==='')
 await page.evaluate(()=>window.switchRecovery(false));await page.waitForFunction(()=>Boolean(document.querySelector('[data-testid=selected]')?.textContent));assert.equal(await page.getByTestId('resume').textContent(),'false')
 const processes=await Promise.all((await readdir('/proc')).filter(x=>/^\d+$/.test(x)).map(async pid=>{try{return(await readFile(`/proc/${pid}/cmdline`,'utf8')).split('\0')}catch{return[]}}));const chrome=processes.filter(args=>args[0]?.includes('chrome-headless-shell'));assert.ok(chrome.length);assert.equal(chrome.some(args=>args.includes('--no-sandbox')),false)
 assert.equal(apiRequests,0);assert.deepEqual(errors,[])
 console.log(JSON.stringify({engine:'chromium',version:browser.version(),nativeInsecureHTTP:true,databaseUpgrade:seeded.databaseUpgrade,oldBytesPreserved:true,reloadInactiveExport:inactive.readOnly,offlineStorage:true,boundaries,races,tamper,legacyChoice:choiceResult,immediateAccountClearing:true,inactiveCannotResume:true,APIRequests:apiRequests,sandbox:true,fullApplicationOrAuthAcceptance:false},null,2))
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
