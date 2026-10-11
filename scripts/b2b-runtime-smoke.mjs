import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from 'node:fs'
import { request as httpRequest, createServer as createHttpServer } from 'node:http'
import { Agent, createServer as createHttpsServer, request as httpsRequest } from 'node:https'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

// This command never accepts a database URL, existing Compose project or volume.
// All operational writes target randomly named, disposable local resources.
const root = fileURLToPath(new URL('..', import.meta.url))
const runId = `klisteni-b2b-smoke-${Date.now()}-${randomBytes(3).toString('hex')}`
const directory = resolve(root, '.cache/b2b/runtime', runId)
mkdirSync(directory, { recursive: true, mode: 0o700 })
const logPath = resolve(directory, 'diagnostics.private.log')
const reportPath = resolve(directory, 'report.json')
const apiImage = `${runId}-api:local`,
  webImage = `${runId}-web:local`
const projects = [],
  images = [],
  secrets = []
const checks = []
let stage = 'preflight',
  proxy,
  agent,
  targetPort
const cancellation = new AbortController()
let cleaning = false,
  diskMonitor
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => cancellation.abort())
const report = {
  startedAt: new Date().toISOString(),
  production: true,
  checks,
  images: {},
  success: false,
}

function secret() {
  const value = randomBytes(32).toString('hex')
  secrets.push(value)
  return value
}
function redact(value) {
  return secrets.reduce((text, item) => text.replaceAll(item, '[redacted]'), String(value))
}
function log(value) {
  // Diagnostics must never prevent cleanup, including a full filesystem.
  try {
    appendFileSync(logPath, `${redact(value)}\n`, { mode: 0o600 })
  } catch {
    report.diagnosticsIncomplete = true
  }
}
function step(name) {
  stage = name
  console.info(`[runtime] ${name}`)
}
function passed(name) {
  checks.push(name)
  console.info(`[runtime] PASS ${name}`)
}

async function run(binary, args, { input, env, allowFailure = false } = {}) {
  log(`$ ${binary} ${args.join(' ')}`)
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(cleaning ? {} : { signal: cancellation.signal }),
    })
    const stdout = [],
      stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    let childError
    child.on('error', (error) => {
      childError = error
    })
    child.on('close', (code) => {
      const output = Buffer.concat(stdout),
        errors = Buffer.concat(stderr)
      // Binary backup data never enters logs.
      if (errors.length) log(errors.toString())
      if ((code || childError) && !allowFailure) {
        log(output.toString())
        reject(childError ?? new Error(`${binary} exited with ${code}`))
      } else resolve({ code, output })
    })
    child.stdin.on('error', () => {})
    child.stdin.end(input)
  })
}
async function freePort() {
  const server = createHttpServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}
