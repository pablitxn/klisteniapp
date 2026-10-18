import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium, webkit } from './driver-playwright-core/index.mjs';
const require = createRequire(import.meta.url);
assert.equal(require('./driver-playwright-core/package.json').version, '1.63.0');
assert.notEqual(process.getuid(), 0);
assert.notEqual(process.env.WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS, '1');
const server = http.createServer((_req,res) => {res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local native runtime proof</title><body>Local synthetic runtime proof</body>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try {
 for (const [engine,type,expected] of [['chromium',chromium,'153.0.8010.12'],['webkit',webkit,'26.6']]) {
  const browser=await type.launch({headless:true,...(engine==='chromium'?{chromiumSandbox:true,args:['--enable-automation']}:{})});
  try {
   assert.equal(browser.version(),expected);
   let noSandboxArgument;
   if(engine==='chromium') { const cdp=await browser.newBrowserCDPSession();const {arguments:args}=await cdp.send('Browser.getBrowserCommandLine');noSandboxArgument=args.includes('--no-sandbox');assert.equal(noSandboxArgument,false);await cdp.detach(); }
   for(const width of [320,1440]) {
    const context=await browser.newContext({viewport:{width,height:width===320?740:1000},isMobile:width===320,hasTouch:width===320,ignoreHTTPSErrors:false});
    try {
     const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
     const proof=await page.evaluate(async()=>{
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('runtime-proof',1);req.onupgradeneeded=()=>req.result.createObjectStore('records');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
      await new Promise((resolve,reject)=>{const t=db.transaction('records','readwrite');t.objectStore('records').put('native-roundtrip','proof');t.oncomplete=resolve;t.onerror=()=>reject(t.error)});
      const record=await new Promise((resolve,reject)=>{const req=db.transaction('records','readonly').objectStore('records').get('proof');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});db.close();
      return {record,width:innerWidth,isSecureContext,nativeOnline:navigator.onLine};
     });
     assert.equal(proof.record,'native-roundtrip');assert.equal(proof.width,width);
     console.log(JSON.stringify({engine,driverVersion:'1.63.0',browserVersion:browser.version(),nodeVersion:process.version,uid:process.getuid(),chromiumSandbox:engine==='chromium'?true:undefined,noSandboxArgument,executablePath:type.executablePath(),network:'none; native loopback only',...proof}));
    }finally{await context.close()}
   }
  }finally{await browser.close()}
 }
}finally{await new Promise(r=>server.close(r))}
