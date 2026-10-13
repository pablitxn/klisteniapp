// Integration fixture: HTTP forwarded ONLY through restricted loopback proxies.
// No TLS exceptions, certificates or machine/browser trust modifications.
// Two browser origins, one HTTP gateway/API/DB per profile. Never targets development data.
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import net from 'node:net'
import { createGateway } from './b2b-gateway.mjs'
import { createWhiteLabelTestProxy } from './b2b-wl-proxy.mjs'
import { createAuth } from '../apps/b2b-api/src/auth.ts'
import { createPool } from '../apps/b2b-api/src/database.ts'
import { createApiServer } from '../apps/b2b-api/src/http.ts'
import { migrate } from '../apps/b2b-api/src/migrate.ts'
import { anonymousFixtures } from './qa-b2b-anonymous-fixtures.mjs'
import { seedWhiteLabelDemo } from '../apps/b2b-api/src/white-label-demo.ts'

const requireApi = createRequire(new URL('../apps/b2b-api/package.json', import.meta.url))
const { Pool } = requireApi('pg')
const source = process.env.B2B_TEST_DATABASE_URL
if (!source) throw new Error('Set B2B_TEST_DATABASE_URL to a dedicated disposable database.')
const sourceUrl = new URL(source)
if (
  !/^postgres(?:ql)?:$/.test(sourceUrl.protocol) ||
  !/(?:b2b.*test|test.*b2b)/i.test(decodeURIComponent(sourceUrl.pathname)) ||
  sourceUrl.searchParams.has('options')
)
  throw new Error(
    'Refusing white-label tests: dedicated b2b/test database without connection options required.',
  )
const owner = new Pool({ connectionString: source })
const environments = []
const fixtureMap = {}
mkdirSync(new URL('../.cache/trainer/', import.meta.url), { recursive: true })
const readiness = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1')
    const environment = environments[Number(url.searchParams.get('project') ?? 0)]
    if (url.pathname === '/fixture' && request.method === 'POST') {
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify(await environment.fixtures.apply(url.searchParams.get('case') ?? 'normal')),
      )
    } else if (url.pathname === '/state') {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify(await environment.fixtures.state()))
    } else response.end('integration HTTP QA ready')
  } catch {
    response.writeHead(500)
    response.end('QA fixture failed')
  }
})
let closing
async function close() {
  if (closing) return closing
  closing = (async () => {
    readiness.closeAllConnections()
    if (readiness.listening) await new Promise((resolve) => readiness.close(resolve))
    const results = await Promise.allSettled(
      environments.map(async (environment) => {
        try {
          environment.proxy?.closeTunnels()
          for (const listener of [environment.proxy, environment.gateway, environment.server]) {
            if (listener?.listening) {
              listener.closeAllConnections()
              await new Promise((resolve) => listener.close(resolve))
            }
          }
          await environment.pool?.end()
        } finally {
          try {
            if (environment.created)
              await owner.query(`DROP SCHEMA IF EXISTS ${environment.schema} CASCADE`)
          } finally {
            rmSync(environment.mediaRoot, { recursive: true, force: true })
          }
        }
      }),
    )
    await owner.end()
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('Integration browser environment cleanup failed.')
  })()
  return closing
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void close().catch(() => {
      process.exitCode = 1
    })
  })
