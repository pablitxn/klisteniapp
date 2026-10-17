/** Final-wave runner. No config/seed mutation and no fallback to another browser. */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeReport, validateDiscovery } from './report-validation.mjs'

const root = fileURLToPath(new URL('../../../../..', import.meta.url))
const inventory = JSON.parse(readFileSync(new URL('./scenarios.json', import.meta.url), 'utf8'))
const scenarios = inventory.scenarios.filter((item) => item.layer === 'browser')
const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const separator = arg.indexOf('=')
  if (!arg.startsWith('--') || separator < 3) throw new Error('Use --name=value arguments')
  return [arg.slice(2, separator), arg.slice(separator + 1)]
}))
const output = resolve(options.output ?? `/tmp/wp12-browser-${process.pid}`)
if (!output.startsWith('/tmp/')) throw new Error('Evidence output must be a fresh task directory under /tmp')
if (existsSync(output)) throw new Error('Refusing to overwrite earlier evidence')
mkdirSync(output, { recursive: true })
const command = (cmd, args, env = process.env) => spawnSync(cmd, args, {
  cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
})
const git = (...args) => {
  const result = command('git', args)
  if (result.status !== 0) throw new Error('Cannot resolve tested Git revision')
  return result.stdout.trim()
}
const head = git('rev-parse', 'HEAD')
const receipt = {
  phase: 'final-browser', testedSha: head, planSha: inventory.planSha,
  mode: options.mode ?? null, config: options.config ?? null,
  startedAt: new Date().toISOString(), status: 'blocked', blockers: [],
  scenarios: scenarios.length, expectedCells: scenarios.length * 6,
  passed: 0, failed: 0, skipped: 0, blocked: scenarios.length * 6,
}
const save = () => writeFileSync(`${output}/receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`)
function block(reason) {
  receipt.blockers.push(reason)
  save()
  console.error(`BLOCKED: ${reason}; evidence ${output}/receipt.json`)
  process.exit(2)
}
const redact = (text) => String(text)
  .replaceAll(process.env.B2B_TEST_DATABASE_URL ?? '__UNSET_DATABASE__', '[test database]')
  .replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[test database]')
const writeSanitized = (path, value) => writeFileSync(path, redact(value))
if (!/^[a-f0-9]{40}$/.test(options['accepted-head'] ?? '') || options['accepted-head'] !== head) {
  block('Supply the parent-accepted immutable --accepted-head matching this checkout')
}
if (git('status', '--porcelain')) block('Final acceptance requires a clean committed checkout')
if (!inventory.modes.includes(options.mode)) block('Supply an inventory --mode')
if (!/^playwright\.[a-z0-9.-]+\.config\.ts$/.test(options.config ?? '')) {
  block('Supply the INTEGRATION-owned --config filename')
}
if (!existsSync(`${root}/apps/b2c-web/${options.config}`)) block('Accepted config is absent')
if (!options.dependencies || !existsSync(options.dependencies)) block('Supply --dependencies=/tmp/parent-accepted-dependencies.json')
const dependencies = JSON.parse(readFileSync(options.dependencies, 'utf8'))
for (const owner of Array.from({ length: 12 }, (_, index) => `WP${String(index).padStart(2, '0')}`).concat('WP13')) {
  const sha = dependencies[owner]
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) block(`Missing parent-accepted ${owner} SHA`)
  if (command('git', ['merge-base', '--is-ancestor', sha, head]).status !== 0) {
    block(`${owner} is not an ancestor of tested head; parent must reconcile inputs`)
  }
}
receipt.dependencies = dependencies
let database
try { database = new URL(process.env.B2B_TEST_DATABASE_URL) } catch { block('Set task-owned B2B_TEST_DATABASE_URL without printing its value') }
if (!['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
    !/(b2b.*test|test.*b2b)/i.test(decodeURIComponent(database.pathname)) || database.searchParams.has('options')) {
  block('Only a dedicated loopback b2b/test database with runner-owned schemas is allowed')
}
if (command('pnpm', ['--version']).stdout.trim() !== '12.7.0') block('Activate the supported pnpm 12.7.0 environment')
const files = [...new Set(scenarios.map((item) => item.target))]
const missing = files.filter((path) => !existsSync(`${root}/${path}`))
if (missing.length) block(`Executable feature specs are absent: ${missing.map((path) => path.split('/').at(-1)).join(', ')}`)
const args = ['--filter', '@klisteniapp/b2c-web', 'exec', 'playwright', 'test', '--config', options.config,
  ...files.map((path) => path.split('/').at(-1))]
const discoveryPath = `${output}/discovery.json`
const discovery = command('pnpm', [...args, '--list', '--reporter=json'], {
  ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: discoveryPath,
})
writeSanitized(`${output}/discovery.log`, discovery.stdout + discovery.stderr)
if (discovery.status !== 0 || !existsSync(discoveryPath)) block('Playwright discovery failed; no browser pass recorded')
const parse = (path) => {
  const text = redact(readFileSync(path, 'utf8'))
  writeFileSync(path, text)
  return JSON.parse(text)
}
const listed = parse(discoveryPath)
let expected
try { expected = validateDiscovery(listed, inventory, options.mode) } catch (error) { block(error.message) }
const resultPath = `${output}/playwright.json`
const run = command('pnpm', [...args, '--reporter=json,list', '--output', `${output}/artifacts`], {
  ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: resultPath,
})
writeSanitized(`${output}/run.log`, run.stdout + run.stderr)
if (!existsSync(resultPath)) block('No completed Playwright JSON report; execution aborted')
const report = parse(resultPath)
const { problems, ...counts } = summarizeReport(report, expected)
Object.assign(receipt, counts)
receipt.blockers.push(...problems)
receipt.finishedAt = new Date().toISOString()
receipt.status = run.status === 0 && !receipt.failed && !receipt.skipped && !receipt.blocked &&
  !receipt.blockers.length && !report.errors?.length ? 'passed' : 'failed'
receipt.exitCode = run.status
receipt.scope = 'This mode and immutable head only; no physical/provider/release or historical count claim'
save()
console.log(JSON.stringify(receipt))
process.exitCode = receipt.status === 'passed' ? 0 : 1
