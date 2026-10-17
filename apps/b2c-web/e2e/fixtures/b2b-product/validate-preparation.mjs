import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildTopology } from './topology.ts'

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const inventory = read('./scenarios.json')
const ids = inventory.scenarios.map((scenario) => scenario.id)
assert.equal(new Set(ids).size, ids.length, 'Scenario IDs must be unique')
for (const scenario of inventory.scenarios) {
  assert.match(scenario.id, /^B2BP-[A-Z]+-\d{3}$/)
  assert.ok(scenario.testTitle.startsWith(`${scenario.id} `))
  assert.ok(scenario.packages.length && scenario.contracts.length && scenario.assertion)
  assert.equal(scenario.state, 'blocked', 'Preparation must not claim product acceptance')
  if (scenario.layer === 'browser') {
    assert.match(scenario.target, /^apps\/b2c-web\/e2e\/b2b-product-[a-z]+\.spec\.ts$/)
  }
}
for (let n = 0; n <= 15; n++) {
  const id = `WP${String(n).padStart(2, '0')}`
  assert.ok(inventory.scenarios.some((scenario) => scenario.packages.includes(id)), id)
}
for (let n = 1; n <= 8; n++) {
  assert.ok(inventory.scenarios.some((scenario) => scenario.contracts.includes(`C0${n}`)))
}
const topology = buildTopology('validation')
assert.equal(topology.brands.length, 2)
assert.equal(topology.brands.flatMap((brand) => brand.branches).length, 4)
const actorKeys = topology.actors.map((actor) => actor.key)
assert.equal(new Set(actorKeys).size, actorKeys.length)
assert.ok(topology.actors.every((actor) => actor.email.endsWith('@example.test')))
assert.ok(topology.coachAssignments.every((assignment) =>
  actorKeys.includes(assignment.coachKey) && actorKeys.includes(assignment.memberKey)))
for (const actor of topology.actors.filter((actor) => actor.key.endsWith('-cover-coach'))) {
  assert.ok(!topology.coachAssignments.some((assignment) => assignment.coachKey === actor.key))
}
assert.ok(topology.actors.some((actor) => actor.memberships.length === 2 &&
  !actor.memberships[0].active && actor.memberships[1].active))
assert.equal(topology.initialHealthSharing, 'none')
assert.equal(topology.providerConnections.length, 0)
assert.throws(() => buildTopology('../unsafe'))
const second = buildTopology('other')
assert.ok(second.actors.every((actor) => !actorKeys.includes(actor.key)))
const calendar = read('./calendar.json')
for (const week of calendar.dstWeeks) {
  assert.equal((Date.parse(week.endExclusiveInstant) - Date.parse(week.startInstant)) / 3600000, week.hours)
  const dateInZone = (instant) => new Intl.DateTimeFormat('en-CA', {
    timeZone: week.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(instant))
  assert.equal(dateInZone(week.startInstant), week.monday)
  assert.equal(dateInZone(week.endExclusiveInstant), week.nextMonday)
}
assert.equal(calendar.fourThreeOne.obligations.length, 4)
assert.equal(calendar.fourThreeOne.obligations.filter((item) => item.intent === 'explicit-completed').length, 3)
assert.equal(calendar.fourThreeOne.expectedClosed.missed, 1)
console.log(JSON.stringify({
  check: 'preparation-integrity-only',
  scenarios: ids.length,
  browserScenariosBlocked: inventory.scenarios.filter((scenario) => scenario.layer === 'browser').length,
  brands: topology.brands.length,
  branches: topology.brands.flatMap((brand) => brand.branches).length,
  actors: topology.actors.length,
  productTestsExecuted: 0,
}))
