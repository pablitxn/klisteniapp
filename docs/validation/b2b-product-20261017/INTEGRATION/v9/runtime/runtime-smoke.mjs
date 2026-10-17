import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from './driver-playwright-core/index.mjs';
const require = createRequire(import.meta.url);
const driverVersion = require('./driver-playwright-core/package.json').version;
assert.equal(driverVersion, '1.63.0');
assert.notEqual(process.getuid(), 0);
const server = http.createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end('<!doctype html><title>Native IndexedDB runtime smoke</title>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, chromiumSandbox: true, args: ['--enable-automation'] });
  assert.equal(browser.version(), '153.0.8010.12');
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('route-runtime-smoke', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('records');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      transaction.objectStore('records').put({ value: 'native-idb-roundtrip' }, 'proof');
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const record = await new Promise((resolve, reject) => {
      const transaction = database.transaction('records', 'readonly');
      const request = transaction.objectStore('records').get('proof');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { record, userAgent: navigator.userAgent, isSecureContext, indexedDB: String(indexedDB) };
  });
  assert.equal(result.record.value, 'native-idb-roundtrip');
  const cdp = await browser.newBrowserCDPSession();
  const { arguments: launchArguments } = await cdp.send('Browser.getBrowserCommandLine');
  assert.ok(!launchArguments.includes('--no-sandbox'));
  console.log(JSON.stringify({
    driverVersion, browserVersion: browser.version(), uid: process.getuid(),
    nodeVersion: process.version, chromiumSandbox: true, noSandboxArgument: false,
    executablePath: chromium.executablePath(), ...result
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