function project(name, port, common) {
  assert.match(name, /^klisteni-b2b-smoke-\d+-[a-f0-9]{6}(?:-restore)?$/)
  const env = { ...common, B2B_HTTP_PORT: String(port) }
  const envFile = resolve(directory, `${name}.env.private`)
  writeFileSync(
    envFile,
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
    { mode: 0o600 },
  )
  const overrideFile = resolve(directory, `${name}.compose.json`)
  writeFileSync(
    overrideFile,
    JSON.stringify({
      services: {
        migrate: { image: apiImage },
        'b2b-api': { image: apiImage },
        web: { image: webImage },
      },
    }),
    { mode: 0o600 },
  )
  const args = [
    'compose',
    '--project-name',
    name,
    '--env-file',
    envFile,
    '-f',
    'deploy/compose.b2b.instance.yaml',
    '-f',
    overrideFile,
  ]
  const value = {
    name,
    port,
    env,
    compose: (extra, options = {}) =>
      run('docker', [...args, ...extra], {
        ...options,
        env: { ...env, ...options.env },
      }),
  }
  projects.push(value)
  return value
}
async function waitFor(check, label, timeout = 60_000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    cancellation.signal.throwIfAborted()
    try {
      if (await check()) return
    } catch {
      /* Startup can refuse connections. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out: ${label}`)
}
function request(origin, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      new URL(path, origin),
      { method, headers, agent, timeout: 20_000, signal: cancellation.signal },
      (response) => {
        const chunks = []
        response.on('error', reject)
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            bytes: Buffer.concat(chunks),
            json() {
              return JSON.parse(this.bytes.toString())
            },
          }),
        )
      },
    )
    req.on('timeout', () => req.destroy(new Error('HTTP timeout')))
    req.on('error', reject)
    req.end(body)
  })
}
async function login(origin, credentials) {
  const response = await request(origin, '/api/b2b/auth/sign-in/email', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
  assert.equal(response.status, 200, 'production sign-in')
  const cookies = response.headers['set-cookie'] ?? []
  assert.ok(
    cookies.some(
      (value) =>
        /;\s*Secure(?:;|$)/i.test(value) &&
        /;\s*HttpOnly(?:;|$)/i.test(value) &&
        /;\s*SameSite=Lax(?:;|$)/i.test(value),
    ),
    'secure session cookie',
  )
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ')
  secrets.push(cookie)
  const me = (await request(origin, '/api/b2b/me', { headers: { cookie } })).json()
  const headers = {
    origin,
    cookie,
    'Content-Type': 'application/json',
    'X-Klisteni-B2B-Account': me.user.id,
  }
  return {
    me,
    headers,
    api: async (path, method = 'GET', body, expected = method === 'POST' ? 201 : 200) => {
      const response = await request(origin, `/api/b2b${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      assert.equal(response.status, expected, `${method} ${path}`)
      return response.json()
    },
  }
}
function pngBytes() {
  function chunk(type, bytes) {
    const output = Buffer.alloc(bytes.length + 12)
    output.writeUInt32BE(bytes.length)
    output.write(type, 4)
    bytes.copy(output, 8)
    let crc = 0xffffffff
    for (const byte of output.subarray(4, -4)) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, output.length - 4)
    return output
  }
  const width = 1024,
    height = 512,
    header = Buffer.alloc(13),
    pixels = randomBytes((width * 4 + 1) * height)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  for (let row = 0; row < height; row++) pixels[row * (width * 4 + 1)] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
async function apiStatus(instance, path) {
  const result = await instance.compose(
    [
      'exec',
      '-T',
      'b2b-api',
      'node',
      '-e',
      `fetch('http://127.0.0.1:4201/api/b2b/${path}').then(r=>console.log(r.status))`,
    ],
    { allowFailure: true },
  )
  return Number(result.output.toString().trim())
}
async function operator(instance, operation, values) {
  await instance.compose(
    [
      'run',
      '--rm',
      '--no-deps',
      '-T',
      ...Object.keys(values).flatMap((name) => ['-e', name]),
      'b2b-api',
      'node',
      'apps/b2b-api/src/operator.ts',
      operation,
    ],
    { env: values },
  )
}
async function cleanup() {
  cleaning = true
  agent?.destroy()
  if (proxy) await new Promise((resolve) => proxy.close(resolve))
  for (const instance of [...projects].reverse())
    await instance
      .compose(['down', '--volumes', '--remove-orphans', '--timeout', '10'], {
        allowFailure: true,
      })
      .catch(log)
  for (const image of images)
    await run('docker', ['image', 'rm', image], { allowFailure: true }).catch(log)
  for (const filename of [
    'tls.key',
    'tls.crt',
    ...projects.map((item) => `${item.name}.env.private`),
  ])
    rmSync(resolve(directory, filename), { force: true })
  report.cleanupComplete = true
  for (const image of images) {
    const result = await run('docker', ['image', 'ls', '-q', image], { allowFailure: true })
    if (result.code || result.output.length) report.cleanupComplete = false
  }
  for (const instance of projects) {
    const containers = await run(
      'docker',
      ['ps', '-aq', '--filter', `label=com.docker.compose.project=${instance.name}`],
      { allowFailure: true },
    )
    const volumes = await run(
      'docker',
      ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${instance.name}`],
      { allowFailure: true },
    )
    if (containers.code || volumes.code || containers.output.length || volumes.output.length)
      report.cleanupComplete = false
  }
  if (!report.cleanupComplete) {
    report.success = false
    report.failedStage = 'cleanup of generated resources'
    process.exitCode = 1
  }
}

try {
  assert.equal(
    process.argv.length,
    2,
    'This smoke command accepts no project, database or deployment arguments',
  )
  const disk = statfsSync(root)
  assert.ok(
    disk.bavail * disk.bsize >= 2 * 1024 ** 3,
    'At least 2 GiB of free disk is required; cold base-image downloads need additional capacity',
  )
  diskMonitor = setInterval(() => {
    try {
      const current = statfsSync(root)
      if (current.bavail * current.bsize < 384 * 1024 ** 2)
        cancellation.abort(new Error('Runtime smoke stopped to preserve free disk space'))
    } catch {
      cancellation.abort(new Error('Could not monitor free disk space'))
    }
  }, 500)
  diskMonitor.unref()
  for (const app of ['member-web', 'backoffice'])
    assert.ok(existsSync(resolve(root, `apps/${app}/dist/index.html`)), 'Run pnpm build:b2b first')
  await run('docker', ['compose', 'version'])
  report.sourceRevision = (await run('git', ['rev-parse', 'HEAD'])).output.toString().trim()
  report.workingTreeChanges = Boolean((await run('git', ['status', '--porcelain'])).output.length)
  step('build independent production images from current source and existing frontend artifacts')
  images.push(apiImage, webImage)
  await run('docker', [
    'build',
    '-f',
    'Dockerfile.b2b-api',
    '--build-arg',
    `OCI_REVISION=${report.sourceRevision}`,
    '-t',
    apiImage,
    '.',
  ])
  await run('docker', [
    'build',
    '-f',
    'Dockerfile.b2b-web',
    '--build-arg',
    `OCI_REVISION=${report.sourceRevision}`,
    '-t',
    webImage,
    '.',
  ])
  for (const [name, image] of [
    ['api', apiImage],
    ['web', webImage],
  ])
    report.images[name] = JSON.parse(
      (
        await run('docker', ['image', 'inspect', image, '--format', '{{json .Id}}'])
      ).output.toString(),
    )
  passed('production API and web images built from repository Dockerfiles')

  step('start a loopback TLS proxy with a private ephemeral certificate')
  await run('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    resolve(directory, 'tls.key'),
    '-out',
    resolve(directory, 'tls.crt'),
    '-days',
    '1',
    '-subj',
    '/CN=127.0.0.1',
    '-addext',
    'subjectAltName=IP:127.0.0.1',
  ])
  const cert = readFileSync(resolve(directory, 'tls.crt'))
  agent = new Agent({ ca: cert })
  proxy = createHttpsServer(
    { key: readFileSync(resolve(directory, 'tls.key')), cert },
    (incoming, outgoing) => {
      const upstream = httpRequest(
        {
          host: '127.0.0.1',
          port: targetPort,
          path: incoming.url,
          method: incoming.method,
          headers: incoming.headers,
        },
        (response) => {
          outgoing.writeHead(response.statusCode, response.headers)
          response.pipe(outgoing)
        },
      )
      upstream.on('error', () => {
        if (!outgoing.headersSent) outgoing.writeHead(502)
        outgoing.end()
      })
      incoming.pipe(upstream)
    },
  )
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  const origin = `https://127.0.0.1:${proxy.address().port}`
  const common = {
    B2B_POSTGRES_PASSWORD: secret(),
    B2B_DB_PASSWORD: secret(),
    B2B_AUTH_SECRET: secret(),
    B2B_APP_ORIGIN: origin,
    B2B_NODE_ENV: 'production',
  }
  const original = project(runId, await freePort(), common)
  targetPort = original.port
  step('readiness rejects an unmigrated database; versioned migrations are repeatable')
  await original.compose(['up', '-d', '--wait', 'db'])
  await original.compose(['up', '-d', '--no-deps', 'b2b-api'])
  await waitFor(async () => (await apiStatus(original, 'healthz')) === 200, 'API liveness')
  assert.equal(await apiStatus(original, 'readyz'), 503)
  await original.compose(['run', '--rm', '-T', 'migrate'])
  await original.compose(['run', '--rm', '-T', 'migrate'])
  assert.equal(await apiStatus(original, 'readyz'), 503, 'auth schema failure remains unready')
  // The probe above intentionally violates normal startup order. Authentication
  // validates its schema when the process starts, so resume the production order
  // (migration succeeds before API startup) before exercising real sessions.
  await original.compose(['restart', 'b2b-api'])
  await waitFor(async () => (await apiStatus(original, 'readyz')) === 200, 'migrated API')
  await original.compose(['up', '-d', '--no-deps', 'web'])
  await waitFor(async () => (await request(origin, '/healthz')).status === 200, 'web health')
  passed(
    'liveness is distinct from readiness; migrations repeat safely; cached auth mismatch remains unready until restart',
  )

  step('verify nonroot processes, read-only filesystems and restricted database role')
  for (const service of ['b2b-api', 'web']) {
    const id = (await original.compose(['ps', '-q', service])).output.toString().trim()
    const container = JSON.parse((await run('docker', ['inspect', id])).output.toString())[0]
    assert.equal(container.HostConfig.ReadonlyRootfs, true)
    assert.ok(container.HostConfig.CapDrop.includes('ALL'))
    assert.ok(container.HostConfig.SecurityOpt.includes('no-new-privileges:true'))
    assert.notEqual(
      (await original.compose(['exec', '-T', service, 'id', '-u'])).output.toString().trim(),
      '0',
    )
    if (service === 'b2b-api') {
      const values = Object.fromEntries(
        container.Config.Env.map((value) => {
          const split = value.indexOf('=')
          return [value.slice(0, split), value.slice(split + 1)]
        }),
      )
      assert.equal(values.NODE_ENV, 'production')
      assert.equal(values.B2B_DEMO_MODE, 'false')
      assert.equal(new URL(values.B2B_DATABASE_URL).username, 'klisteni_b2b')
      assert.ok(
        !Object.values(values).some((value) => value.includes(common.B2B_POSTGRES_PASSWORD)),
      )
    }
  }
  await original.compose([
    'exec',
    '-T',
    'b2b-api',
    'node',
    '--input-type=module',
    '-e',
    `import assert from 'node:assert/strict'; import {writeFileSync} from 'node:fs'; import {createPool} from './apps/b2b-api/src/database.ts'; const db=createPool({databaseUrl:process.env.B2B_DATABASE_URL}); try {const role=(await db.query('SELECT current_user,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0]; assert.equal(role.current_user,'klisteni_b2b'); assert.equal(role.rolsuper||role.rolcreatedb||role.rolcreaterole,false); await assert.rejects(db.query('CREATE TABLE smoke_forbidden(id integer)'),{code:'42501'}); assert.throws(()=>writeFileSync('/app/smoke-forbidden','x'),error=>['EROFS','EACCES'].includes(error.code));} finally {await db.end()}`,
  ])
  passed('both services run nonroot and read-only; API has no DDL or migration credential')

  step('bootstrap real production accounts and verify HTTPS sessions and tenant guards')
  const credentials = {
    email: 'admin@runtime.example.test',
    password: secret(),
  }
  await operator(original, 'bootstrap', {
    B2B_BOOTSTRAP_EMAIL: credentials.email,
    B2B_BOOTSTRAP_NAME: 'Runtime Admin',
    B2B_BOOTSTRAP_PASSWORD: credentials.password,
    B2B_ORG_SLUG: 'runtime-atlas',
    B2B_ORG_NAME: 'Runtime Atlas',
  })
  await operator(original, 'create-organization', {
    B2B_ADMIN_EMAIL: credentials.email,
    B2B_ADMIN_NAME: 'Runtime Admin',
    B2B_ORG_SLUG: 'runtime-sur',
    B2B_ORG_NAME: 'Runtime Sur',
  })
  const admin = await login(origin, credentials),
    base = '/orgs/runtime-atlas'
  assert.equal(admin.me.memberships.length, 2)
  assert.equal((await request(origin, '/api/b2b/me')).status, 401)
  assert.equal(
    (
      await request(origin, '/api/b2b/auth/sign-in/email', {
        method: 'POST',
        headers: {
          origin: 'https://foreign.example.test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })
    ).status,
    403,
  )
  for (const path of ['/', '/app', '/g/runtime-atlas', '/backoffice/']) {
    const page = await request(origin, path)
    assert.equal(page.status, 200)
    assert.match(page.headers['content-type'], /text\/html/)
    assert.match(page.headers['content-security-policy'], /object-src 'none'/)
    assert.equal(page.headers['x-content-type-options'], 'nosniff')
    for (const match of page.bytes.toString().matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g))
      assert.equal((await request(origin, match[1], { method: 'HEAD' })).status, 200)
  }
  for (const path of [
    '/api',
    '/api/b2c/me',
    '/assets/missing.js',
    '/backoffice/assets/missing.js',
    '/models/missing.glb',
    '/.env',
  ])
    assert.equal((await request(origin, path)).status, 404)
  passed(
    'production HTTPS cookies, real bootstrap, same-identity gyms, foreign-origin guard and independent SPA routing',
  )

  step('exercise uploads, explicit publication, range reads and two QR units')
  const png = pngBytes()
  assert.ok(png.length > 1024 ** 2)
  const upload = await request(origin, `/api/b2b${base}/media?kind=image&label=Runtime%20photo`, {
    method: 'POST',
    headers: { ...admin.headers, 'Content-Type': 'image/png' },
    body: png,
  })
  assert.equal(upload.status, 201)
  const media = upload.json().media
  assert.equal((await request(origin, media.url)).status, 404)
  const mediaAsset = {
    id: media.id,
    kind: media.kind,
    url: media.url,
    label: media.label,
    attribution: media.attribution,
  }
  let { website } = await admin.api(`${base}/website`)
  ;({ website } = await admin.api(`${base}/website`, 'PUT', {
    ...website.draft,
    headline: 'Runtime Atlas',
    gallery: [mediaAsset],
    expectedRevision: website.revision,
  }))
  ;({ website } = await admin.api(`${base}/website/publish`, 'POST', {
    expectedRevision: website.revision,
  }))
  const read = await request(origin, media.url)
  assert.equal(read.status, 200)
  assert.equal(createHash('sha256').update(read.bytes).digest('hex'), media.sha256)
  const range = await request(origin, media.url, {
    headers: { range: 'bytes=0-31' },
  })
  assert.equal(range.status, 206)
  assert.deepEqual(range.bytes, png.subarray(0, 32))
  const batch = {
    id: randomUUID(),
    units: [1, 2].map((number) => ({
      machineId: 'base-cable-station-v1',
      label: `Runtime polea ${number}`,
      location: 'Sector tracción',
      adjustments: 'Consultar ajuste inicial.',
      assets: [mediaAsset],
      public: true,
      archived: false,
    })),
  }
  const firstBatch = await admin.api(`${base}/units/batch`, 'POST', batch)
  assert.deepEqual(await admin.api(`${base}/units/batch`, 'POST', batch), firstBatch)
  assert.equal((await admin.api(`${base}/units`)).units.length, 2)
  for (const unit of firstBatch.units)
    assert.equal(
      (await request(origin, `/api/b2b/public/runtime-atlas/units/${unit.id}`)).status,
      200,
    )
  ;({ website } = await admin.api(`${base}/website/unpublish`, 'POST', {
    expectedRevision: website.revision,
  }))
  assert.equal((await request(origin, media.url)).status, 404)
  assert.equal(
    (await request(origin, `/api/b2b/public/runtime-atlas/units/${firstBatch.units[0].id}`)).status,
    404,
  )
  await admin.api(`${base}/website/publish`, 'POST', {
    expectedRevision: website.revision,
  })
  passed(
    'upload larger than 1 MiB, media SHA256 and range serving, private/public lifecycle and idempotent unit QR batch',
  )

  step('record a timed prescription and exact execution retry through the production images')
  const memberCredentials = {
    email: 'member@runtime.example.test',
    password: secret(),
  }
  const invitation = await admin.api(`${base}/invitations`, 'POST', {
    email: memberCredentials.email,
    name: 'Runtime Member',
    role: 'member',
  })
  const token = new URL(invitation.url).searchParams.get('token')
  secrets.push(token)
  const accepted = await request(origin, '/api/b2b/invitations/accept', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      name: 'Runtime Member',
      password: memberCredentials.password,
    }),
  })
  assert.equal(accepted.status, 201)
  const member = await login(origin, memberCredentials)
  const { program } = await admin.api(`${base}/programs`, 'POST', {
    name: 'Runtime timing',
    steps: [
      {
        id: 'runtime-step',
        exerciseId: 'dead-bug',
        sets: 1,
        reps: null,
        durationSeconds: 45,
        targetRpe: 7,
        restSeconds: 30,
      },
    ],
  })
  const { version } = await admin.api(`${base}/programs/${program.id}/publish`, 'POST', {
    expectedRevision: program.revision,
  })
  const { assignment } = await admin.api(`${base}/assignments`, 'POST', {
    memberId: member.me.user.id,
    programId: program.id,
    version: version.version,
  })
  const execution = {
    id: randomUUID(),
    assignmentId: assignment.id,
    status: 'completed',
    completedAt: new Date().toISOString(),
    notes: 'Runtime verification',
    sets: [
      {
        stepId: 'runtime-step',
        set: 1,
        exerciseId: 'dead-bug',
        reps: null,
        durationSeconds: 38,
        rpe: 8,
        loadKg: null,
        reason: '',
      },
    ],
  }
  await member.api(`${base}/executions`, 'POST', execution)
  await member.api(`${base}/executions`, 'POST', execution)
  assert.equal((await member.api(`${base}/executions`)).executions.length, 1)
  assert.equal(
    (
      await request(origin, '/api/b2b/orgs/runtime-sur/assignments', {
        headers: member.headers,
      })
    ).status,
    403,
  )
  const reports = await admin.api(`${base}/reports`)
  assert.equal(reports.executions[0].program.steps[0].durationSeconds, 45)
  assert.equal(reports.executions[0].sets[0].durationSeconds, 38)
  passed(
    'invitation, timed prescription/RPE, immutable assignment snapshot, exact execution retry and cross-gym denial',
  )

  step('restart API and web without changing durable data')
  await original.compose(['restart', 'b2b-api', 'web'])
  await waitFor(
    async () => (await request(origin, '/api/b2b/readyz')).status === 200,
    'readiness after restart',
  )
  assert.equal((await member.api(`${base}/executions`)).executions.length, 1)
  assert.equal(
    createHash('sha256')
      .update((await request(origin, media.url)).bytes)
      .digest('hex'),
    media.sha256,
  )
  passed('sessions, executions and exact media bytes survive API/web restart')

  step('back up quiescent source and restore into separate database and media volumes')
  await original.compose(['stop', 'web', 'b2b-api'])
  const dump = (
    await original.compose([
      'exec',
      '-T',
      'db',
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'klisteni_b2b_instance',
      '-Fc',
    ])
  ).output
  const mediaArchive = (
    await original.compose([
      'run',
      '--rm',
      '--no-deps',
      '-T',
      'b2b-api',
      'tar',
      '--exclude=.upload-*.tmp',
      '-czf',
      '-',
      '-C',
      '/var/lib/klisteni-b2b',
      'media',
    ])
  ).output
  report.backup = {
    databaseBytes: dump.length,
    mediaBytes: mediaArchive.length,
  }
  const restored = project(`${runId}-restore`, await freePort(), common)
  await restored.compose(['up', '-d', '--wait', 'db'])
  await restored.compose(
    [
      'exec',
      '-T',
      'db',
      'pg_restore',
      '-U',
      'postgres',
      '-d',
      'klisteni_b2b_instance',
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
    ],
    { input: dump },
  )
  await restored.compose(
    [
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'postgres',
      '-d',
      'klisteni_b2b_instance',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input:
        'GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO klisteni_b2b; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO klisteni_b2b;',
    },
  )
  await restored.compose(
    [
      'run',
      '--rm',
      '--no-deps',
      '-T',
      'b2b-api',
      'tar',
      '-xzf',
      '-',
      '--strip-components=1',
      '-C',
      '/var/lib/klisteni-b2b/media',
    ],
    { input: mediaArchive },
  )
  await restored.compose(['run', '--rm', '-T', 'migrate'])
  await restored.compose(['up', '-d', '--no-deps', 'b2b-api', 'web'])
  targetPort = restored.port
  await waitFor(
    async () => (await request(origin, '/api/b2b/readyz')).status === 200,
    'restored readiness',
  )
  const recoveredAdmin = await login(origin, credentials),
    recoveredMember = await login(origin, memberCredentials)
  assert.equal((await recoveredAdmin.api(`${base}/units`)).units.length, 2)
  assert.equal((await recoveredAdmin.api(`${base}/media`)).media[0].sha256, media.sha256)
  assert.equal(
    createHash('sha256')
      .update((await request(origin, media.url)).bytes)
      .digest('hex'),
    media.sha256,
  )
  const recoveredExecution = (await recoveredMember.api(`${base}/executions`)).executions[0]
  assert.equal(recoveredExecution.id, execution.id)
  assert.equal(recoveredExecution.program.steps[0].durationSeconds, 45)
  assert.equal(recoveredExecution.sets[0].durationSeconds, 38)
  assert.equal(
    (
      await request(origin, '/api/b2b/orgs/runtime-sur/assignments', {
        headers: recoveredMember.headers,
      })
    ).status,
    403,
  )
  await recoveredMember.api('/auth/sign-out', 'POST', {}, 200)
  assert.equal(
    (await request(origin, '/api/b2b/me', { headers: recoveredMember.headers })).status,
    401,
  )
  passed(
    'independent DB/media restore retains identities, snapshots, execution, media hash, isolation and logout invalidation',
  )
  report.success = true
} catch (error) {
  report.failedStage = stage
  log(error.stack ?? error)
  for (const instance of projects) {
    const result = await instance
      .compose(['logs', '--no-color', '--tail', '100', 'b2b-api'], {
        allowFailure: true,
      })
      .catch(() => null)
    if (result) log(result.output.toString())
  }
  console.error(`[runtime] Failed at: ${stage}. Diagnostics are private: ${logPath}`)
  process.exitCode = 1
} finally {
  clearInterval(diskMonitor)
  step('remove only generated smoke containers, volumes, image tags and credentials')
  await cleanup()
  report.completedAt = new Date().toISOString()
  try {
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    })
  } catch {
    console.error('[runtime] Could not write evidence; cleanup was attempted.')
    process.exitCode = 1
  }
  console.info(`[runtime] Evidence: ${reportPath}`)
}
