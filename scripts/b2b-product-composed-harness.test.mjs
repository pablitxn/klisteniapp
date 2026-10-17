import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { startProductHarness } from './b2b-product-e2e-server.mjs'
import { PRODUCT_TEST_PASSWORD } from './b2b-product-seed.mjs'
import { requireProductTestDatabase } from './b2b-product-harness-settings.ts'
const source = requireProductTestDatabase(process.env.B2B_TEST_DATABASE_URL).href
function request(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname: '127.0.0.1', port, path, method, headers, timeout: 15000 },
      (response) => {
        let text = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => (text += chunk))
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
    request.on('error', reject)
    request.on('timeout', () => request.destroy(new Error('Synthetic request timeout')))
    request.end(body === undefined ? undefined : JSON.stringify(body))
  })
}
async function streamReady(port, path, headers) {
  await new Promise((resolve, reject) => {
    const client = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        headers: { ...headers, accept: 'text/event-stream' },
        timeout: 15000,
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume()
          reject(new Error(`Event stream status ${response.statusCode}`))
          return
        }
        assert.match(response.headers['content-type'], /^text\/event-stream/)
        let text = ''
        response.setEncoding('utf8')
        response.on('data', (part) => {
          text += part
          if (text.includes('event: ready\ndata: {}\n\n')) {
            resolve()
            client.destroy()
          }
        })
      },
    )
    client.on('error', reject)
    client.on('timeout', () => client.destroy(new Error('Event stream timeout')))
    client.end()
  })
}
for (const mode of ['unified-http', 'white-label-http'])
  test(
    `composed ${mode} serves activated synthetic planning, member history and export-only access`,
    { timeout: 120000 },
    async () => {
      const harness = await startProductHarness({
        source,
        mode,
        offset: 400,
        projectCount: 1,
        env: { ...process.env, B2B_PRODUCT_TEST_ACTIVATE: '1' },
      })
      try {
        const f = harness.fixtures[0],
          project = f.project,
          wl = mode === 'white-label-http',
          port = wl ? project.proxyPort : project.gatewayPort,
          origin = wl ? 'http://atlas.b2b.test' : `http://127.0.0.1:${port}`
        const path = (value) => (wl ? origin + value : value)
        assert.equal(f.featuresActivated, true)
        assert.ok(f.resources.v2.every((r) => r.assigned && r.occurrenceIds.length === 6))
        const page = await request(port, path('/app'))
        assert.equal(page.status, 200)
        assert.match(page.body, /<html/)
        for (const suffix of [
          'atlas-superadmin',
          'atlas-assigned-coach',
          'atlas-secondary-coach',
          'atlas-secondary-member',
          'atlas-inactive-member',
        ]) {
          const actor = Object.entries(f.actors).find(([key]) => key.endsWith(suffix))[1]
          const login = await request(port, path('/api/b2b/auth/sign-in/email'), {
            method: 'POST',
            headers: { origin, 'content-type': 'application/json', 'x-klisteni-b2b-contract': '2' },
            body: { email: actor.email, password: PRODUCT_TEST_PASSWORD },
          })
          assert.equal(login.status, 200, JSON.stringify(login.body))
          const cookie = login.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ')
          const headers = {
            cookie,
            'x-klisteni-b2b-contract': '2',
            'x-klisteni-b2b-account': actor.id,
          }
          const boot = await request(port, path('/api/b2b/bootstrap/v2'), { headers })
          assert.equal(boot.status, 200, JSON.stringify(boot.body))
          const member = boot.body.memberships.find((m) => m.organizationId === 'atlas-demo')
          assert.ok(member)
          const choice = member.choices[0]
          if (choice)
            Object.assign(headers, {
              'x-klisteni-b2b-branch': choice.branchId,
              'x-klisteni-b2b-role': choice.role,
            })
          const api = '/api/b2b/orgs/atlas-demo/product/v2'
          const access = await request(port, path(api + '/access'), { headers })
          assert.equal(access.status, 200, JSON.stringify(access.body))
          await streamReady(port, path(api + '/events'), headers)
          if (suffix.endsWith('inactive-member')) {
            assert.equal(access.body.accessMode, 'export-only')
            const own = await request(
              port,
              path('/api/b2b/self/exports?organizationId=atlas-demo'),
              { headers },
            )
            assert.equal(own.status, 200, JSON.stringify(own.body))
            assert.equal((await request(port, path(api + '/routines'), { headers })).status, 403)
          } else if (suffix.endsWith('superadmin')) {
            const branches = await request(port, path(api + '/invitation-branches'), { headers })
            assert.equal(branches.status, 200, JSON.stringify(branches.body))
            assert.equal(branches.body.length, 2)
            assert.ok(
              branches.body.every(
                (row) => row.organizationId === 'atlas-demo' && row.status === 'active',
              ),
            )
            assert.equal(
              (
                await request(port, path('/api/b2b/orgs/sur-demo/product/v2/invitation-branches'), {
                  headers,
                })
              ).status,
              wl ? 404 : 403,
            )
          } else if (suffix.endsWith('coach')) {
            assert.equal(
              (await request(port, path(api + '/invitation-branches'), { headers })).status,
              403,
            )
            assert.equal(
              (await request(port, path(api + '/routine-publications'), { headers })).status,
              200,
            )
            assert.equal(
              (await request(port, path(api + '/history-subjects'), { headers })).status,
              200,
            )
            const catalog = await request(port, path(api + '/catalog/exercises'), { headers })
            assert.equal(catalog.status, 200)
            const adaptations = catalog.body.filter((e) => e.id.endsWith('-qa-adapted-squat'))
            if (suffix.includes('assigned')) {
              assert.equal(adaptations.length, 1)
              const local = adaptations[0],
                base = catalog.body.find((e) => e.id === 'squat')
              assert.equal(local.scope, 'organization')
              assert.equal(local.branchId, choice.branchId)
              assert.equal(local.baseExerciseId, 'squat')
              assert.equal(local.animationId, 'squat')
              assert.notDeepEqual(local.instructions, base.instructions)
              const id = randomUUID(),
                mutationHeaders = { ...headers, origin, 'content-type': 'application/json' }
              const draft = await request(port, path(api + '/routines/' + id), {
                method: 'POST',
                headers: mutationHeaders,
                body: {
                  id,
                  operationId: randomUUID(),
                  expectedRevision: 0,
                  content: {
                    name: 'Synthetic local adaptation proof',
                    description: '',
                    steps: [
                      {
                        id: 'source',
                        exerciseId: local.id,
                        substitutionPolicy: 'reviewed',
                        dose: {
                          mode: 'repetitions',
                          sets: { kind: 'fixed', value: 3 },
                          repetitions: { kind: 'fixed', value: 8 },
                          durationSeconds: null,
                          load: { mode: 'bodyweight' },
                          restSeconds: { kind: 'fixed', value: 60 },
                          laterality: 'bilateral',
                          targetRpe: null,
                          notes: '',
                        },
                      },
                    ],
                  },
                },
              })
              assert.equal(draft.status, 200, JSON.stringify(draft.body))
              const published = await request(port, path(api + '/routines/' + id + '/publish'), {
                method: 'POST',
                headers: mutationHeaders,
                body: { id, operationId: randomUUID(), expectedRevision: draft.body.revision },
              })
              assert.equal(published.status, 200, JSON.stringify(published.body))
              assert.deepEqual(published.body.relations, [])
            } else assert.deepEqual(adaptations, [])
          } else {
            const own = await request(port, path(api + `/members/${actor.id}/continuity`), {
              headers,
            })
            assert.equal(own.status, 200, JSON.stringify(own.body))
            assert.equal(own.body.current.length, 1)
          }
        }
      } finally {
        await harness.close()
      }
    },
  )
