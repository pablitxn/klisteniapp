import { createServer } from 'node:http'
import { readFile, readdir, stat, mkdtemp, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { resolve, dirname, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ProductBootstrapSchema,
  ProductEndpoints,
} from '../../../../packages/b2b-contracts/src/product-v2.ts'

// This server owns no database and accepts only fixture credentials. It serves
// the real production build and validates synthetic responses with its contracts.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const app = resolve(root, 'apps/b2b-web')
let temporaryBuild
const dist = process.env.B2B_WORKSPACE_LOADING_DIST
  ? resolve(process.env.B2B_WORKSPACE_LOADING_DIST)
  : resolve((temporaryBuild = await mkdtemp(resolve(tmpdir(), 'klisteni-workspace-loading-'))), 'dist')
if (!process.env.B2B_WORKSPACE_LOADING_DIST) {
  const built = spawnSync(process.execPath, [resolve(app, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist], {
    cwd: app,
    stdio: 'inherit',
    env: { ...process.env, VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_HOST_URL: '', VITE_UMAMI_WEBSITE_ID: '' },
  })
  if (built.status !== 0) process.exit(built.status ?? 1)
}
await stat(resolve(dist, 'index.html'))
const productionChunks = (await readdir(resolve(dist, 'assets'))).filter((file) => file.endsWith('.js'))
const user = { id: 'fixture-user', name: 'Synthetic Browser User', email: 'loading@example.test' }
const choices = [
  { branchId: 'branch-a', name: 'Synthetic North', role: 'admin' },
  { branchId: 'branch-b', name: 'Synthetic South', role: 'coach' },
]
const fixtures = new Map()
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
function json(response, status, value, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers })
  response.end(JSON.stringify(value))
}
async function body(request) {
  let text = ''
  for await (const part of request) text += part
  return text ? JSON.parse(text) : {}
}
function bootstrap(fixture) {
  return ProductBootstrapSchema.parse({
    schemaVersion: 2, user, realm: { mode: 'unified', key: 'synthetic-loading' },
    memberships: [{ organizationId: 'org-fixture', name: 'Synthetic Loading Gym', role: 'admin', activated: true,
      accessMode: fixture.inactive ? 'export-only' : 'active', accessRevision: 1,
      choices: fixture.inactive ? [] : choices }],
  })
}
function access(fixture, request) {
  const role = request.headers['x-klisteni-b2b-role'] || 'member'
  const branchId = request.headers['x-klisteni-b2b-branch']
  return {
    schemaVersion: 2, organizationId: 'org-fixture', userId: user.id,
    role, accessMode: fixture.inactive ? 'export-only' : 'active', accessRevision: 1,
    branches: branchId ? [{ branchId, role: role === 'coach' ? 'coach' : 'member' }] : [],
    capabilities: fixture.inactive ? ['export-own-records'] : role === 'admin'
      ? ['manage-people', 'edit-planning', 'read-training-history', 'manage-own-health', 'export-own-records']
      : ['read-training-history', 'read-consented-health', 'manage-own-health', 'export-own-records'],
  }
}
async function handle(request, response) {
  const url = new URL(request.url, 'http://fixture.local')
  const id = /(?:^|; )loading_fixture=([^;]+)/.exec(request.headers.cookie ?? '')?.[1]
  const fixture = fixtures.get(id)
  if (url.pathname === '/__fixture/ready') return json(response, 200, { ready: true, kind: 'synthetic-built-app' })
  if (url.pathname === '/__fixture/chunks') return json(response, 200, { kind: 'production-build-assets', files: productionChunks })
  if (url.pathname === '/__fixture/scenario' && request.method === 'POST') {
    const scenario = await body(request)
    const key = randomUUID()
    fixtures.set(key, { ...scenario, authenticated: false, events: [], streams: new Set() })
    return json(response, 200, { synthetic: true }, { 'Set-Cookie': `loading_fixture=${key}; Path=/; HttpOnly; SameSite=Strict` })
  }
  if (url.pathname === '/__fixture/events') return json(response, 200, fixture?.events ?? [])
  if (url.pathname === '/__fixture/revoke-consent' && request.method === 'POST' && fixture) {
    fixture.consentDenied = true
    for (const stream of fixture.streams) stream.write('event: invalidate\ndata: {}\n\n')
    return json(response, 200, { revoked: true })
  }
  if (url.pathname.startsWith('/api/b2b')) {
    if (!fixture) return json(response, 400, { error: 'Synthetic scenario not initialized', code: 'INVALID_INPUT' })
    const entry = { path: url.pathname, query: url.search, method: request.method, branch: request.headers['x-klisteni-b2b-branch'] ?? '', role: request.headers['x-klisteni-b2b-role'] ?? '', receivedAt: Date.now() }
    fixture.events.push(entry)
    response.on('finish', () => { entry.finishedAt = Date.now(); entry.status = response.statusCode })
    response.on('close', () => { entry.closedAt = Date.now() })
    if (url.pathname === '/api/b2b/context') return json(response, 404, { error: 'Unified synthetic host', code: 'WHITE_LABEL_DISABLED' })
    if (url.pathname === '/api/b2b/auth/sign-in/email') {
      const input = await body(request)
      if (input.email !== user.email || input.password !== 'synthetic-password') return json(response, 401, { error: 'Fixture credentials required' })
      fixture.authenticated = true
      return json(response, 200, { redirect: false, token: 'synthetic-not-a-real-token', user })
    }
    if (!fixture.authenticated) return json(response, 401, { error: 'Iniciá sesión para continuar.', code: 'UNAUTHORIZED' })
    if (url.pathname === '/api/b2b/bootstrap/v2') return json(response, 200, bootstrap(fixture))
    if (url.pathname.endsWith('/product/v2/events')) {
      const shared = url.searchParams.has('memberId')
      if (shared && fixture.consentDenied) return json(response, 403, { error: 'Synthetic consent denied', code: 'CONSENT_REQUIRED' })
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' })
      response.write('event: ready\ndata: {}\n\n')
      if (shared) fixture.streams.add(response)
      const heartbeat = setInterval(() => response.write('event: heartbeat\ndata: {}\n\n'), 2000)
      response.on('close', () => { clearInterval(heartbeat); fixture.streams.delete(response) })
      return
    }
    const scoped = /^\/api\/b2b\/orgs\/org-fixture\/product\/v2\/(.*)$/.exec(url.pathname)?.[1]
    const output = (key, value) => json(response, 200, ProductEndpoints[key].output.parse(value))
    if (scoped === 'access') return output('access', access(fixture, request))
    if (scoped === 'capabilities') return output('capabilities', { schemaVersion: 2, minimumClientVersion: 2, activated: true, migration: '006-product-foundation' })
    if (scoped === 'history-subjects') return output('historySubjects', { schemaVersion: 2, scope: { organizationId: 'org-fixture', branchId: request.headers['x-klisteni-b2b-branch'] }, members: [{ userId: 'synthetic-member', name: 'Synthetic Consent Subject', active: true }] })
    if (['routines', 'catalog/exercises', 'routine-publications', 'invitation-branches'].includes(scoped)) {
      const key = { routines: 'routines', 'catalog/exercises': 'catalogExercises', 'routine-publications': 'routinePublications', 'invitation-branches': 'invitationBranches' }[scoped]
      return output(key, [])
    }
    if (scoped === 'people') return output('people', [{ schemaVersion: 2, userId: 'synthetic-member', name: 'SYNTHETIC NORTH ADMIN DATA', email: 'member@example.test', role: 'member', active: true, revision: 1, branchGrants: [{ branchId: 'branch-a', role: 'member', active: true }], coachIds: [] }])
    // Unknown routes are evidence failures, including any unplanned health read.
    entry.unmodeled = true
    return json(response, 501, { error: `Unmodeled synthetic endpoint: ${url.pathname}`, code: 'INVALID_INPUT' })
  }
  try {
    const pathname = decodeURIComponent(url.pathname)
    let file = resolve(dist, `.${pathname}`)
    if (!file.startsWith(dist + sep)) return json(response, 403, { error: 'Outside fixture build' })
    if (!(await stat(file).catch(() => null))?.isFile()) {
      if (pathname.startsWith('/assets/')) return json(response, 404, { error: 'Missing production asset' })
      file = resolve(dist, 'index.html')
    }
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(await readFile(file))
  } catch (error) {
    console.error(error)
    if (!response.headersSent) json(response, 500, { error: 'Synthetic server failure' })
    else response.destroy()
  }
}
const server = createServer((request, response) => {
  void handle(request, response).catch((error) => {
    console.error(error)
    if (!response.headersSent) json(response, 500, { error: 'Synthetic fixture contract failure' })
    else response.destroy()
  })
})
server.listen(Number(process.env.B2B_WORKSPACE_LOADING_PORT ?? 4298), '127.0.0.1')
async function close() {
  server.closeAllConnections()
  server.close()
  if (temporaryBuild) await rm(temporaryBuild, { recursive: true, force: true })
}
process.once('SIGTERM', close)
process.once('SIGINT', close)
