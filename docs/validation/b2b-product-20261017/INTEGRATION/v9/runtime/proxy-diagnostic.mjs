import http from 'node:http';
import { chromium } from './driver-playwright-core/index.mjs';
const server = http.createServer((_q,r)=>r.end('local-domain-proof'));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const envSummary = Object.fromEntries(Object.entries(process.env).filter(([k])=>/proxy|NODE_OPTIONS/i.test(k)).map(([k,v])=>[k,/^no_proxy$/i.test(k)?v:'<set>']));
const browser = await chromium.launch({headless:true,chromiumSandbox:true,args:['--enable-automation','--host-resolver-rules=MAP route-proof.test 127.0.0.1','--proxy-bypass-list=route-proof.test']});
try {
 const cdp=await browser.newBrowserCDPSession();
 const launch=await cdp.send('Browser.getBrowserCommandLine');
 console.log(JSON.stringify({envSummary,browserVersion:browser.version(),routingArgs:launch.arguments.filter(a=>/proxy|host-resolver/i.test(a)).map(a=>a.startsWith('--proxy-server=')?'--proxy-server=<redacted>':a)},null,2));
 for(const host of ['127.0.0.1','route-proof.test']){
  const page=await browser.newPage();
  try{await page.goto(`http://${host}:${server.address().port}/`,{timeout:5000});console.log(JSON.stringify({host,body:await page.textContent('body'),isSecureContext:await page.evaluate(()=>isSecureContext)}));}
  catch(e){console.log(JSON.stringify({host,error:String(e).replace(/https?:\/\/[^\s]+/g,'<url>')}));}
  finally{await page.close();}
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
