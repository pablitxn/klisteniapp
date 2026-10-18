export function collectCases(report) {
  const output = []
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      const id = spec.title.match(/^B2BP-[A-Z]+-\d{3}\b/)?.[0]
      for (const test of spec.tests) output.push({ key: `${test.projectName}:${id}`, test })
    }
    for (const child of suite.suites ?? []) visit(child)
  }
  for (const suite of report.suites ?? []) visit(suite)
  return output
}

export function validateDiscovery(report, inventory, mode) {
  const projects = report.config.projects
  const matrix = new Set()
  const expected = new Set()
  const scenarios = inventory.scenarios.filter((item) => item.layer === 'browser')
  for (const project of projects) {
    const meta = project.metadata?.b2bProduct
    if (!meta || meta.mode !== mode || !inventory.engines.includes(meta.engine) ||
        !inventory.viewports.some((view) => view.width === meta.width && view.height === meta.height && view.touch === meta.touch)) {
      throw new Error('Every project needs truthful b2bProduct metadata for mode/engine/width/height/touch')
    }
    matrix.add(`${meta.engine}:${meta.width}:${meta.height}`)
    for (const scenario of scenarios) expected.add(`${project.name}:${scenario.id}`)
  }
  if (projects.length !== 6 || matrix.size !== 6 || expected.size !== scenarios.length * 6) {
    throw new Error('Config must discover exactly the six required engine/viewport projects with distinct names')
  }
  const discovered = collectCases(report)
  if (report.errors?.length || discovered.length !== expected.size ||
      new Set(discovered.map((item) => item.key)).size !== expected.size ||
      discovered.some((item) => !expected.has(item.key))) {
    throw new Error('Scenario IDs must be discovered exactly once in every matrix project without discovery errors')
  }
  return expected
}

export function summarizeReport(report, expected) {
  const summary = { passed: 0, failed: 0, skipped: 0, blocked: expected.size, problems: [] }
  const seen = new Set()
  for (const item of collectCases(report)) {
    if (!expected.has(item.key) || seen.has(item.key)) {
      summary.problems.push('Unknown or repeated scenario/project cell')
      continue
    }
    seen.add(item.key)
    summary.blocked--
    const statuses = (item.test.results ?? []).map((result) => result.status)
    if (!statuses.length || statuses.every((status) => status === 'skipped')) summary.skipped++
    else if (statuses.length === 1 && statuses[0] === 'passed') summary.passed++
    else summary.failed++
  }
  if (report.errors?.length) summary.problems.push('Playwright reported a global error')
  return summary
}
