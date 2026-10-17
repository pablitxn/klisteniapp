import { createRequire } from 'node:module'
import { randomBytes, randomUUID, X509Certificate } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import http from 'node:http'
import { createGateway } from './b2b-gateway.mjs'
import { createProductTestProxy } from './b2b-product-test-proxy.mjs'
import { productHarnessLayout, requireProductTestDatabase } from './b2b-product-harness-settings.ts'
import { seedProductHarness } from './b2b-product-seed.mjs'
import { createPool } from '../apps/b2b-api/src/database.ts'
import { createAuth } from '../apps/b2b-api/src/auth.ts'
import { createApiServer } from '../apps/b2b-api/src/http.ts'
const requireApi = createRequire(new URL('../apps/b2b-api/package.json', import.meta.url))
const { Pool } = requireApi('pg')
async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
}
function existingTLS(mode, env) {
  if (mode !== 'white-label-https-valid-trust') return undefined
  if (!env.B2B_PRODUCT_TLS_CERT || !env.B2B_PRODUCT_TLS_KEY)
    throw new Error(
      'HTTPS blocked: supply existing task-owned trusted B2B_PRODUCT_TLS_CERT and B2B_PRODUCT_TLS_KEY; this harness does not generate certificates or change trust',
    )
  const cert = readFileSync(env.B2B_PRODUCT_TLS_CERT),
    key = readFileSync(env.B2B_PRODUCT_TLS_KEY)
  const parsed = new X509Certificate(cert)
  if (
    Date.parse(parsed.validFrom) > Date.now() ||
    Date.parse(parsed.validTo) < Date.now() + 300000 ||
    ['atlas', 'sur', 'alias', 'unknown'].some((name) => !parsed.checkHost(`${name}.b2b.test`))
  )
    throw new Error(
      'HTTPS blocked: existing certificate validity or fictitious-host coverage is insufficient',
    )
  return { cert, key }
}

