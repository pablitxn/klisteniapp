/** Actual baseline composition, not WP12 feature acceptance or a browser result. */
import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { startProductHarness } from './b2b-product-e2e-server.mjs'
import { PRODUCT_TEST_PASSWORD } from './b2b-product-seed.mjs'
import { requireProductTestDatabase } from './b2b-product-harness-settings.ts'
const { Pool } = createRequire(new URL('../apps/b2b-api/package.json', import.meta.url))('pg')
const source = requireProductTestDatabase(process.env.B2B_TEST_DATABASE_URL).href
const offset = Number(process.env.B2B_PRODUCT_PORT_OFFSET ?? 0)
function request(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const client = http.request(
      { hostname: '127.0.0.1', port, path, method, headers, timeout: 15000 },
      (response) => {
        let text = ''
        response.setEncoding('utf8')
        response.on('data', (part) => {
          text += part
        })
        response.on('end', () => {
          let value
          try {
            value = JSON.parse(text)
          } catch {
            value = text
          }
          resolve({ status: response.statusCode, body: value, headers: response.headers })
        })
      },
    )
    client.on('timeout', () => client.destroy(new Error('Synthetic request timed out')))
    client.on('error', reject)
    client.end(body === undefined ? undefined : JSON.stringify(body))
  })
}
const query = (pool, schema, sql, values = []) => {
  assert.match(schema, /^b2b_product_browser_[a-f0-9]{32}$/)
  return pool.query(sql.replaceAll('FIXTURE.', `${schema}.`), values)
}
const actor = (fixture, suffix) =>
  Object.entries(fixture.actors).find(([key]) => key.endsWith(suffix))[1]

test(
  'six isolated white-label HTTP environments preserve old records and compose actual auth/API/frontend',
  { timeout: 240000 },
  async () => {
    const owner = new Pool({ connectionString: source })
    let harness
    try {
      harness = await startProductHarness({ source, mode: 'white-label-http', offset })
      assert.equal(harness.fixtures.length, 6)
      assert.equal(new Set(harness.fixtures.map((fixture) => fixture.schema)).size, 6)
      assert.equal(
        (await request(harness.layout.controlPort, '/healthz')).body.featuresActivated,
        false,
      )
      assert.equal(
        (
          await request(harness.layout.controlPort, '/fixtures?project=0', {
            headers: { origin: 'http://outside.test' },
          })
        ).status,
        403,
      )
      for (const fixture of harness.fixtures) {
        const { schema, project } = fixture
        const read = (sql, values) => query(owner, schema, sql, values)
        assert.equal(Object.keys(fixture.organizations).length, 2)
        assert.equal(
          Object.values(fixture.organizations).flatMap((org) => Object.keys(org.branches)).length,
          4,
        )
        assert.equal(Object.keys(fixture.actors).length, 22)
        assert.equal(fixture.preservation.beforeSha256, fixture.preservation.afterSha256)
        assert.deepEqual(fixture.preservation.counts, {
          versions: 4,
          assignments: 6,
          executions: 2,
          audit: 2,
          media: 2,
          grants: 32,
        })
        assert.equal((await read('SELECT 1 FROM FIXTURE.b2b_migration')).rowCount, 7)
        assert.equal(
          (await read('SELECT 1 FROM FIXTURE.b2b_organization WHERE product_active')).rowCount,
          0,
        )
        assert.equal((await read('SELECT 1 FROM FIXTURE.b2b_health')).rowCount, 0)
        assert.equal((await read('SELECT 1 FROM FIXTURE.b2b_health_consent')).rowCount, 0)
        assert.equal((await read('SELECT 1 FROM FIXTURE.b2b_goal_program')).rowCount, 0)
        assert.equal(
          (
            await read('SELECT 1 FROM FIXTURE.b2b_platform_admin WHERE user_id=ANY($1::text[])', [
              Object.values(fixture.actors).map((actor) => actor.id),
            ])
          ).rowCount,
          0,
        )
        for (const brand of ['atlas', 'sur']) {
          for (const [suffix, role] of [
            ['legacy-admin', 'superadmin'],
            ['new-admin', 'admin'],
            ['superadmin', 'superadmin'],
          ]) {
            const membership = (
              await read('SELECT role,product_role FROM FIXTURE.b2b_membership WHERE user_id=$1', [
                actor(fixture, `${brand}-${suffix}`).id,
              ])
            ).rows[0]
            assert.deepEqual(membership, { role: 'admin', product_role: role })
          }
          assert.equal(
            (
              await read('SELECT 1 FROM FIXTURE.b2b_coach_assignment WHERE coach_id=$1', [
                actor(fixture, `${brand}-cover-coach`).id,
              ])
            ).rowCount,
            0,
          )
          assert.deepEqual(
            (
              await read(
                'SELECT role FROM FIXTURE.b2b_branch_grant WHERE user_id=$1 ORDER BY role',
                [actor(fixture, `${brand}-mixed-role`).id],
              )
            ).rows.map((row) => row.role),
            ['coach', 'member'],
          )
          const context = await request(
            project.proxyPort,
            `http://${brand}.b2b.test/api/b2b/context`,
          )
          assert.equal(context.status, 200)
          assert.equal(context.body.branches.length, 2)
          assert.equal(
            (await request(project.proxyPort, `http://${brand}.b2b.test/login`)).status,
            200,
          )
        }
        assert.deepEqual(
          (
            await read(
              'SELECT active FROM FIXTURE.b2b_membership WHERE user_id=$1 ORDER BY organization_id',
              [actor(fixture, 'multi-member').id],
            )
          ).rows.map((row) => row.active),
          [false, true],
        )
        assert.equal(
          (await request(project.proxyPort, 'http://atlas.b2b.test/api/b2b/readyz')).status,
          200,
        )
        const member = actor(fixture, 'atlas-member')
        const login = await request(
          project.proxyPort,
          'http://atlas.b2b.test/api/b2b/auth/sign-in/email',
          {
            method: 'POST',
            headers: { origin: 'http://atlas.b2b.test', 'content-type': 'application/json' },
            body: { email: member.email, password: PRODUCT_TEST_PASSWORD },
          },
        )
        assert.equal(login.status, 200)
        const cookie = login.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ')
        const me = await request(project.proxyPort, 'http://atlas.b2b.test/api/b2b/me', {
          headers: { cookie },
        })
        assert.equal(me.status, 200)
        assert.equal(me.body.user.id, member.id)
        assert.equal(
          (
            await request(project.proxyPort, 'http://sur.b2b.test/api/b2b/me', {
              headers: { cookie },
            })
          ).status,
          401,
        )
        const other = harness.fixtures[(project.index + 1) % harness.fixtures.length]
        assert.equal(
          (
            await request(other.project.proxyPort, 'http://atlas.b2b.test/api/b2b/me', {
              headers: { cookie },
            })
          ).status,
          401,
        )
        const media = fixture.resources.legacy[0]
        const access = {
          cookie,
          'x-klisteni-b2b-account': member.id,
          'x-klisteni-b2b-branch': media.branchId,
          'x-klisteni-b2b-role': 'member',
        }
        assert.equal(
          (
            await request(
              project.proxyPort,
              `http://atlas.b2b.test/api/b2b/orgs/${media.organizationId}/assignments`,
              { headers: access },
            )
          ).status,
          200,
        )
        assert.equal(
          (await request(project.proxyPort, 'http://unknown.b2b.test/api/b2b/context')).status,
          421,
        )
        const publishedMap = await request(
          harness.layout.controlPort,
          `/fixtures?project=${project.index}`,
        )
        assert.equal(
          publishedMap.body.actors[Object.keys(fixture.actors)[0]].id,
          Object.values(fixture.actors)[0].id,
        )
      }
    } finally {
      if (harness) {
        await harness.close()
        assert.equal(existsSync(harness.runtimeRoot), false)
        for (const fixture of harness.fixtures)
          assert.equal(
            (await owner.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [fixture.schema]))
              .rowCount,
            0,
          )
      }
      await owner.end()
    }
  },
)

