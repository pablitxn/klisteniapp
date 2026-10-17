import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { chromium, webkit } from '/runtime/driver-playwright-core/index.mjs'
const engine = process.argv[2]
assert.ok(['chromium', 'webkit'].includes(engine))
const server = http.createServer(async (req, res) => {
  try {
    const request = new URL(req.url, 'http://local.test')
    if (request.pathname === '/probe.js' || request.pathname === '/probe.css' || request.pathname === '/before/probe.js' || request.pathname === '/before/probe.css') {
      const before = request.pathname.startsWith('/before/')
      res.setHeader('content-type', request.pathname.endsWith('.js') ? 'text/javascript' : 'text/css')
      res.end(await readFile('/harness/' + (before ? 'dist-before' : 'dist') + '/' + request.pathname.split('/').at(-1)))
      return
    }
    if (request.pathname.startsWith('/api/')) {
      res.writeHead(503, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ code: 'UNAVAILABLE', error: 'Synthetic local fixture has no live API' }))
      return
    }
    const prefix = request.searchParams.get('variant') === 'before' ? '/before' : ''
    res.setHeader('content-type', 'text/html')
    res.end(`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${prefix}/probe.css"><body><div id="root"></div><script src="${prefix}/probe.js"></script></body></html>`)
  } catch (error) { res.writeHead(500); res.end(String(error)) }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://${engine === 'webkit' ? '127.0.0.1' : 'route-proof.test'}:${server.address().port}`
const results = [], errors = []
let browser
try {
  browser = await (engine === 'chromium' ? chromium.launch({ headless: true, chromiumSandbox: true, args: ['--enable-automation', '--host-resolver-rules=MAP route-proof.test 127.0.0.1', '--proxy-bypass-list=route-proof.test'] }) : webkit.launch({ headless: true }))
  for (const variant of ['before', 'after']) for (const width of [320, 430, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 700, hasTouch: width < 700, ignoreHTTPSErrors: false })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(String(error)))
    await page.goto(url + '/?variant=' + variant)
    await page.waitForFunction(() => Boolean(window.routeProof))
    await page.evaluate(() => window.routeProof.start())
    const resume = page.getByRole('button', { name: 'Retomar trabajo guardado en este dispositivo', exact: true })
    await resume.waitFor()
    await page.getByRole('heading', { name: 'Mi rutina e historial', exact: true }).waitFor()
    const measurement = await resume.evaluate(button => {
      const box = button.getBoundingClientRect(), css = getComputedStyle(button)
      const range = document.createRange(); range.selectNodeContents(button)
      const lines = [...range.getClientRects()].filter(rect => rect.width && rect.height).map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }))
      return { innerWidth, visualWidth: visualViewport.width, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, nativeInsecureHTTP: !isSecureContext, text: button.textContent.trim(), button: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height, clientWidth: button.clientWidth, scrollWidth: button.scrollWidth, clientHeight: button.clientHeight, scrollHeight: button.scrollHeight }, styles: { whiteSpace: css.whiteSpace, overflowX: css.overflowX, overflowY: css.overflowY, textOverflow: css.textOverflow, maxWidth: css.maxWidth }, lines }
    })
    if (engine === 'chromium') assert.equal(measurement.nativeInsecureHTTP, true)
    if (variant === 'before' && width === 320) assert.ok(measurement.documentWidth > width && measurement.button.right > width, JSON.stringify(measurement))
    if (variant === 'after') {
      assert.equal(measurement.innerWidth, width)
      assert.ok(measurement.documentWidth <= width && measurement.bodyWidth <= width, JSON.stringify(measurement))
      assert.ok(measurement.button.left >= 0 && measurement.button.right <= width)
      assert.ok(measurement.button.scrollWidth <= measurement.button.clientWidth && measurement.button.scrollHeight <= measurement.button.clientHeight)
      assert.equal(measurement.styles.whiteSpace, 'normal')
      assert.equal(measurement.styles.overflowX, 'visible'); assert.equal(measurement.styles.overflowY, 'visible')
      assert.equal(measurement.styles.textOverflow, 'clip') // Default style; no overflow or hidden content exists.
      assert.ok(measurement.lines.every(line => line.left >= measurement.button.left && line.right <= measurement.button.right && line.top >= measurement.button.top && line.bottom <= measurement.button.top + measurement.button.height))
      if (width === 320) assert.ok(new Set(measurement.lines.map(line => line.top)).size > 1)
      await page.screenshot({ path: `/results/${engine}-${width}.png`, fullPage: true })
      await resume.click()
      await page.getByLabel('Notas de la sesión', { exact: true }).waitFor()
      await page.waitForFunction(() => window.routeProof.state().ready)
      await page.getByLabel('Notas de la sesión', { exact: true }).fill('Root route notes')
      await page.waitForFunction(() => window.routeProof.state().held)
      await page.getByLabel('Motivo de corrección', { exact: true }).fill('Root final correction reason')
      await page.getByRole('button', { name: 'Volver', exact: true }).click()
      assert.equal(await page.getByLabel('Notas de la sesión', { exact: true }).count(), 1)
      await page.evaluate(() => window.routeProof.release())
      await resume.waitFor()
      const doc = await page.evaluate(() => window.routeProof.reopen())
      assert.equal(doc.generation, 2); assert.equal(doc.content.notes, 'Root route notes'); assert.equal(doc.content.correctionReason, 'Root final correction reason'); assert.equal(doc.content.status, 'partial'); assert.equal(doc.content.explicitCompletion, false); assert.equal(doc.binding.original.original.notes, 'Original note'); assert.equal(doc.operations.length, 0)
      assert.equal((await page.evaluate(() => window.routeProof.selected())).document.generation, 2)
    }
    const result = { engine, variant, viewport: width, measurement, closeWithTwoCapturedEdits: variant === 'after', fullAuthenticatedApplication: false }
    results.push(result); console.log(JSON.stringify(result)); await context.close()
  }
  if (engine === 'chromium') { const cdp = await browser.newBrowserCDPSession(); const launch = await cdp.send('Browser.getBrowserCommandLine'); assert.equal(launch.arguments.includes('--no-sandbox'), false) }
  assert.deepEqual(errors, [])
  const report = { engine, driver: '1.63.0', browser: browser.version(), uid: process.getuid(), results, errors }
  await writeFile(`/results/${engine}.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
