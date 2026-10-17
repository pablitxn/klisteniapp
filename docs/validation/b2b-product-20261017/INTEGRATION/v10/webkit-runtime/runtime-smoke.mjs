import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { webkit } from '/runtime/driver-playwright-core/index.mjs';
const require = createRequire(import.meta.url);
const driverVersion = require('/runtime/driver-playwright-core/package.json').version;
assert.equal(driverVersion, '1.63.0');
assert.notEqual(process.getuid(), 0);
assert.equal(process.env.WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS, undefined);
const server = http.createServer((_q,r)=>{
  r.setHeader('Content-Type', 'text/html');
  r.end('<!doctype html><meta charset="utf-8"><title>Native WebKit IndexedDB runtime</title>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
  const proxyUrl = new URL(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy);
  const proxy = { server: proxyUrl.origin, bypass: 'route-proof.test,127.0.0.1,localhost' };
  if (proxyUrl.username) proxy.username = decodeURIComponent(proxyUrl.username);
  if (proxyUrl.password) proxy.password = decodeURIComponent(proxyUrl.password);
  browser = await webkit.launch({headless:true, proxy});
  assert.equal(browser.version(), '26.6');
  const page = await browser.newPage({viewport:{width:320,height:900}});
  await page.goto(`http://route-proof.test:${server.address().port}/`,{timeout:10000});
  const result = await page.evaluate(async()=>{
    const database = await new Promise((resolve,reject)=>{
      const request=indexedDB.open('webkit-native-runtime-smoke',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('records');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    await new Promise((resolve,reject)=>{
      const tx=database.transaction('records','readwrite');
      tx.objectStore('records').put({value:'native-webkit-idb'},'proof');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    const record=await new Promise((resolve,reject)=>{
      const request=database.transaction('records','readonly').objectStore('records').get('proof');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    database.close();
    return {record,userAgent:navigator.userAgent,isSecureContext,indexedDB:String(indexedDB),hostname:location.hostname,innerWidth};
  });
  assert.equal(result.record.value,'native-webkit-idb');
  assert.equal(result.isSecureContext,false);
  assert.equal(result.hostname,'route-proof.test');
  assert.equal(result.innerWidth,320);
  console.log(JSON.stringify({driverVersion,browserVersion:browser.version(),revision:'2359',uid:process.getuid(),nodeVersion:process.version,executablePath:webkit.executablePath(),sandboxDisableEnvPresent:false,...result},null,2));
} finally {
  await browser?.close();
  await new Promise(r=>server.close(r));
}
