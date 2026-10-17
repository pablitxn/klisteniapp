import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { startProductHarness } from './b2b-product-e2e-server.mjs'
import { PRODUCT_TEST_PASSWORD } from './b2b-product-seed.mjs'
import { requireProductTestDatabase } from './b2b-product-harness-settings.ts'
import { contentHash } from '../apps/b2b-api/src/catalog/reviewed-projection.ts'
import {
  createOriginalSegment,
  createReviewedSegment,
  emptyPerformedSet,
  selectEffectiveSegment,
} from '../packages/b2b-domain/src/alternatives.ts'
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

async function prescribeReviewedDuration({ port, path, api, headers, fixture, memberId }) {
  const routinePath = api + `/routines/${fixture.programId}/versions/${fixture.version}`
  const issued = await request(port, path(routinePath), { headers })
  assert.equal(issued.status, 200, JSON.stringify(issued.body))
  assert.equal(issued.body.schemaVersion, 2)
  const snapshot = issued.body.snapshot
  assert.equal(contentHash(snapshot), fixture.routineHash)
  assert.equal(snapshot.relations[0].targetDose.mode, 'duration')
  assert.equal(fixture.kind, 'synthetic-contract-fixture')
  assert.equal(fixture.syntheticTargetDose.reviewScope, 'contract-and-ui-test-only')
  assert.equal(contentHash(snapshot.relations[0].targetDose), fixture.syntheticTargetDose.hash)
  const publications = await request(port, path(api + '/routine-publications'), { headers })
  assert.equal(publications.status, 200, JSON.stringify(publications.body))
  assert.ok(publications.body.some((item) => item.reference.programId === fixture.programId))

  const monday = new Date()
  monday.setUTCDate(monday.getUTCDate() + 1 - (monday.getUTCDay() || 7))
  const weekStart = monday.toISOString().slice(0, 10)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const content = {
    name: 'Synthetic duration fixture goal',
    goal: 'Synthetic directional prescription coverage; preserve original goal',
    timeZone: 'UTC',
    stages: [
      {
        id: 'duration-stage',
        name: 'Synthetic test stage',
        startDate: weekStart,
        endDate: sunday.toISOString().slice(0, 10),
        slots: [
          {
            id: 'duration-monday',
            weekday: 1,
            routine: { programId: fixture.programId, version: fixture.version, schemaVersion: 2 },
          },
        ],
      },
    ],
  }
  const goalId = randomUUID()
  const goal = await request(port, path(api + `/members/${memberId}/goals/${goalId}`), {
    method: 'POST',
    headers,
    body: { id: goalId, operationId: randomUUID(), expectedRevision: 0, memberId, content },
  })
  assert.equal(goal.status, 200, JSON.stringify(goal.body))
  const id = randomUUID()
  const enrolled = await request(port, path(api + `/members/${memberId}/enrollments/${id}`), {
    method: 'POST',
    headers,
    body: {
      id,
      operationId: randomUUID(),
      expectedRevision: 0,
      memberId,
      goalProgramId: goalId,
      issuedGoalRevision: goal.body.revision,
      content,
    },
  })
  assert.equal(enrolled.status, 200, JSON.stringify(enrolled.body))
  const occurrences = await request(
    port,
    path(api + `/members/${memberId}/occurrences?weekStart=${weekStart}&timeZone=UTC`),
    { headers },
  )
  assert.equal(occurrences.status, 200, JSON.stringify(occurrences.body))
  const issuedOccurrences = occurrences.body.filter((occurrence) => occurrence.enrollmentId === id)
  assert.equal(issuedOccurrences.length, 1)
  return { snapshot, occurrence: issuedOccurrences[0], routinePath, goal: content.goal }
}

