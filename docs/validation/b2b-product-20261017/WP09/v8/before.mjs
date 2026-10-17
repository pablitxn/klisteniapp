import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {chromium} from './node_modules/playwright-core/index.mjs'
const server=createServer(async(req,res)=>{if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('/harness/before/probe.iife.js'));return}if(req.url==='/probe.css'){res.setHeader('Content-Type','text/css');res.end(await readFile('/harness/before/probe.css'));return}res.setHeader('Content-Type','text/html');res.end('<html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/probe.css"><div id="root"></div><script src="/probe.js"></script></html>')})
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser
async function until(page,fn,check,label){let last;const end=Date.now()+12000;while(Date.now()<end){last=await page.evaluate(fn);if(check(last))return last;await new Promise(r=>setTimeout(r,40))}throw Error(label+':'+JSON.stringify(last))}
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true})
 const context=await browser.newContext({viewport:{width:320,height:740},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(`http://wp09-feedback.test:${server.address().port}/before/`);await page.waitForFunction(()=>Boolean(window.feedbackProbe))
 await page.evaluate(()=>window.feedbackProbe.mount('partial-target'))
 const accepted=await until(page,()=>window.feedbackProbe.read(),d=>d?.accepted&&d.operations.every(o=>o.state==='accepted'),'partial accepted')
 await page.getByRole('button',{name:'Completar sesión explícitamente',exact:true}).click();await page.waitForTimeout(1200)
 const alerts=await page.getByRole('alert').allTextContents(),d=await page.evaluate(()=>window.feedbackProbe.read());assert.equal(alerts.length,0);assert.equal(d.content.status,'partial');assert.equal(d.content.explicitCompletion,false)
 console.log(JSON.stringify({case:'incomplete-per-side-feedback-before',alerts,status:d.content.status,partialOperationUnchanged:JSON.stringify(d.operations)===JSON.stringify(accepted.operations)}))
 await page.evaluate(()=>window.feedbackProbe.mount('quota'));await until(page,()=>window.feedbackProbe.read(),d=>d?.accepted&&d.operations.every(o=>o.state==='accepted'),'initial quota accepted')
 await page.evaluate(()=>window.feedbackProbe.failStorage());await page.getByLabel(/cantidad$/).first().fill('3');await page.getByRole('status').filter({hasText:'No se pudo guardar en este dispositivo'}).waitFor()
 const measure=await page.evaluate(()=>window.feedbackProbe.measure()),opaque=await page.evaluate(()=>window.feedbackProbe.opaque());assert.equal(opaque,'{unreadable-old-draft: preserve these exact synthetic bytes');assert.ok(measure.document>320);assert.ok(measure.buttons.some(b=>b.text.includes('Recargar copia')&&b.whiteSpace==='nowrap'))
 assert.deepEqual(errors,[]);console.log(JSON.stringify({case:'quota-layout-before',measure,oldBytesPreserved:true,actualValue:await page.getByLabel(/cantidad$/).first().inputValue(),browser:browser.version(),nativeInsecureHTTP:await page.evaluate(()=>!isSecureContext)}))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