async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
}
try {
  for (const [index, proxyPort] of [4342, 4344, 4346, 4350, 4352, 4354].entries()) {
    const protocol = 'http'
    const gatewayPort = 4542 + index * 2,
      apiPort = gatewayPort + 1
    const environment = {
      schema: `${process.env.QA_INTEGRATION_ROLE === 'trainer' ? 'b2b_trainer_browser' : 'b2b_wl_browser'}_${randomUUID().replaceAll('-', '')}`,
      mediaRoot: mkdtempSync(join(tmpdir(), 'klisteni-wl-browser-')),
      created: false,
    }
    environments.push(environment)
    await owner.query(`CREATE SCHEMA ${environment.schema}`)
    environment.created = true
    const url = new URL(sourceUrl)
    url.searchParams.set('options', `-c search_path=${environment.schema}`)
    const proxySecret = randomBytes(40).toString('hex')
    const config = {
      databaseUrl: url.href,
      secret: randomBytes(40).toString('hex'),
      origin: `${protocol}://atlas.b2b.test`,
      host: '127.0.0.1',
      port: apiPort,
      production: protocol === 'https',
      demoMode: true,
      mediaRoot: environment.mediaRoot,
      mediaQuotaMb: 32,
      whiteLabel: true,
      proxySecret,
      trustedProxyAddresses: ['127.0.0.1'],
      domainProtocol: protocol,
    }
    const pool = (environment.pool = createPool(config))
    await migrate(pool, createAuth(pool, config, { migrating: true }))
    const auth = createAuth(pool, config)
    // Seeding is explicitly synthetic. HTTP uses development cookie semantics; Secure is unverified.
    const fixture = await seedWhiteLabelDemo(
      pool,
      auth,
      { ...config, production: false },
      'browser-tests-only-password-2026',
    )
    if (process.env.QA_INTEGRATION_ROLE === 'anonymous')
      environment.fixtures = await anonymousFixtures(pool, environment.mediaRoot, fixture)
    if (process.env.QA_INTEGRATION_ROLE === 'trainer') {
      await pool.query(
        `INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) SELECT 'atlas-demo','atlas-demo-norte',id,'coach' FROM b2b_auth_user WHERE email='coach@atlas.example.test' ON CONFLICT DO NOTHING`,
      )
    }
    fixtureMap[proxyPort] = environment.schema
    writeFileSync(
      new URL('../.cache/trainer/fixture-map.json', import.meta.url),
      JSON.stringify(fixtureMap),
    )
    await pool.query(`INSERT INTO b2b_domain(host,organization_id,status,primary_domain,verified_at,dns_verified_at,tls_verified_at,tls_expires_at,verification_evidence)
      VALUES('alias.b2b.test','atlas-demo','active',false,now(),now(),now(),now()+interval '1 day','isolated alias fixture only')`)
    const server = (environment.server = createApiServer({ config, pool, auth }))
    await listen(server, apiPort)
    const gateway = (environment.gateway = createGateway({
      apiPort,
      built: true,
      whiteLabel: true,
      proxySecret,
      domainProtocol: protocol,
    }))
    await listen(gateway, gatewayPort)
    const proxy = (environment.proxy = createWhiteLabelTestProxy(gatewayPort))
    if (protocol === 'http') {
      // Playwright APIRequestContext uses CONNECT even for plain HTTP fetches.
      // Resolve only these fictitious hosts on port 80 to the fixed loopback gateway.
      const tunnels = new Set()
      proxy.removeAllListeners('connect')
      proxy.closeTunnels = () => {
        for (const socket of tunnels) socket.destroy()
      }
      proxy.on('connect', (request, client, head) => {
        if (!/^(?:atlas|sur|alias|unknown)\.b2b\.test:80$/.test(request.url ?? '')) {
          client.end('HTTP/1.1 403 Forbidden\r\n\r\n')
          return
        }
        const upstream = net.connect(gatewayPort, '127.0.0.1', () => {
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
          if (head.length) upstream.write(head)
          client.pipe(upstream).pipe(client)
        })
        tunnels.add(client)
        tunnels.add(upstream)
        client.on('close', () => {
          tunnels.delete(client)
          upstream.destroy()
        })
        upstream.on('close', () => {
          tunnels.delete(upstream)
          client.destroy()
        })
        client.on('error', () => upstream.destroy())
        upstream.on('error', () => client.destroy())
      })
      proxy.removeAllListeners('request')
      proxy.on('request', (request, response) => {
        let target
        try {
          target = new URL(request.url)
        } catch {
          response.writeHead(403)
          response.end()
          return
        }
        if (
          target.protocol !== 'http:' ||
          target.username ||
          target.password ||
          !/^(?:atlas|sur|alias|unknown)\.b2b\.test$/.test(target.host)
        ) {
          response.writeHead(403)
          response.end()
          return
        }
        const upstream = http.request(
          {
            host: '127.0.0.1',
            port: gatewayPort,
            path: target.pathname + target.search,
            method: request.method,
            headers: { ...request.headers, host: target.host },
          },
          (result) => {
            response.writeHead(result.statusCode, result.headers)
            result.pipe(response)
          },
        )
        upstream.on('error', () => {
          response.writeHead(502)
          response.end()
        })
        request.pipe(upstream)
      })
    }
    await listen(proxy, proxyPort)
    console.info(`Integration HTTP environment ready via loopback proxy ${proxyPort}.`)
  }
  await listen(readiness, 4348)
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message.replaceAll(source, '[test database]')
      : 'Integration browser environment failed',
  )
  process.exitCode = 1
  await close()
}
