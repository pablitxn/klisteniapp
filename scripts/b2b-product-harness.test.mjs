import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { productHarnessConfig } from '../apps/b2c-web/playwright.b2b-product-support.ts'
import {
  productHarnessLayout,
  productHarnessModes,
  requireProductTestDatabase,
} from './b2b-product-harness-settings.ts'
import { createProductTestProxy } from './b2b-product-test-proxy.mjs'

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
const close = (server) =>
  new Promise((resolve) => {
    server.closeAllConnections()
    server.close(resolve)
  })
function request(port, path) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path }, (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (part) => {
          body += part
        })
        response.on('end', () => resolve({ status: response.statusCode, body }))
      })
      .on('error', reject)
  })
}

test('product harness rejects external, ambiguous and unrestricted database connections', () => {
  for (const source of [
    undefined,
    '',
    'https://127.0.0.1/b2b_test',
    'postgresql://db.example.test/b2b_test',
    'postgresql://127.0.0.1/production',
    'postgresql://127.0.0.1/b2b_test?options=x',
    'postgresql://127.0.0.1/b2b_test?host=external',
    'postgresql://127.0.0.1/b2b_test#fragment',
  ])
    assert.throws(() => requireProductTestDatabase(source))
  assert.equal(
    requireProductTestDatabase('postgresql://127.0.0.1/klisteni_b2b_test').hostname,
    '127.0.0.1',
  )
  assert.throws(() => productHarnessLayout('other'))
  assert.throws(() => productHarnessLayout('unified-http', -1))
})

test('each mode isolates six sandboxed browser projects and preserves TLS verification', () => {
  const ports = new Set()
  for (const mode of productHarnessModes) {
    const layout = productHarnessLayout(mode)
    const config = productHarnessConfig(mode)
    assert.equal(config.testMatch, 'b2b-product-*.spec.ts')
    assert.equal(config.workers, 1)
    assert.equal(config.fullyParallel, false)
    assert.equal(config.retries, 0)
    assert.equal(config.use.ignoreHTTPSErrors, false)
    assert.equal(config.use.trace, 'retain-on-failure')
    assert.equal(config.projects.length, 6)
    for (const [i, project] of config.projects.entries()) {
      const target = layout.projects[i],
        metadata = project.metadata.b2bProduct
      assert.deepEqual(metadata, {
        mode,
        engine: target.engine,
        width: target.width,
        height: target.height,
        touch: target.touch,
      })
      assert.equal(project.use.isMobile, target.touch)
      assert.equal(project.use.hasTouch, target.touch)
      assert.deepEqual(
        project.use.launchOptions,
        target.engine === 'chromium' ? { chromiumSandbox: true } : {},
      )
      assert.equal(project.metadata.fixtureIndex, i)
      assert.equal(project.metadata.fixtureControlPort, layout.controlPort)
      for (const port of [target.gatewayPort, target.apiPort, target.proxyPort]) {
        assert.equal(ports.has(port), false)
        ports.add(port)
      }
      if (mode !== 'unified-http')
        assert.equal(project.use.proxy.server, `http://127.0.0.1:${target.proxyPort}`)
    }
    assert.equal(config.webServer.reuseExistingServer, false)
    assert.equal(config.webServer.env.B2B_PRODUCT_MODE, mode)
  }
})

test('product evidence paths cannot traverse outside the temporary directory', () => {
  const original = process.env.B2B_PRODUCT_OUTPUT
  try {
    process.env.B2B_PRODUCT_OUTPUT = '/tmp/../workspace/not-evidence'
    assert.throws(() => productHarnessConfig('unified-http'), /under \/tmp/)
  } finally {
    if (original === undefined) delete process.env.B2B_PRODUCT_OUTPUT
    else process.env.B2B_PRODUCT_OUTPUT = original
  }
})

test('HTTP test proxy resolves only its fixed fictitious hosts to the loopback gateway', async () => {
  const upstream = http.createServer((request, response) =>
    response.end(`${request.headers.host}${request.url}`),
  )
  const proxy = createProductTestProxy(await listen(upstream), 'http')
  const port = await listen(proxy)
  try {
    assert.deepEqual(await request(port, 'http://atlas.b2b.test/a?b=1'), {
      status: 200,
      body: 'atlas.b2b.test/a?b=1',
    })
    for (const url of [
      'http://external.example/a',
      'http://127.0.0.1/a',
      'https://atlas.b2b.test/a',
      'http://user@atlas.b2b.test/a',
      'http://atlas.b2b.test:5432/a',
    ])
      assert.equal((await request(port, url)).status, 403)
  } finally {
    proxy.closeTunnels()
    await close(proxy)
    await close(upstream)
  }
})
