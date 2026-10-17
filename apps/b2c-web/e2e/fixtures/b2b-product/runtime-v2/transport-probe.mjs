/** Synthetic HTTP transport only; deliberately not a B2B DTO or feature test. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { chromium, webkit, expect } from '@playwright/test'

const require = createRequire(import.meta.url)
const engine = process.argv[2]
assert.ok(['chromium', 'webkit'].includes(engine))
assert.equal(require('@playwright/test/package.json').version, '1.63.0')
assert.equal(require('playwright/package.json').version, '1.63.0')
assert.equal(require('playwright-core/package.json').version, '1.63.0')
assert.ok(Number(process.versions.node.split('.')[0]) >= 24)
assert.equal(process.getuid(), 1001)
const ownStatus = readFileSync('/proc/self/status', 'utf8')
assert.match(ownStatus, /^CapEff:\s+0+$/m)
assert.match(ownStatus, /^NoNewPrivs:\s+1$/m)

const sessions = new Map()
const blob = Buffer.from('synthetic-transport-bytes')
const counts = {}
let origin
function json(response, status, data, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers })
  response.end(JSON.stringify(data))
}
async function body(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 4096) throw new Error('Synthetic body bound')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
const html = `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WP12 synthetic transport</title><style>*{box-sizing:border-box}body{margin:12px;font:16px sans-serif}input,button{max-width:100%;min-height:44px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>WP12 synthetic transport</h1><button id="login">Open synthetic owner session</button><p id="status" role="status">Signed out</p><label>Transport value <input id="value"></label><button id="write">Send synthetic value</button><pre id="result"></pre><script>
const status = document.querySelector('#status');
document.querySelector('#login').onclick = async () => {
  const response = await fetch('/auth/session', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({actor:'synthetic-owner'}) });
  status.textContent = response.ok ? 'Synthetic owner session ready' : 'Session failed';
};
document.querySelector('#write').onclick = async () => {
  const response = await fetch('/transport/state', { method:'POST', headers:{'Content-Type':'application/json','X-WP12-Key':'initial-ui'}, body:JSON.stringify({value:document.querySelector('#value').value}) });
  document.querySelector('#result').textContent = JSON.stringify(await response.json());
};
</script></html>`
const server = createServer(async (request, response) => {
  const path = request.url
  const method = request.method
  counts[method] = (counts[method] ?? 0) + 1
  try {
    if (request.headers.host !== new URL(origin).host) return json(response, 403, { error: 'wrong-host' })
    if (!['GET', 'HEAD'].includes(method) && request.headers.origin !== origin) {
      return json(response, 403, { error: 'wrong-origin' })
    }
    if (path === '/' && method === 'GET') {
      response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' })
      return response.end(html)
    }
    if (path === '/auth/session' && method === 'POST') {
      if ((await body(request)).actor !== 'synthetic-owner') return json(response, 403, { error: 'unknown-synthetic-actor' })
      const session = randomUUID()
      sessions.set(session, { state: null, operations: new Map(), writes: 0 })
      return json(response, 200, { actor: 'synthetic-owner' }, {
        'set-cookie': `wp12_synthetic=${session}; HttpOnly; SameSite=Strict; Path=/`,
      })
    }
    const token = /(?:^|;\s*)wp12_synthetic=([^;]+)/.exec(request.headers.cookie ?? '')?.[1]
    const session = sessions.get(token)
    if (!session) return json(response, 401, { error: 'no-synthetic-session' })
    if (path === '/transport/blob' && method === 'GET') {
      if (request.headers.range === 'bytes=0-8') {
        response.writeHead(206, { 'content-type': 'application/octet-stream', 'content-range': `bytes 0-8/${blob.length}`, 'accept-ranges': 'bytes' })
        return response.end(blob.subarray(0, 9))
      }
      response.writeHead(200, { 'content-type': 'application/octet-stream' })
      return response.end(blob)
    }
    if (path !== '/transport/state') return json(response, 404, { error: 'unregistered-synthetic-path' })
    if (method === 'HEAD') {
      response.writeHead(session.state ? 200 : 404, { 'x-wp12-revision': String(session.state?.revision ?? 0), 'cache-control': 'no-store' })
      return response.end()
    }
    if (method === 'GET') return json(response, session.state ? 200 : 404, { state: session.state, writes: session.writes })
    if (method === 'POST') {
      const value = await body(request)
      const key = request.headers['x-wp12-key']
      if (typeof key !== 'string' || !key || typeof value.value !== 'string') return json(response, 400, { error: 'synthetic-input' })
      const hash = createHash('sha256').update(JSON.stringify(value)).digest('hex')
      const previous = session.operations.get(key)
      if (previous) return json(response, previous.hash === hash ? 200 : 409, previous.hash === hash ? previous.result : { error: 'changed-key-payload' })
      session.state = { value: value.value, revision: (session.state?.revision ?? 0) + 1 }
      session.writes++
      const result = { state: { ...session.state }, host: request.headers.host, origin: request.headers.origin }
      session.operations.set(key, { hash, result })
      return json(response, 200, result)
    }
    if (method === 'PATCH') {
      const value = await body(request)
      if (!session.state || value.expected !== session.state.revision) return json(response, 409, { error: 'synthetic-revision-conflict' })
      session.state = { value: value.value, revision: session.state.revision + 1 }
      session.writes++
      return json(response, 200, { state: session.state })
    }
    if (method === 'DELETE') {
      const value = await body(request)
      if (!session.state || value.expected !== session.state.revision) return json(response, 409, { error: 'synthetic-revision-conflict' })
      session.state = null
      response.writeHead(204)
      return response.end()
    }
    return json(response, 405, { error: 'unregistered-synthetic-method' })
  } catch {
    json(response, 400, { error: 'invalid-synthetic-body' })
  }
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
origin = `http://127.0.0.1:${server.address().port}`
let browser
const results = []
try {
  browser = await ({ chromium, webkit }[engine]).launch({ headless: true, chromiumSandbox: true })
  const version = browser.version()
  assert.equal(version, engine === 'chromium' ? '153.0.8010.12' : '26.6')
  const commandLines = execFileSync('ps', ['-eo', 'args='], { encoding: 'utf8' }).split('\n')
    .filter((line) => line.includes('/ms-playwright/') && /(?:chrome|MiniBrowser)/.test(line))
  assert.ok(commandLines.length, 'Observe the launched official browser processes')
  if (engine === 'chromium') assert.ok(commandLines.every((line) => !line.includes('--no-sandbox')))
  for (const viewport of [{ width: 320, height: 740 }, { width: 430, height: 932 }, { width: 1440, height: 1000 }]) {
    const mobile = viewport.width !== 1440
    const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, ignoreHTTPSErrors: false })
    const page = await context.newPage()
    const checks = []
    const request = (method, value, key) => page.evaluate(async ({ method, value, key }) => {
      const response = await fetch('/transport/state', {
        method, headers: { 'Content-Type': 'application/json', ...(key ? { 'X-WP12-Key': key } : {}) },
        ...(value === undefined ? {} : { body: JSON.stringify(value) }),
      })
      return { status: response.status, data: response.status === 204 ? null : await response.json() }
    }, { method, value, key })
    try {
      await page.goto(origin)
      await expect(page.getByRole('heading', { name: 'WP12 synthetic transport' })).toBeVisible()
      assert.equal((await request('GET')).status, 401)
      await page.getByRole('button', { name: 'Open synthetic owner session' }).click()
      await expect(page.getByRole('status')).toHaveText('Synthetic owner session ready')
      const cookie = (await context.cookies()).find((cookie) => cookie.name === 'wp12_synthetic')
      assert.ok(cookie.httpOnly && cookie.sameSite === 'Strict' && !cookie.secure)
      checks.push('GET-401/session-POST/HttpOnly-same-origin-cookie')
      await page.getByLabel('Transport value').fill(`synthetic-${engine}-${viewport.width}`)
      await page.getByRole('button', { name: 'Send synthetic value' }).click()
      await expect(page.locator('#result')).toContainText(`synthetic-${engine}-${viewport.width}`)
      const initial = JSON.parse(await page.locator('#result').textContent())
      assert.equal(initial.state.revision, 1)
      assert.equal(initial.origin, origin)
      assert.equal(initial.host, new URL(origin).host)
      checks.push('frontend-POST/body/host/origin/response')
      await context.setOffline(true)
      await assert.rejects(request('POST', { value: 'pending' }, 'pending'))
      await context.setOffline(false)
      assert.equal((await request('GET')).data.writes, 1)
      checks.push('offline-failure/reconnect-no-phantom-write')
      await page.route('**/transport/state', async (route) => {
        assert.equal((await route.fetch()).status(), 200)
        await route.abort('failed')
      }, { times: 1 })
      await assert.rejects(request('POST', { value: 'lost-ack' }, 'lost-ack'))
      const replay = await request('POST', { value: 'lost-ack' }, 'lost-ack')
      assert.equal(replay.status, 200)
      assert.equal(replay.data.state.revision, 2)
      assert.equal((await request('GET')).data.writes, 2)
      assert.equal((await request('POST', { value: 'changed' }, 'lost-ack')).status, 409)
      checks.push('accepted-POST/lost-response/exact-replay/changed-payload-409')
      const second = await context.newPage()
      await second.goto(origin)
      const competing = second.evaluate(async () => {
        const response = await fetch('/transport/state', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected: 2, value: 'tab-two' }) })
        return response.status
      })
      const race = await Promise.all([request('PATCH', { expected: 2, value: 'tab-one' }), competing])
      assert.deepEqual([race[0].status, race[1]].sort(), [200, 409])
      assert.equal((await request('GET')).data.writes, 3)
      assert.equal((await request('POST', { value: 'lost-ack' }, 'lost-ack')).data.state.revision, 2)
      checks.push('two-tab-PATCH/one-accept-one-409/old-receipt-stable')
      const head = await page.evaluate(async () => {
        const response = await fetch('/transport/state', { method: 'HEAD' })
        return { status: response.status, body: await response.text(), revision: response.headers.get('x-wp12-revision') }
      })
      assert.deepEqual(head, { status: 200, body: '', revision: '3' })
      const range = await page.evaluate(async () => {
        const response = await fetch('/transport/blob', { headers: { Range: 'bytes=0-8' } })
        return { status: response.status, body: await response.text(), range: response.headers.get('content-range') }
      })
      assert.deepEqual(range, { status: 206, body: 'synthetic', range: `bytes 0-8/${blob.length}` })
      checks.push('HEAD/no-body/custom-header/binary-Range-206')
      const denied = await context.request.patch(`${origin}/transport/state`, { headers: { Origin: 'http://foreign.example.test' }, data: { expected: 3, value: 'foreign' } })
      assert.equal(denied.status(), 403)
      assert.equal((await request('GET')).data.writes, 3)
      assert.equal((await request('DELETE', { expected: 3 })).status, 204)
      assert.equal((await request('GET')).status, 404)
      checks.push('foreign-Origin-403/no-write/DELETE-204/GET-404')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      results.push({ engine, version, viewport, touch: mobile, status: 'passed', checks })
    } finally {
      await context.close()
    }
  }
  console.log(JSON.stringify({
    scope: 'matching-runtime-and-synthetic-full-stack-HTTP-only', playwright: '1.63.0',
    node: process.version, uid: process.getuid(), capabilitiesEffective: '0', noNewPrivileges: true,
    chromiumSandbox: engine === 'chromium', noSandboxArgument: false,
    serverBinding: '127.0.0.1:ephemeral', externalNetworking: 'disabled-by-container',
    ignoreHTTPSErrors: false, transport: 'HTTP-loopback-inside-container', methodsObserved: counts,
    passed: results.length, failed: 0, skipped: 0, results,
    productAcceptanceExecuted: 0, trustedHttpsAcceptanceExecuted: 0,
  }))
} finally {
  await browser?.close()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
