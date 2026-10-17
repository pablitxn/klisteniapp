// Native component regression driver. Full product PROGRAMMING-004/008 remain owned by QA.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { chromium, webkit } from '/harness/node_modules/playwright/index.mjs'
const require = createRequire(import.meta.url)
assert.equal(require('/harness/node_modules/playwright/package.json').version, '1.63.0')
const output = '/tmp/wp07-grid-results'
await mkdir(output, { recursive: true })
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const variant = url.pathname.split('/')[1]
  if (!['baseline', 'fixed'].includes(variant)) { res.writeHead(404).end(); return }
  const asset = url.pathname.split('/')[2]
  if (['probe.js', 'probe.css'].includes(asset)) {
    res.setHeader('Content-Type', asset.endsWith('.js') ? 'text/javascript' : 'text/css')
    res.end(await readFile(`/harness/${variant}/${asset}`)); return
  }
  res.setHeader('Content-Type', 'text/html')
  res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${variant}/probe.css"><body><div id="root"></div><script src="/${variant}/probe.js"></script></body></html>`)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const result = { driver: '1.63.0', node: process.version, uid: process.getuid(), capabilities: readFileSync('/proc/self/status', 'utf8').match(/^CapEff:\s*(.*)$/m)?.[1],
  noNewPrivileges: readFileSync('/proc/self/status', 'utf8').match(/^NoNewPrivs:\s*(.*)$/m)?.[1], network: 'none', chromiumSandbox: true, ignoreHTTPSErrors: false,
  scope: 'Actual editor components with injected typed component dependencies, native controls and unchanged full labels; no product service/auth calls or global security/transport shims', baseline: [], fixed: [] }