/** Composition only. Feature activation is never enabled by this harness. */
export async function startProductHarness({
  source,
  mode,
  offset = 0,
  projectCount = 6,
  builtDirectory = fileURLToPath(new URL('../apps/b2b-web/dist', import.meta.url)),
  env = process.env,
  signal,
} = {}) {
  const sourceUrl = requireProductTestDatabase(source)
  const layout = productHarnessLayout(mode, offset)
  if (!Number.isInteger(projectCount) || projectCount < 1 || projectCount > 6)
    throw new Error('Invalid product harness project count')
  const tls = existingTLS(mode, env)
  if (!existsSync(join(builtDirectory, 'index.html')))
    throw new Error('Build the candidate B2B frontend before harness startup')
  const owner = new Pool({ connectionString: sourceUrl.href, connectionTimeoutMillis: 5000 })
  const runtimeRoot = mkdtempSync(join(tmpdir(), 'klisteni-b2b-product-'))
  const snapshotDirectory = join(runtimeRoot, 'build')
  const environments = [],
    fixtureMap = []
  let control, closing
  async function close() {
    if (closing) return closing
    closing = (async () => {
      if (control?.listening) {
        control.closeAllConnections()
        await new Promise((resolve) => control.close(resolve))
      }
      const results = await Promise.allSettled(
        environments.map(async (environment) => {
          try {
            environment.proxy?.closeTunnels()
            for (const server of [environment.proxy, environment.gateway, environment.server])
              if (server?.listening) {
                server.closeAllConnections()
                await new Promise((resolve) => server.close(resolve))
              }
            await environment.pool?.end()
          } finally {
            if (environment.created)
              await owner.query(`DROP SCHEMA IF EXISTS ${environment.schema} CASCADE`)
          }
        }),
      )
      await owner.end()
      rmSync(runtimeRoot, { recursive: true, force: true })
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Product harness cleanup failed')
    })()
    return closing
  }
  try {
    signal?.throwIfAborted()
    cpSync(builtDirectory, snapshotDirectory, { recursive: true })
    for (const project of layout.projects.slice(0, projectCount)) {
      signal?.throwIfAborted()
      const environment = {
        schema: `b2b_product_browser_${randomUUID().replaceAll('-', '')}`,
        created: false,
      }
      environments.push(environment)
      await owner.query(`CREATE SCHEMA ${environment.schema}`)
      environment.created = true
      const databaseUrl = new URL(sourceUrl)
      databaseUrl.searchParams.set('options', `-c search_path=${environment.schema}`)
      const mediaRoot = join(runtimeRoot, `media-${project.index}`)
      mkdirSync(mediaRoot)
      const protocol = tls ? 'https' : 'http',
        whiteLabel = mode !== 'unified-http'
      const proxySecret = randomBytes(40).toString('hex')
      const config = {
        databaseUrl: databaseUrl.href,
        secret: randomBytes(40).toString('hex'),
        origin: whiteLabel
          ? `${protocol}://atlas.b2b.test`
          : `http://127.0.0.1:${project.gatewayPort}`,
        host: '127.0.0.1',
        port: project.apiPort,
        production: Boolean(tls),
        demoMode: true,
        whiteLabel,
        proxySecret,
        trustedProxyAddresses: ['127.0.0.1'],
        domainProtocol: protocol,
        mediaRoot,
        mediaQuotaMb: 32,
      }
      environment.pool = createPool(config)
      const fixture = await seedProductHarness(
        environment.pool,
        config,
        `p${project.index}-${randomUUID().slice(0, 8)}`,
      )
      signal?.throwIfAborted()
      await environment.pool
        .query(`INSERT INTO b2b_domain(host,organization_id,status,primary_domain,verified_at,dns_verified_at,tls_verified_at,tls_expires_at,verification_evidence)
        VALUES('alias.b2b.test','atlas-demo','active',false,now(),now(),now(),now()+interval '1 day','synthetic product harness only')`)
      environment.server = createApiServer({
        config,
        pool: environment.pool,
        auth: createAuth(environment.pool, config),
      })
      await listen(environment.server, project.apiPort)
      environment.gateway = createGateway({
        apiPort: project.apiPort,
        built: true,
        builtDirectory: snapshotDirectory,
        whiteLabel,
        proxySecret,
        domainProtocol: protocol,
        tls,
      })
      await listen(environment.gateway, project.gatewayPort)
      if (whiteLabel) {
        environment.proxy = createProductTestProxy(project.gatewayPort, protocol)
        await listen(environment.proxy, project.proxyPort)
      }
      fixtureMap.push({
        ...fixture,
        project: { ...project, mode },
        baselineEntry: whiteLabel
          ? 'brand-scoped'
          : 'blocked-by-current-white-label-required-guard',
        schema: environment.schema,
      })
    }
    signal?.throwIfAborted()
    const mapPath = join(runtimeRoot, 'fixture-map.json')
    writeFileSync(mapPath, JSON.stringify({ mode, projects: fixtureMap }, null, 2), { mode: 0o600 })
    control = http.createServer((request, response) => {
      response.setHeader('cache-control', 'no-store')
      response.setHeader('x-content-type-options', 'nosniff')
      if (!['GET', 'HEAD'].includes(request.method ?? '') || request.headers.origin) {
        response.writeHead(403)
        response.end()
        return
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      let payload
      if (url.pathname === '/healthz')
        payload = { ready: true, mode, projects: fixtureMap.length, featuresActivated: false }
      else if (url.pathname === '/fixtures') {
        const index = Number(url.searchParams.get('project'))
        if (!url.searchParams.has('project') || !Number.isInteger(index) || !fixtureMap[index]) {
          response.writeHead(400)
          response.end()
          return
        }
        payload = fixtureMap[index]
      } else {
        response.writeHead(404)
        response.end()
        return
      }
      response.setHeader('content-type', 'application/json')
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify(payload))
    })
    await listen(control, layout.controlPort)
    return { layout, fixtures: fixtureMap, runtimeRoot, fixtureMapPath: mapPath, close }
  } catch (error) {
    await close()
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const abort = new AbortController()
  let harness
  const stop = () => {
    abort.abort(new Error('Product harness interrupted'))
    void harness?.close().catch(() => {
      process.exitCode = 1
    })
  }
  for (const name of ['SIGINT', 'SIGTERM']) process.once(name, stop)
  try {
    harness = await startProductHarness({
      source: process.env.B2B_TEST_DATABASE_URL,
      mode: process.env.B2B_PRODUCT_MODE,
      offset: Number(process.env.B2B_PRODUCT_PORT_OFFSET ?? 0),
      signal: abort.signal,
    })
    if (abort.signal.aborted) await harness.close()
    else
      console.info(
        `Product baseline harness ready: ${harness.fixtures.length} isolated projects; fixture map ${harness.fixtureMapPath}; features remain inactive.`,
      )
  } catch (error) {
    console.error(
      String(error instanceof Error ? error.message : error).replace(
        /postgres(?:ql)?:\/\/[^\s"']+/g,
        '[test database]',
      ),
    )
    process.exitCode = 1
  }
}
