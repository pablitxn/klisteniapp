import {createServer} from 'node:http'
import {readFile,readdir} from 'node:fs/promises'
import {chromium} from './node_modules/playwright-core/index.mjs'
const server=createServer(async(req,res)=>{if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('/harness/dist/probe.iife.js'))}else if(req.url==='/probe.css'){res.setHeader('Content-Type','text/css');res.end(await readFile('/harness/dist/probe.css'))}else{res.end('<html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/probe.css"><body><div id="root"></div><script src="/probe.js"></script></body></html>')}})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
let browser
try {
 browser=await chromium.launch({headless:true,chromiumSandbox:true})
 const context=await browser.newContext({viewport:{width:320,height:740},ignoreHTTPSErrors:false})
 await context.setOffline(false)
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE ERROR',String(e))})
 await page.goto(`http://127.0.0.1:${server.address().port}`)
 await page.waitForFunction(()=>Boolean(window.probe))
 const storage=await page.evaluate(()=>window.probe.storage());console.log(JSON.stringify({storage,online:await page.evaluate(()=>navigator.onLine)}))
 await page.evaluate(()=>window.probe.mount())
 await page.getByRole('heading',{name:'Routine',exact:true}).waitFor()
 await page.waitForFunction(()=>document.body.textContent.includes('Sincronizado'),null,{timeout:8000}).catch(async e=>{console.error('BODY',await page.locator('body').innerText());throw e})
 await page.getByLabel('segment-1 1 both cantidad').fill('4')
 await page.waitForFunction(async()=>{const req=indexedDB.open('wp09-native-ui',2);const db=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error)});const q=db.transaction('workouts-v2').objectStore('workouts-v2').getAll();const values=await new Promise((r,j)=>{q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});db.close();return values[0]?.accepted?.content.sets[0]?.repetitions===4},null,{timeout:10000})
 const stored=await page.evaluate(async()=>{const req=indexedDB.open('wp09-native-ui',2);const db=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error)});const q=db.transaction('workouts-v2').objectStore('workouts-v2').getAll();return await new Promise((r,j)=>{q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})})
 if(stored[0].content.sets[0]?.repetitions!==4 || stored[0].accepted.content.status==='completed') throw Error('Hook lost actuals or silently completed')
 const processes=await Promise.all((await readdir('/proc')).filter(x=>/^\d+$/.test(x)).map(async pid=>{try{return (await readFile(`/proc/${pid}/cmdline`,'utf8')).split('\0')}catch{return []}}))
 const chrome=processes.filter(args=>args[0]?.includes('chrome-headless-shell'))
 if(!chrome.length || chrome.some(args=>args.includes('--no-sandbox')))throw Error('Sandbox process check failed')
 if(errors.length)throw Error(errors.join('\n'))
 console.log(JSON.stringify({engine:'chromium',version:browser.version(),storage,hook:{strictMode:true,autosavePartial:true,actualRetained:4},sandbox:true,viewport:{width:320,height:740},productBrowserAcceptance:false},null,2))
} finally {if(browser)await browser.close();await new Promise(r=>server.close(r))}
