// Two browser origins, one TLS gateway/API/DB per engine. Never targets development data.
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import { createGateway } from './b2b-gateway.mjs'
import { createWhiteLabelTestProxy } from './b2b-wl-proxy.mjs'
import { whiteLabelTLS } from './b2b-wl-tls.mjs'
import { createAuth } from '../apps/b2b-api/src/auth.ts'
import { createPool } from '../apps/b2b-api/src/database.ts'
import { createApiServer } from '../apps/b2b-api/src/http.ts'
import { migrate } from '../apps/b2b-api/src/migrate.ts'
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
const environments = [],
  tls = whiteLabelTLS().tls
// Development HTTP is confined to WebKit's disposable schema and restricted proxy.
const webkitHTTP = process.env.TRAINER_WEBKIT_HTTP === '1'
mkdirSync(new URL('../.cache/trainer/', import.meta.url), { recursive: true })
const fixtureMap = {}
const readiness = http.createServer((_request, response) => {
  response.end('trainer QA ready')
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
      throw new Error('White-label browser environment cleanup failed.')
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
  for (const [index, proxyPort] of [4362, 4364, 4366, 4368].entries()) {
    const protocol = index === 3 && webkitHTTP ? 'http' : 'https'
    const gatewayPort = 4462 + index * 2,
      apiPort = gatewayPort + 1
    const environment = {
      schema: `b2b_trainer_browser_${randomUUID().replaceAll('-', '')}`,
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
      origin: protocol === 'http' ? `http://localhost:${gatewayPort}` : 'https://atlas.b2b.test',
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
    // HTTPS uses Secure cookies; the explicit loopback HTTP fixture uses development cookies.
    await seedWhiteLabelDemo(
      pool,
      auth,
      { ...config, production: false },
      'browser-tests-only-password-2026',
    )
    await pool.query(`INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role)
      SELECT 'atlas-demo','atlas-demo-norte',id,r.role FROM b2b_auth_user
      CROSS JOIN (VALUES ('coach')) AS r(role)
      WHERE email='coach@atlas.example.test' ON CONFLICT DO NOTHING`)
    if (protocol === 'http') {
      await pool.query(
        "UPDATE b2b_domain SET host=CASE WHEN host='atlas.b2b.test' THEN $1 WHEN host='sur.b2b.test' THEN $2 ELSE host END",
        [`localhost:${gatewayPort}`, `127.0.0.1:${gatewayPort}`],
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
      ...(protocol === 'https' ? { tls } : {}),
    }))
    await listen(gateway, gatewayPort)
    if (protocol === 'https') {
      const proxy = (environment.proxy = createWhiteLabelTestProxy(gatewayPort))
      await listen(proxy, proxyPort)
    }
    console.info(`Trainer QA ${protocol} environment ready via loopback proxy ${proxyPort}.`)
  }
  await listen(readiness, 4360)
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message.replaceAll(source, '[test database]')
      : 'White-label browser environment failed',
  )
  process.exitCode = 1
  await close()
}
