import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeReport, validateDiscovery } from './report-validation.mjs'

const inventory = {
  engines: ['chromium', 'webkit'],
  viewports: [{ width: 320, height: 740, touch: true }, { width: 430, height: 932, touch: true }, { width: 1440, height: 1000, touch: false }],
  scenarios: [{ id: 'B2BP-SYNC-001', layer: 'browser' }],
}
function discovery() {
  const projects = inventory.engines.flatMap((engine) => inventory.viewports.map((view) => ({
    name: `${engine}-${view.width}`, metadata: { b2bProduct: { mode: 'unified-http', engine, ...view } },
  })))
  return {
    config: { projects },
    suites: [{ suites: [{ specs: [{ title: 'B2BP-SYNC-001 preserve an operation', tests: projects.map((project) => ({
      projectName: project.name, results: [],
    })) }] }] }],
  }
}
function report(...statuses) {
  return { suites: [{ specs: statuses.map((status, index) => ({
    title: `B2BP-SYNC-00${index + 1} synthetic collector case`,
    tests: [{ projectName: 'project', results: status.map((value) => ({ status: value })) }],
  })) }] }
}

test('collector requires the full six-project discovery without missing IDs', () => {
  assert.equal(validateDiscovery(discovery(), inventory, 'unified-http').size, 6)
  const missing = discovery()
  missing.suites[0].suites[0].specs[0].tests.pop()
  assert.throws(() => validateDiscovery(missing, inventory, 'unified-http'), /exactly once/)
})
test('collector rejects duplicate project names, duplicate cells and wrong mode/viewport', () => {
  const names = discovery()
  names.config.projects[1].name = names.config.projects[0].name
  assert.throws(() => validateDiscovery(names, inventory, 'unified-http'), /distinct names/)
  const cells = discovery()
  cells.suites[0].suites[0].specs[0].tests[1].projectName = cells.config.projects[0].name
  assert.throws(() => validateDiscovery(cells, inventory, 'unified-http'), /exactly once/)
  assert.throws(() => validateDiscovery(discovery(), inventory, 'white-label-http'), /metadata/)
  const viewport = discovery()
  viewport.config.projects[0].metadata.b2bProduct.width = 360
  assert.throws(() => validateDiscovery(viewport, inventory, 'unified-http'), /metadata/)
})
test('collector rejects discovery errors even if every case is listed', () => {
  assert.throws(() => validateDiscovery({ ...discovery(), errors: [{}] }, inventory, 'unified-http'), /discovery errors/)
})
test('collector keeps passes, failures, skipped and undiscovered cells separate', () => {
  const expected = new Set([1, 2, 3, 4].map((n) => `project:B2BP-SYNC-00${n}`))
  assert.deepEqual(summarizeReport(report(['passed'], ['failed'], ['skipped']), expected), {
    passed: 1, failed: 1, skipped: 1, blocked: 1, problems: [],
  })
})
test('collector cannot turn a flaky retry, timeout, interruption or empty result into a pass', () => {
  const expected = new Set([1, 2, 3, 4].map((n) => `project:B2BP-SYNC-00${n}`))
  assert.deepEqual(summarizeReport(report(['failed', 'passed'], ['timedOut'], ['interrupted'], []), expected), {
    passed: 0, failed: 3, skipped: 1, blocked: 0, problems: [],
  })
})
test('collector flags extra/repeated cells and global errors instead of ignoring them', () => {
  const duplicate = report(['passed'])
  duplicate.suites[0].specs.push(duplicate.suites[0].specs[0])
  assert.equal(summarizeReport(duplicate, new Set(['project:B2BP-SYNC-001'])).problems.length, 1)
  assert.equal(summarizeReport(report(['passed']), new Set()).problems.length, 1)
  assert.equal(summarizeReport({ ...report(['passed']), errors: [{}] }, new Set(['project:B2BP-SYNC-001'])).problems.length, 1)
})
