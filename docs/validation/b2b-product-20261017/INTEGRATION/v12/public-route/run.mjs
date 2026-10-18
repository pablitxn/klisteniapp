import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { chromium, webkit } from '/runtime/driver-playwright-core/index.mjs'
const engine = process.argv[2] || 'chromium'
let current
const inactive = { schemaVersion: 2, user: { id: 'owner', name: 'Synthetic owner', email: 'owner@example.test' }, realm: { mode: 'white-label', key: 'synthetic-known-brand' }, memberships: [{ organizationId: 'gym', name: 'Synthetic gym', role: 'member', activated: true, accessMode: 'export-only', accessRevision: 1, choices: [] }] }
const access = { schemaVersion: 2, userId: 'owner', organizationId: 'gym', role: 'member', accessMode: 'export-only', accessRevision: 1, branches: [], capabilities: ['export-own-records'] }
const json = (response, value, status = 200) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)) }
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost'), cfg = current
  try {
    if (url.pathname.startsWith('/api/')) {
      cfg.requests.push({ method: request.method, path: url.pathname })
      if (url.pathname === '/api/b2b/context') {
        if (cfg.disconnect) return request.socket.destroy()
        return json(response, { error: cfg.message, ...(cfg.code ? { code: cfg.code } : {}) }, cfg.status)
      }
      if (url.pathname === '/api/b2b/bootstrap/v2') return json(response, inactive)
      if (url.pathname === '/api/b2b/orgs/gym/product/v2/access') return json(response, access)
      if (url.pathname === '/api/b2b/orgs/gym/product/v2/events') {
        response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
        response.write('event: ready\ndata: {}\n\n')
        const heartbeat = setInterval(() => response.write('event: heartbeat\ndata: {}\n\n'), 1000)
        response.on('close', () => clearInterval(heartbeat)); return
      }
      cfg.unexpected.push(url.pathname)
      return json(response, { error: 'Unexpected synthetic request', code: 'UNEXPECTED' }, 503)
    }
    if (url.pathname.endsWith('/probe.js') || url.pathname.endsWith('/probe.css')) {
      const before = url.pathname.startsWith('/before/')
      response.setHeader('content-type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css')
      response.end(await readFile(`/harness/${before ? 'dist-before' : 'dist'}/${url.pathname.split('/').at(-1)}`)); return
    }
    const prefix = url.searchParams.has('before') ? '/before' : ''
    response.setHeader('content-type', 'text/html')
    response.end(`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="${prefix}/probe.css"><body><div id="root"></div><script src="${prefix}/probe.js"></script><script>window.publicProof.start()</script></body></html>`)
  } catch (error) { console.error(error); response.writeHead(500); response.end(String(error)) }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`, records = [], errors = []
let browser
const emit = value => { records.push(value); console.log(JSON.stringify(value)) }
async function start(config = {}, width = 320, path = '/unknown-wp12-route') {
  current = { status: 403, code: 'CONTEXT_REVOKED', message: 'Tu cuenta permite descargar tus registros.', requests: [], unexpected: [], ...config }
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage(); page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto(origin + path)
  await page.bringToFront()
  await page.waitForFunction(() => window.publicProof && !window.publicProof.state().brandLoading)
  assert.equal(await page.evaluate(() => isSecureContext), true)
  return { page, context, cfg: current }
}
async function publicOnly(page, cfg) {
  assert.equal((await page.evaluate(() => window.publicProof.state())).bootstrap, false)
  assert.deepEqual(cfg.requests, [{ method: 'GET', path: '/api/b2b/context' }])
  assert.deepEqual(cfg.unexpected, [])
  assert.equal(await page.getByRole('heading', { name: 'Mi rutina e historial', exact: true }).count(), 0)
  assert.equal(await page.getByRole('heading', { name: 'Mi salud y privacidad', exact: true }).count(), 0)
}
async function restricted(page, cfg) {
  await page.getByRole('heading', { name: 'Tu membresía está inactiva', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Descargar mis registros', exact: true }).waitFor()
  assert.equal((await page.evaluate(() => window.publicProof.state())).access, 'export-only')
  const allowed = ['/api/b2b/context', '/api/b2b/bootstrap/v2', '/api/b2b/orgs/gym/product/v2/access', '/api/b2b/orgs/gym/product/v2/events']
  assert.ok(cfg.requests.every(request => allowed.includes(request.path)), JSON.stringify(cfg.requests))
  assert.deepEqual(cfg.unexpected, [])
  assert.equal(await page.getByRole('heading', { name: 'Mi rutina e historial', exact: true }).count(), 0)
}
try {
  browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ headless: true, chromiumSandbox: true, args: ['--enable-automation'] }))
  if (engine === 'chromium') {
    const session = await browser.newBrowserCDPSession(), args = await session.send('Browser.getBrowserCommandLine')
    assert.ok(!args.arguments.includes('--no-sandbox')); await session.detach()
  }
  emit({ engine, version: browser.version(), syntheticTransport: true, components: ['App', 'ApplicationProvider', 'useBrandContext', 'useB2BSession', 'ProductWorkspace', 'MembershipAccessBoundary'], nativeSecurityAndClock: true })
  {
    const { page, context, cfg } = await start({}, 320, '/unknown-wp12-route?before=1')
    await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Esta página no existe', exact: true }).count(), 0)
    await publicOnly(page, cfg)
    emit({ case: 'baseline-inactive-public-404-preempted', reproduced: true, requests: cfg.requests })
    await context.close()
  }
  for (const width of [320, 1440]) {
    const { page, context, cfg } = await start(width === 1440 ? { message: 'Synthetic translated denial; classification uses status/code' } : {}, width)
    await page.getByRole('heading', { name: 'Esta página no existe', exact: true }).waitFor()
    await publicOnly(page, cfg)
    assert.equal(await page.locator('.brand-link').getAttribute('href'), '/app')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    const initialRequests = structuredClone(cfg.requests)
    await page.locator('.brand-link').click(); await restricted(page, cfg)
    await page.goBack(); await page.waitForURL('**/unknown-wp12-route'); await restricted(page, cfg)
    assert.equal(await page.getByRole('heading', { name: 'Esta página no existe', exact: true }).count(), 0)
    emit({ case: 'inactive-public-404-and-restricted-recovery', width, publicRequests: initialRequests, backRetainsMembershipBoundary: true, operationalRequests: 0, requests: cfg.requests })
    await context.close()
  }
  for (const denial of [
    { status: 421, code: 'DOMAIN_NOT_FOUND' },
    { status: 401, code: 'BRAND_SESSION_REQUIRED' },
    { status: 403, code: 'FORBIDDEN' },
    { status: 403, code: null },
    { status: 502, code: 'CONTEXT_REVOKED' },
    { status: 404, code: 'NOT_FOUND' },
    { status: 0, disconnect: true, code: null },
  ]) {
    const { page, context, cfg } = await start(denial)
    await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Esta página no existe', exact: true }).count(), 0)
    // A native failed request may be retried by the browser; every request is public context.
    assert.ok(cfg.requests.length >= 1 && cfg.requests.every(request => request.path === '/api/b2b/context'))
    assert.equal((await page.evaluate(() => window.publicProof.state())).bootstrap, false)
    assert.deepEqual(cfg.unexpected, [])
    emit({ case: 'other-denial-stays-blocked', status: denial.status, code: denial.code, publicContextRequests: cfg.requests.length, noBootstrap: true })
    await context.close()
  }
  {
    const { page, context, cfg } = await start({}, 320, '/')
    await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor()
    await publicOnly(page, cfg)
    emit({ case: 'home-denial-unchanged', publicRequestsOnly: true }); await context.close()
  }
  {
    const { page, context, cfg } = await start({ status: 502, code: 'UPSTREAM_UNAVAILABLE' })
    await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor()
    cfg.status = 403; cfg.code = 'CONTEXT_REVOKED'
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
    await page.getByRole('heading', { name: 'Esta página no existe', exact: true }).waitFor()
    assert.deepEqual((await page.evaluate(() => window.publicProof.state())).failure, { status: 403, code: 'CONTEXT_REVOKED' })
    cfg.status = 404; cfg.code = 'WHITE_LABEL_DISABLED'
    await page.evaluate(() => window.publicProof.refresh())
    await page.waitForFunction(() => window.publicProof.state().failure === null && window.publicProof.state().error === '')
    await page.getByRole('heading', { name: 'Esta página no existe', exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.publicProof.state())).bootstrap, false)
    emit({ case: 'retry-classifies-current-response-and-clears-legacy-error', requests: cfg.requests.length }); await context.close()
  }
  assert.deepEqual(errors, [])
  emit({ result: 'PASS', engine, cases: records.length - 1, pageErrors: errors.length, acceptance: 'actual composed UI with synthetic HTTP; real backend denial proof is separate' })
} catch (error) { console.error(error); console.error(JSON.stringify({ requests: current?.requests, unexpected: current?.unexpected, pageErrors: errors })); process.exitCode = 1 }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
