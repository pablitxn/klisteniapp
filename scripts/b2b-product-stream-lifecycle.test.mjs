import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { EventEmitter } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { ProductEventHub, serveProductEvents } from '../apps/b2b-api/src/product-events.ts'
import { createGateway } from './b2b-gateway.mjs'
import { createProductTestProxy } from './b2b-product-test-proxy.mjs'

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
const close = (server) =>
  new Promise((resolve) => {
    server.closeAllConnections()
    server.close(resolve)
  })
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return
    await delay(10)
  }
  assert.ok(check(), 'Disconnected downstream must release upstream streams within one second')
}
function open(port, path, actor = 'member', session = 'session') {
  return new Promise((resolve, reject) => {
    const client = http.get(
      { hostname: '127.0.0.1', port, path, headers: { 'x-actor': actor, 'x-session': session } },
      (response) => {
        let body = ''
        response.on('data', (chunk) => {
          body += chunk
          if (body.includes('event: ready'))
            resolve({ client, response, status: response.statusCode })
        })
        response.on('end', () => resolve({ client, response, status: response.statusCode }))
      },
    )
    client.on('error', reject)
  })
}
for (const mode of ['direct', 'gateway', 'white-label-proxy']) {
  test(
    `${mode} releases disconnected SSE slots across repeated transitions and preserves actor quota`,
    { timeout: 15000 },
    async () => {
      const db = Object.assign(new EventEmitter(), {
        query: async () => ({ rows: [{ schema: 'synthetic' }] }),
        release() {},
      })
      const hub = new ProductEventHub({ connect: async () => db })
      const responses = new Set(),
        clients = []
      const api = http.createServer((req, res) => {
        responses.add(res)
        res.once('close', () => responses.delete(res))
        void serveProductEvents(
          hub,
          req,
          res,
          {
            actorId: req.headers['x-actor'],
            organizationId: 'gym',
            sessionId: req.headers['x-session'],
          },
          async () => {},
        ).catch((error) => {
          if (!res.destroyed) {
            res.writeHead(error.status ?? 500)
            res.end(JSON.stringify({ code: error.code }))
          }
        })
      })
      const servers = [api]
      try {
        let port = await listen(api),
          path = '/api/b2b/orgs/gym/product/v2/events'
        if (mode !== 'direct') {
          const gateway = createGateway({
            apiPort: port,
            whiteLabel: mode === 'white-label-proxy',
            domainProtocol: 'http',
            proxySecret: 'synthetic-proxy-secret-for-stream-tests-123456',
          })
          servers.push(gateway)
          port = await listen(gateway)
        }
        if (mode === 'white-label-proxy') {
          const proxy = createProductTestProxy(port, 'http')
          servers.push(proxy)
          port = await listen(proxy)
          path = 'http://atlas.b2b.test' + path
        }
        for (let i = 0; i < 16; i++) {
          const stream = await open(port, path, 'member', `transition-${i}`)
          assert.equal(stream.status, 200)
          stream.client.destroy()
          await until(() => responses.size === 0)
        }
        for (let i = 0; i < 8; i++) {
          const stream = await open(port, path, 'member', `tab-${i}`)
          assert.equal(stream.status, 200)
          clients.push(stream.client)
        }
        const limited = await open(port, path, 'member', 'ninth')
        assert.equal(limited.status, 429)
        limited.client.destroy()
        const other = await open(port, path, 'another-member')
        assert.equal(other.status, 200)
        clients.push(other.client)
        await delay(30)
        assert.equal(
          responses.size,
          9,
          'Healthy streams remain open; no transport lease hides leaks',
        )
        clients.splice(0).forEach((client) => client.destroy())
        await until(() => responses.size === 0)
        const reopened = await open(port, path)
        assert.equal(reopened.status, 200)
        reopened.client.destroy()
        await until(() => responses.size === 0)
      } finally {
        clients.forEach((client) => client.destroy())
        hub.close()
        for (const server of servers.reverse()) await close(server)
      }
    },
  )
}

test('disconnect during authentication cannot subscribe after the response has already closed', async () => {
  let release,
    entered = false,
    connections = 0
  const barrier = new Promise((resolve) => {
    release = resolve
  })
  const db = Object.assign(new EventEmitter(), {
    query: async () => ({ rows: [{ schema: 'synthetic' }] }),
    release() {},
  })
  const hub = new ProductEventHub({
    connect: async () => {
      connections++
      return db
    },
  })
  let done
  const completed = new Promise((resolve) => {
    done = resolve
  })
  const api = http.createServer(async (req, res) => {
    entered = true
    await barrier
    try {
      await serveProductEvents(
        hub,
        req,
        res,
        { actorId: 'member', organizationId: 'gym', sessionId: 'session' },
        async () => {},
      )
    } finally {
      done()
    }
  })
  try {
    const port = await listen(api)
    const client = http.get({ hostname: '127.0.0.1', port })
    client.on('error', () => {})
    await until(() => entered)
    client.destroy()
    await delay(30)
    release()
    await completed
    assert.equal(connections, 0)
  } finally {
    release()
    hub.close()
    await close(api)
  }
})
