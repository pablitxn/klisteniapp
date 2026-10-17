import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { chromium, webkit } from '/runtime/driver-playwright-core/index.mjs'
const engine = process.argv[2] || 'chromium'
let active
const projection = (date = '2026-10-16') => ({ schemaVersion: 2, ownerId: 'owner', consentId: 'consent', consentRevision: 2, scope: { organizationId: 'atlas', branchId: 'east' }, viewedAt: '2026-10-17T12:00:00.000Z', categories: [{ category: 'sleep', records: [{ id: 'synthetic-sleep', date, recordedAt: `${date}T12:00:00.000Z`, source: { kind: 'manual' }, durationMinutes: 480 }] }] })
const json = (res, value, status = 200) => { if (!res.destroyed) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)) } }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'), cfg = active
  try {
    if (url.pathname === '/authority') {
      cfg.events.push({ event: 'authority-request', held: cfg.holdAuthority })
      if (cfg.holdAuthority) cfg.authorities.push(res)
      else json(res, { accepted: cfg.authorityAccepted })
      return
    }
    if (url.pathname.endsWith('/product/v2/events')) {
      const target = url.searchParams.get('memberId')
      cfg.events.push({ event: 'stream-request', target, denied: Boolean(target && cfg.denyTarget) })
      if (target && cfg.denyTarget) return json(res, { error: 'Synthetic target authority denied', code: 'FORBIDDEN' }, 403)
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
      res.write('event: ready\ndata: {}\n\n')
      const interval = setInterval(() => res.write('event: heartbeat\ndata: {}\n\n'), 1000)
      res.on('close', () => clearInterval(interval))
      return
    }
    if (url.pathname.endsWith('/history-subjects')) return json(res, { schemaVersion: 2, scope: { organizationId: 'atlas', branchId: 'east' }, members: [{ userId: 'owner', name: 'Synthetic owner', active: true }] })
    if (url.pathname.endsWith('/members/owner/health')) {
      cfg.healthReads++
      cfg.events.push({ event: 'health-request', ordinal: cfg.healthReads, held: cfg.holdHealth })
      if (cfg.holdHealth) cfg.health.push(res)
      else json(res, projection(cfg.date))
      return
    }
    if (url.pathname.startsWith('/api/')) throw new Error(`Unexpected synthetic API path: ${url.pathname}`)
    if (url.pathname.endsWith('/probe.js') || url.pathname.endsWith('/probe.css')) {
      res.setHeader('content-type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css')
      res.end(await readFile(`/harness/${url.pathname.startsWith('/before/') ? 'dist-before' : 'dist'}/${url.pathname.split('/').at(-1)}`)); return
    }
    const prefix = url.pathname.startsWith('/before') ? '/before' : ''
    res.setHeader('content-type', 'text/html')
    res.end(`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="${prefix}/probe.css"><body><div id="root"></div><script src="${prefix}/probe.js"></script></body></html>`)
  } catch (error) { console.error(error); json(res, { error: String(error) }, 500) }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`, results = [], pageErrors = []
let browser
const emit = value => { results.push(value); console.log(JSON.stringify(value)) }
const wait = async (page, fn, label) => {
  try { await page.waitForFunction(fn, undefined, { timeout: 12000 }) }
  catch (error) { console.error(JSON.stringify({ failed: label, state: await page.evaluate(() => window.healthProof?.state()), text: await page.locator('body').innerText(), network: active.events })); throw error }
}
async function start(before = false, startOther = false) {
  active = { healthReads: 0, holdAuthority: false, authorityAccepted: true, authorities: [], holdHealth: false, health: [], denyTarget: false, date: '2026-10-16', events: [] }
  const context = await browser.newContext({ viewport: { width: 320, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', error => pageErrors.push(String(error)))
  await page.goto(origin + (before ? '/before/' : '/') + (startOther ? '?startOther=1' : ''))
  assert.equal(await page.evaluate(() => isSecureContext), true)
  await page.bringToFront()
  await page.evaluate(() => window.healthProof.start())
  await wait(page, () => window.healthProof.state().outerReady, 'initial workspace authority')
  if (startOther) return { context, page, cfg: active }
  await wait(page, () => Boolean(document.querySelector('select')), 'initial roster mount')
  await page.getByRole('combobox').selectOption('owner')
  await page.getByRole('heading', { name: 'Sueño', exact: true }).waitFor()
  assert.equal(active.healthReads, 1)
  return { context, page, cfg: active }
}
async function disconnect({ context, page, cfg }) {
  cfg.holdAuthority = true
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Volver a validar consentimiento', exact: true }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Sueño', exact: true }).count(), 0)
  assert.equal((await page.evaluate(() => window.healthProof.state())).outerReady, false)
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Volver a validar consentimiento', exact: true }).click()
  await wait(page, () => window.healthProof.state().events.filter(event => event.event === 'outer-revalidation-start').length >= 2, 'outer reconnect held')
  assert.ok(cfg.authorities.length > 0)
}
function releaseAuthority(cfg, accepted = true) {
  cfg.holdAuthority = false; cfg.authorityAccepted = accepted
  cfg.events.push({ event: 'authority-release', accepted })
  for (const res of cfg.authorities.splice(0)) json(res, { accepted })
}
try {
  browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ headless: true, chromiumSandbox: true, args: ['--enable-automation'] }))
  emit({ engine, browser: browser.version(), dateMode: 'real progressing clock', viewport: 320, fixture: 'synthetic loopback HTTP/SSE; actual ProductViews/useProductStream/health client/controller' })
  if (engine === 'chromium') {
    const session = await browser.newBrowserCDPSession(), command = await session.send('Browser.getBrowserCommandLine')
    assert.ok(!command.arguments.includes('--no-sandbox')); await session.detach()
  }
  {
    const test = await start(true), { page, cfg, context } = test
    await disconnect(test)
    await page.getByRole('button', { name: 'Validar y mostrar datos', exact: true }).waitFor()
    await page.getByRole('alert').filter({ hasText: 'No se pudo completar la operación' }).waitFor()
    assert.equal(cfg.healthReads, 1)
    releaseAuthority(cfg)
    await wait(page, () => window.healthProof.state().outerReady, 'baseline outer recovered')
    await page.waitForTimeout(250)
    assert.equal(await page.getByRole('heading', { name: 'Sueño', exact: true }).count(), 0)
    assert.equal(cfg.healthReads, 1)
    emit({ case: 'baseline-health-005-reproduced', genericErrorBeforeNetwork: true, remainedFailedAfterOuterReady: true, events: cfg.events })
    await context.close()
  }
  {
    const test = await start(), { page, cfg, context } = test
    cfg.holdHealth = true
    await page.getByRole('button', { name: 'Validar y mostrar datos', exact: true }).click()
    await page.getByText('Validando acceso y consentimiento…', { exact: true }).waitFor()
    assert.equal(cfg.healthReads, 2)
    await disconnect(test)
    await page.getByText('Validando acceso y consentimiento actuales…', { exact: true }).waitFor()
    await page.waitForTimeout(250)
    assert.equal(await page.getByRole('button', { name: 'Validar y mostrar datos', exact: true }).count(), 0)
    assert.equal(cfg.healthReads, 2)
    for (const res of cfg.health.splice(0)) json(res, projection('2000-01-01'))
    assert.equal(await page.getByText('Registro del 2000-01-01', { exact: true }).count(), 0)
    cfg.holdHealth = false; cfg.date = '2026-10-17'
    releaseAuthority(cfg)
    await page.getByRole('heading', { name: 'Sueño', exact: true }).waitFor()
    await page.getByText('Registro del 2026-10-17', { exact: true }).waitFor()
    assert.equal(cfg.healthReads, 3)
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(await page.getByText('Registro del 2000-01-01', { exact: true }).count(), 0)
    assert.equal(await page.getByText('Registro del 2026-10-16', { exact: true }).count(), 0)
    emit({ case: 'both-ready-before-new-health-read', noReadWhileOuterPending: true, freshReadAfterReadiness: true, oldProjectionAndDelayedResponseHidden: true, events: cfg.events })
    await context.close()
  }
  for (const denial of ['outer-authority', 'target-consent']) {
    const test = await start(), { page, cfg, context } = test
    if (denial === 'target-consent') cfg.denyTarget = true
    await disconnect(test)
    releaseAuthority(cfg, denial !== 'outer-authority')
    if (denial === 'target-consent') {
      await page.getByRole('button', { name: 'Volver a validar consentimiento', exact: true }).waitFor()
      await wait(page, () => window.healthProof.state().outerReady, 'outer ready but target denied')
    } else {
      await wait(page, () => window.healthProof.state().events.some(event => event.event === 'outer-revalidation-finish' && event.accepted === false), 'outer rejection')
    }
    await page.waitForTimeout(300)
    assert.equal(cfg.healthReads, 1)
    assert.equal(await page.getByRole('heading', { name: 'Sueño', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Validar y mostrar datos', exact: true }).count(), 0)
    emit({ case: `${denial}-denied`, noHealthRead: true, privateDataHidden: true, events: cfg.events })
    await context.close()
  }
  {
    const { page, cfg, context } = await start(false, true)
    cfg.holdAuthority = true
    await context.setOffline(true)
    await wait(page, () => !window.healthProof.state().outerReady, 'offline before shared-health entry')
    await page.getByRole('link', { name: 'Salud compartida', exact: true }).click()
    await page.getByRole('combobox').waitFor()
    assert.equal(cfg.healthReads, 0)
    assert.equal(await page.getByRole('alert').count(), 0)
    await context.setOffline(false)
    await wait(page, () => window.healthProof.state().events.filter(event => event.event === 'outer-revalidation-start').length >= 2, 'offline-entry reconnect held')
    releaseAuthority(cfg)
    await page.getByRole('combobox').selectOption('owner')
    await page.getByRole('heading', { name: 'Sueño', exact: true }).waitFor()
    assert.equal(cfg.healthReads, 1)
    assert.equal(await page.getByRole('alert').count(), 0)
    emit({ case: 'offline-entry-roster-recovers', selectorReloadedAfterReadiness: true, healthReadAfterConsent: true, events: cfg.events })
    await context.close()
  }
  assert.deepEqual(pageErrors, [])
  emit({ result: 'PASS', engine, cases: 5, pageErrors: 0, secureContext: 'native loopback', browserSandbox: engine === 'chromium' ? 'chromiumSandbox:true; no --no-sandbox' : 'native WebKit; no sandbox disable flags' })
} catch (error) { console.error(error); process.exitCode = 1 }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