async function saveReviewedDuration({ port, path, api, headers, plan, memberId }) {
  const { snapshot, occurrence, routinePath } = plan
  const at = new Date().toISOString()
  const step = snapshot.steps[0]
  const original = createOriginalSegment(step, randomUUID(), at)
  const relation = snapshot.relations[0]
  const target = createReviewedSegment(
    step,
    snapshot.relations,
    relation.id,
    relation.conditions,
    { activeMachineIds: new Set(), confirmedEquipment: new Set() },
    randomUUID(),
    at,
  )
  const previous = {
    status: 'partial',
    explicitCompletion: false,
    performedAt: at,
    notes: 'Synthetic original actuals retained across a unit switch',
    correctionReason: '',
    segments: [original],
    selectedSegments: [{ originalStepId: step.id, segmentId: original.segmentId }],
    sets: [{ ...emptyPerformedSet(original, randomUUID(), 1, 'both'), repetitions: 3 }],
  }
  const selected = selectEffectiveSegment(previous, target)
  const content = {
    ...selected,
    sets: [
      ...selected.sets,
      ...[1, 2].flatMap((ordinal) =>
        ['left', 'right'].map((side) => ({
          ...emptyPerformedSet(target, randomUUID(), ordinal, side),
          durationSeconds: 1,
        })),
      ),
    ],
  }
  const id = randomUUID()
  const submit = (submitted, expectedRevision = 0) =>
    request(port, path(api + `/sessions/${id}/revisions`), {
      method: 'POST',
      headers,
      body: {
        id,
        operationId: randomUUID(),
        expectedRevision,
        origin: { kind: 'occurrence', occurrenceId: occurrence.id, routine: occurrence.routine },
        content: submitted,
      },
    })
  const missingSide = await submit({
    ...content,
    status: 'completed',
    explicitCompletion: true,
    sets: content.sets.filter((set) => set.side !== 'right'),
  })
  assert.equal(missingSide.status, 400, JSON.stringify(missingSide.body))
  const unconfirmed = structuredClone(content)
  unconfirmed.segments.find((segment) => segment.relation).confirmedConditions = []
  assert.equal((await submit(unconfirmed)).status, 400)
  const forgedDose = structuredClone(content)
  forgedDose.segments.find((segment) => segment.relation).dose.restSeconds.value = 60
  assert.equal((await submit(forgedDose)).status, 400)

  const partial = await submit(content)
  assert.equal(partial.status, 200, JSON.stringify(partial.body))
  assert.equal(partial.body.session.content.status, 'partial')
  assert.equal(partial.body.session.content.explicitCompletion, false)
  assert.deepEqual(partial.body.session.content.sets[0], previous.sets[0])
  const completed = await submit({ ...content, status: 'completed', explicitCompletion: true }, 1)
  assert.equal(completed.status, 200, JSON.stringify(completed.body))
  assert.equal(completed.body.session.content.status, 'completed')
  assert.deepEqual(completed.body.session.content.sets, content.sets)
  const latest = await request(port, path(api + `/members/${memberId}/sessions`), { headers })
  assert.equal(latest.status, 200, JSON.stringify(latest.body))
  assert.deepEqual(
    latest.body.find((record) => record.id === id),
    completed.body.session,
  )
  const issued = await request(port, path(routinePath), { headers })
  assert.equal(issued.status, 200, JSON.stringify(issued.body))
  assert.deepEqual(issued.body.snapshot, snapshot)
  const enrollment = await request(
    port,
    path(api + `/enrollments/${occurrence.enrollmentId}/revisions/1`),
    { headers },
  )
  assert.equal(enrollment.status, 200, JSON.stringify(enrollment.body))
  assert.equal(enrollment.body.enrollment.content.goal, plan.goal)
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
        assert.equal(f.preservation.beforeSha256, f.preservation.afterSha256)
        assert.ok(f.resources.v2.every((r) => r.assigned && r.occurrenceIds.length === 6))
        assert.equal(f.resources.reviewedDuration.length, Object.keys(f.organizations).length)
        const durationFixture = f.resources.reviewedDuration.find(
          (fixture) => fixture.organizationId === 'atlas-demo',
        )
        assert.ok(durationFixture)
        const organization = Object.values(f.organizations).find((item) => item.id === 'atlas-demo')
        assert.equal(
          durationFixture.branchId,
          Object.entries(organization.branches).find(([key]) => key.endsWith('-principal'))[1],
        )
        let durationPlan
        const page = await request(port, path('/app'))
        assert.equal(page.status, 200)
        assert.match(page.body, /<html/)
        for (const suffix of [
          'atlas-superadmin',
          'atlas-assigned-coach',
          'atlas-member',
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
              const memberId = Object.entries(f.actors).find(([key]) =>
                key.endsWith('-atlas-member'),
              )[1].id
              durationPlan = await prescribeReviewedDuration({
                port,
                path,
                api,
                headers: { ...headers, origin, 'content-type': 'application/json' },
                fixture: durationFixture,
                memberId,
              })
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
            } else {
              assert.deepEqual(adaptations, [])
              const scoped = await request(
                port,
                path(api + `/routines/${durationFixture.programId}/versions/1`),
                { headers },
              )
              assert.equal(scoped.status, 404, JSON.stringify(scoped.body))
              const publications = await request(port, path(api + '/routine-publications'), {
                headers,
              })
              assert.equal(publications.status, 200)
              assert.ok(
                !publications.body.some(
                  (item) => item.reference.programId === durationFixture.programId,
                ),
              )
            }
          } else {
            const own = await request(port, path(api + `/members/${actor.id}/continuity`), {
              headers,
            })
            assert.equal(own.status, 200, JSON.stringify(own.body))
            assert.equal(own.body.current.length, 1)
            if (suffix === 'atlas-member') {
              assert.ok(durationPlan)
              await saveReviewedDuration({
                port,
                path,
                api,
                headers: { ...headers, origin, 'content-type': 'application/json' },
                plan: durationPlan,
                memberId: actor.id,
              })
            }
          }
        }
      } finally {
        await harness.close()
      }
    },
  )

test('inactive foundation seed does not create synthetic reviewed-duration resources', async () => {
  const harness = await startProductHarness({
    source,
    mode: 'unified-http',
    offset: 450,
    projectCount: 1,
    env: { ...process.env, B2B_PRODUCT_TEST_ACTIVATE: '0' },
  })
  try {
    const fixture = harness.fixtures[0]
    assert.equal(fixture.featuresActivated, false)
    assert.deepEqual(fixture.resources.reviewedDuration, [])
    assert.equal(fixture.preservation.beforeSha256, fixture.preservation.afterSha256)
    assert.ok(fixture.resources.v2.every((resource) => !resource.assigned))
  } finally {
    await harness.close()
  }
})
