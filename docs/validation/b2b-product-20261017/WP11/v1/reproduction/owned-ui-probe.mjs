import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { chromium, webkit } from 'playwright'
const engine = process.argv[2]
assert.ok(['chromium', 'webkit'].includes(engine))
const server = createServer(async (request, response) => {
  const file = request.url === '/' ? 'index.html' : request.url.slice(1)
  if (!['index.html', 'owned-ui.js', 'owned-ui.css', 'export.json'].includes(file)) {
    response.writeHead(404).end(); return
  }
  if (file === 'export.json') await new Promise((resolve) => setTimeout(resolve, 100))
  response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html')
  response.end(await readFile(new URL(`./public/${file}`, import.meta.url)))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true, ...(engine === 'chromium' ? { chromiumSandbox: true } : {}) })
const cases = []
try {
  for (const width of [320, 430, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 740 : width === 430 ? 932 : 1000 }, hasTouch: width < 500, ignoreHTTPSErrors: false })
    const page = await context.newPage()
    const unexpected = []
    const pageErrors = []
    page.on('pageerror', (error) => (pageErrors.push(error.message), console.error('page error:',error.message)))
    page.on('request', (request) => { if (!request.url().startsWith(origin)) unexpected.push(request.url()) })
    const button = (name) => page.getByRole('button', { name, exact: true })
    page.setDefaultTimeout(7000)
    await page.goto(origin)
    await page.getByRole('heading', { name: 'Tu membresía está inactiva', exact: true }).waitFor().catch(async error => { console.error(JSON.stringify({body: await page.locator('body').innerText(), pageErrors})); throw error })
    assert.deepEqual(await page.evaluate(() => window.wp11.calls), [])
    assert.equal(await page.getByRole('main').count(), 1)
    assert.equal(await page.getByRole('link').count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Descargar mis registros')
    assert.ok(await page.evaluate(() => Number.parseFloat(getComputedStyle(document.activeElement).minHeight) >= 44))
    await page.evaluate(() => { window.wp11.failExport = true })
    await button('Descargar mis registros').click()
    await page.getByRole('alert').waitFor()
    await page.evaluate(() => { window.wp11.failExport = false })
    await button('Reintentar exportación').click()
    await page.getByText('Preparando el archivo completo…', { exact: true }).waitFor()
    await page.getByText('Archivo preparado. Revisá las descargas del navegador.', { exact: true }).waitFor()
    const downloaded = await page.evaluate(() => JSON.parse(window.wp11.downloads[0].json))
    assert.equal(downloaded.serverAcceptedOnly, true)
    assert.equal(downloaded.training.length, 2)
    assert.deepEqual(downloaded.training[0].sessionRevisions.map((r) => r.revision), [1, 2])
    assert.deepEqual(downloaded.training[0].sessionRevisions[1].content.segments[1].dose.durationSeconds, { kind: 'range', min: 30, max: 45 })
    assert.equal(downloaded.health.ownerId, 'member')
    await button('Consultar invitación B2C').click()
    await page.getByText('No hay una invitación B2C configurada.', { exact: true }).waitFor()
    await page.evaluate(() => { window.wp11.configured = true })
    await button('Consultar invitación B2C').click()
    const invitation = page.getByRole('link', { name: 'Conocer B2C en otro sitio', exact: true })
    await invitation.waitFor()
    assert.equal(await invitation.getAttribute('href'), 'https://personal.example.test/start')
    assert.equal(await invitation.getAttribute('target'), '_blank')
    assert.equal(await invitation.getAttribute('referrerpolicy'), 'no-referrer')
    const beforeCalls = await page.evaluate(() => window.wp11.calls)
    const popupPromise = context.waitForEvent('page')
    // Fulfill the normal invitation navigation locally; no external server receives a request.
    await context.route('https://personal.example.test/**', (route) => route.fulfill({ body: '<h1>Separate invitation destination</h1>', contentType: 'text/html' }))
    await invitation.click()
    const popup = await popupPromise
    await popup.waitForLoadState()
    await popup.close()
    assert.deepEqual(await page.evaluate(() => window.wp11.calls), beforeCalls)
    assert.deepEqual(await context.cookies(), [])
    await page.screenshot({ path: `/tmp/wp11-${engine}-${width}.png`, fullPage: true })
    await page.evaluate(() => { window.wp11.reactivate = true })
    await button('Actualizar mi acceso').click()
    await page.getByRole('heading', { name: 'Current gym history', exact: true }).waitFor()
    await page.evaluate(() => window.wp11.transition('inactive'))
    await page.getByRole('heading', { name: 'Tu membresía está inactiva', exact: true }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Current gym history' }).count(), 0)
    await page.evaluate(() => { window.wp11.local = true; window.wp11.transition('inactive') })
    await button('Descargar trabajo local').click()
    await page.getByText('Archivo local preparado; sigue sin sincronizar.', { exact: true }).waitFor()
    const local = await page.evaluate(() => JSON.parse(window.wp11.downloads.at(-1).json))
    assert.equal(local.serverConfirmed, false)
    assert.deepEqual(local.localContent, { ownerOpaquePendingWork: true })
    await page.evaluate(() => window.wp11.transition('foreign'))
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByRole('button').count(), 0)
    assert.deepEqual(unexpected, [])
    assert.deepEqual(pageErrors, [])
    cases.push({ width, passed: true, groups: 14 })
    await context.close()
  }
  console.log(JSON.stringify({ engine, browserVersion: browser.version(), playwright: '1.63.0', sandbox: engine === 'chromium', cases, failed: 0, skipped: 0 }))
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