test(
  'unified baseline reports the current white-label guard without changing access policy',
  { timeout: 60000 },
  async () => {
    const harness = await startProductHarness({
      source,
      mode: 'unified-http',
      offset,
      projectCount: 1,
    })
    try {
      const port = harness.fixtures[0].project.gatewayPort
      assert.equal((await request(port, '/login')).status, 200)
      assert.equal((await request(port, '/api/b2b/readyz')).status, 200)
      const response = await request(port, '/api/b2b/me')
      assert.equal(response.status, 503)
      assert.equal(response.body.code, 'WHITE_LABEL_REQUIRED')
      assert.equal(
        harness.fixtures[0].baselineEntry,
        'blocked-by-current-white-label-required-guard',
      )
    } finally {
      await harness.close()
    }
  },
)

test('HTTPS startup fails closed without pre-provisioned certificates', async () => {
  await assert.rejects(
    startProductHarness({ source, mode: 'white-label-https-valid-trust', env: {} }),
    /HTTPS blocked/,
  )
})

test('aborted startup removes only its own schema and media directory', async () => {
  const owner = new Pool({ connectionString: source })
  try {
    const temporaryRoots = () =>
      readdirSync(tmpdir())
        .filter((name) => name.startsWith('klisteni-b2b-product-'))
        .sort()
    const rootsBefore = temporaryRoots()
    const before = (
      await owner.query(
        "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'b2b_product_browser_%' ORDER BY nspname",
      )
    ).rows
    const abort = new AbortController()
    // Cancellation during password hashing exercises partial seed cleanup.
    const timeout = setTimeout(() => abort.abort(new Error('Synthetic startup cancellation')), 250)
    try {
      await assert.rejects(
        startProductHarness({
          source,
          mode: 'white-label-http',
          offset,
          projectCount: 1,
          signal: abort.signal,
        }),
        /Synthetic startup cancellation/,
      )
    } finally {
      clearTimeout(timeout)
    }
    assert.deepEqual(
      (
        await owner.query(
          "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'b2b_product_browser_%' ORDER BY nspname",
        )
      ).rows,
      before,
    )
    assert.deepEqual(temporaryRoots(), rootsBefore)
  } finally {
    await owner.end()
  }
})