async function sizes(page) {
  await page.evaluate(() => scrollTo(10000, 0))
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const value = await page.evaluate(() => ({ innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, actualScrollRange: scrollX,
    secureContext: isSecureContext, nativeCrypto: typeof crypto.randomUUID === 'function',
    documentOverflow: getComputedStyle(document.documentElement).overflowX, bodyOverflow: getComputedStyle(document.body).overflowX,
    mainOverflow: getComputedStyle(document.querySelector('main')).overflowX,
    fields: [...document.querySelectorAll('label')].filter((label) => label.textContent.startsWith('Rutina publicada ·')).map((label) => {
      const select = document.getElementById(label.htmlFor)
      const field = select.parentElement
      return { label: label.textContent, minWidth: getComputedStyle(field).minWidth, fieldContain: getComputedStyle(field).contain, fieldOverflow: getComputedStyle(field).overflowX, selectAppearance: getComputedStyle(select).appearance, fieldClient: field.clientWidth, fieldScroll: field.scrollWidth, selectRect: select.getBoundingClientRect().width,
        selected: select.selectedOptions[0]?.textContent, options: [...select.options].map((option) => ({ value: option.value, text: option.textContent })) }
    }) }))
  await page.evaluate(() => scrollTo(0, 0))
  return value
}
function fits(value) {
  assert.ok(value.document <= value.innerWidth, JSON.stringify(value))
  assert.ok(value.body <= value.innerWidth, JSON.stringify(value))
  assert.equal(value.actualScrollRange, 0)
  for (const property of ['documentOverflow', 'bodyOverflow', 'mainOverflow']) assert.ok(!['hidden', 'clip'].includes(value[property]), `${property} is not clipping`)
  assert.equal(value.secureContext, true)
  assert.equal(value.nativeCrypto, true)
  for (const field of value.fields) { assert.equal(field.minWidth, '0px'); assert.equal(field.fieldOverflow, 'visible'); assert.ok(!field.fieldContain.includes('paint')) }
}
async function ready(page, variant, mode, extra = '') {
  await page.goto(`${base}/${variant}/?mode=${mode}${extra}`)
  await page.getByLabel('Rutina publicada · etapa 1, sesión 1', { exact: true }).waitFor()
}
let baselineBrowser
try {
  baselineBrowser = await webkit.launch()
  for (const mode of ['period', 'goal']) {
    const context = await baselineBrowser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: false })
    const page = await context.newPage(); page.setDefaultTimeout(8000)
    page.on('pageerror', (error) => console.error('Baseline component error:', error.message))
    await ready(page, 'baseline', mode)
    const value = await sizes(page)
    assert.ok(value.document > 320 && value.actualScrollRange > 0, 'The executable baseline must reproduce real overflow')
    result.baseline.push({ engine: 'webkit', version: baselineBrowser.version(), mode, ...value })
    await page.screenshot({ path: join(output, `before-webkit-320-${mode}.png`), fullPage: true })
    await context.close()
  }
} finally { await baselineBrowser?.close() }
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch(engine === 'chromium' ? { chromiumSandbox: true } : {})
  for (const [width, height, touch] of [[320, 740, true], [430, 932, true], [1440, 1000, false]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, ignoreHTTPSErrors: false })
    const page = await context.newPage(); page.setDefaultTimeout(8000)
    const errors = []; page.on('pageerror', (error) => errors.push(error.message))
    const row = { engine, version: browser.version(), width, height, touch, checks: [], measurements: [], screenshots: [] }; result.fixed.push(row)
    const check = async (name, run) => {
      try { await run(); row.checks.push({ name, status: 'passed' }) }
      catch (error) { row.checks.push({ name, status: 'failed', error: String(error) }); await page.screenshot({ path: join(output, `${engine}-${width}-failure-${row.checks.length}.png`), fullPage: true }) }
    }
    await check('period: original full option list, native weekday/date/routine controls and reviewed apply', async () => {
      await ready(page, 'fixed', 'period')
      let value = await sizes(page); fits(value); row.measurements.push({ state: 'period-initial', ...value })
      assert.ok(value.fields[0].selected.includes('WP12 20256214-75e7-46e4-bd4b-c85e5157c58d'))
      const initialOptions = value.fields[0].options
      assert.ok(initialOptions.some((option) => option.text === 'SYNTHETIC TEST ONLY: repetitions-to-duration prescription · v1'))
      await page.getByLabel('Día · etapa 1, sesión 1', { exact: true }).selectOption('2')
      const end = page.getByLabel('Fin inclusive · etapa 1', { exact: true }); await end.focus(); await end.fill('2026-04-20'); await end.press('Tab')
      const routine = page.getByLabel('Rutina publicada · etapa 1, sesión 1', { exact: true })
      await routine.selectOption({ label: 'Inicio · fuerza y técnica · v1' }); await routine.selectOption({ label: initialOptions.find((option) => option.text.startsWith('WP12 20256214')).text })
      assert.deepEqual((await sizes(page)).fields[0].options, initialOptions)
      await page.getByRole('button', { name: 'Consultar impacto antes de aplicar', exact: true }).click()
      await page.getByText('Registros conservados: unchanged-original-session', { exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Aplicar períodos revisados', exact: true }).isDisabled(), true)
      await page.getByRole('checkbox', { name: 'Revisé el impacto y confirmo aplicar estos períodos.', exact: true }).check()
      await page.getByRole('button', { name: 'Aplicar períodos revisados', exact: true }).click()
      await page.waitForFunction(() => window.programmingGridFixture.state().applied === 1)
      const state = await page.evaluate(() => window.programmingGridFixture.state())
      const input = state.calls.find((call) => call.key === 'applyPeriod').input
      assert.equal(input.expectedRevision, 2); assert.equal(input.previewHash, 'a'.repeat(64)); assert.equal(input.proposed.stages[0].slots[0].weekday, 2)
      assert.equal(state.linkedSession, 'unchanged-original-session')
      await page.getByRole('button', { name: 'Ver quién cambió qué y cuándo', exact: true }).click()
      await page.getByText('synthetic-coach', { exact: false }).waitFor()
      assert.ok((await page.getByText('Revisión 2 → 3', { exact: false }).textContent()).includes('stages'))
      value = await sizes(page); fits(value); row.measurements.push({ state: 'period-applied-and-audit', ...value })
      const name = `${engine}-${width}-period-applied.png`; await page.screenshot({ path: join(output, name), fullPage: true }); row.screenshots.push(name)
    })
    await check('goal: two-stage incomplete dates and overlap remain rejected; valid gap saves and enrolls', async () => {
      await ready(page, 'fixed', 'goal')
      let value = await sizes(page); fits(value); row.measurements.push({ state: 'goal-incomplete-two-stage', ...value })
      assert.equal(await page.getByLabel('Fin inclusive · etapa 2', { exact: true }).inputValue(), '')
      const confirm = () => page.getByRole('checkbox', { name: /^Confirmo fechas, sesiones y zona horaria/ })
      await confirm().check(); await page.getByRole('button', { name: 'Asignar programa completo', exact: true }).click()
      await page.getByText('stages → 1 → endDate', { exact: false }).waitFor()
      assert.equal((await page.evaluate(() => window.programmingGridFixture.state())).calls.length, 0)
      await page.getByLabel('Inicio · etapa 2', { exact: true }).fill('2026-04-19')
      await page.getByLabel('Fin inclusive · etapa 2', { exact: true }).fill('2026-04-23')
      await confirm().check(); await page.getByRole('button', { name: 'Asignar programa completo', exact: true }).click()
      await page.getByText('sequential and nonoverlapping', { exact: false }).waitFor()
      assert.equal((await page.evaluate(() => window.programmingGridFixture.state())).calls.length, 0)
      await page.getByLabel('Inicio · etapa 2', { exact: true }).fill('2026-04-22')
      await page.getByRole('button', { name: 'Guardar programa incompleto', exact: true }).click()
      await page.waitForFunction(() => window.programmingGridFixture.state().saved === 1)
      await confirm().check(); await page.getByRole('button', { name: 'Asignar programa completo', exact: true }).click()
      await page.waitForFunction(() => window.programmingGridFixture.state().enrolled === 1)
      const state = await page.evaluate(() => window.programmingGridFixture.state())
      assert.equal(state.calls.filter((call) => call.key === 'enroll').length, 1)
      const input = state.calls.find((call) => call.key === 'enroll').input
      assert.equal(input.content.stages[1].startDate, '2026-04-22'); assert.equal(input.content.timeZone, 'UTC')
      value = await sizes(page); fits(value); row.measurements.push({ state: 'goal-valid-gap-enrolled', ...value })
      const name = `${engine}-${width}-goal-enrolled.png`; await page.screenshot({ path: join(output, name), fullPage: true }); row.screenshots.push(name)
    })
    for (const mode of ['period', 'goal']) await check(`${mode}: preserved-version fallback and full 150-character publication fit`, async () => {
      await ready(page, 'fixed', mode, '&preserved=1&long=1')
      let value = await sizes(page); fits(value); row.measurements.push({ state: `${mode}-preserved`, ...value })
      assert.equal(value.fields[0].selected, 'Versión conservada: 20256214-75e7-46e4-bd4b-c85e5157c58d v1')
      const longName = await page.evaluate(() => window.programmingGridFixture.longName)
      assert.equal(longName.length, 150)
      await page.getByLabel('Rutina publicada · etapa 1, sesión 1', { exact: true }).selectOption({ label: `${longName} · v1` })
      value = await sizes(page); fits(value); row.measurements.push({ state: `${mode}-maximum-publication`, ...value })
      assert.equal(value.fields[0].selected, `${longName} · v1`)
      assert.equal((await page.evaluate(() => window.programmingGridFixture.state())).calls.length, 0)
    })
    await check('labels and native focus remain intact with no unhandled component errors', async () => {
      const labeled = await page.locator('label[for]').evaluateAll((labels) => labels.every((label) => Boolean(document.getElementById(label.htmlFor))))
      assert.equal(labeled, true)
      const control = page.getByLabel('Rutina publicada · etapa 1, sesión 1', { exact: true }); await control.focus(); await control.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'BUTTON')
      assert.deepEqual(errors, [])
    })
    await context.close()
  }
  await browser.close()
}
await new Promise((resolve) => server.close(resolve))
result.passed = result.fixed.flatMap((row) => row.checks).filter((check) => check.status === 'passed').length
result.failed = result.fixed.flatMap((row) => row.checks).filter((check) => check.status === 'failed').length
result.skipped = 0
await writeFile(join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ before: result.baseline.map(({ mode, document, actualScrollRange }) => ({ mode, document, actualScrollRange })), profiles: result.fixed.length, passed: result.passed, failed: result.failed, skipped: result.skipped }))
if (result.failed) process.exitCode = 1
