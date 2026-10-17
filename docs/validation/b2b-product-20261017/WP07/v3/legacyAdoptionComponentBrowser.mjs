// Dedicated component checks only. QA owns integrated product browser specs/fixtures.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, extname, resolve } from 'node:path'
import { chromium, webkit } from '/harness/node_modules/playwright/index.mjs'
const require = createRequire(import.meta.url)
assert.equal(require('/harness/node_modules/playwright/package.json').version, '1.63.0')
assert.equal(require('/harness/node_modules/playwright-core/package.json').version, '1.63.0')
const output = '/tmp/wp07-adoption-component-results'
await mkdir(output, { recursive: true })
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  const selected = resolve('/harness/dist', path === '/' ? 'tests/legacyAdoptionHarness.html' : `.${path}`)
  if (!selected.startsWith('/harness/dist/')) { response.writeHead(404).end(); return }
  try {
    const content = await readFile(selected)
    response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(selected)] ?? 'application/octet-stream' })
    response.end(content)
  } catch { response.writeHead(404).end() }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const baseURL = `http://127.0.0.1:${server.address().port}`
const results = { node: process.version, playwright: '1.63.0', scope: 'Bundled component with frozen client and synthetic fetch; no product API/DB navigation',
  security: { uid: process.getuid(), capabilities: readFileSync('/proc/self/status', 'utf8').match(/^CapEff:\s*(.*)$/m)?.[1], noNewPrivileges: readFileSync('/proc/self/status', 'utf8').match(/^NoNewPrivs:\s*(.*)$/m)?.[1], network: 'none', ignoreHTTPSErrors: false, chromiumSandbox: true }, matrix: [] }
const wait = async (page, predicate) => page.waitForFunction(predicate)
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]].filter(([name]) => !process.env.COMPONENT_ENGINE || process.env.COMPONENT_ENGINE === name)) {
  const browser = await type.launch({ ...(engine === 'chromium' ? { chromiumSandbox: true } : {}) })
  for (const [width, height, touch] of [[320, 740, true], [430, 932, true], [1440, 1000, false]].filter(([width]) => !process.env.COMPONENT_WIDTH || process.env.COMPONENT_WIDTH === String(width))) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, ignoreHTTPSErrors: false })
    const page = await context.newPage()
    page.setDefaultTimeout(8000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const row = { engine, browserVersion: browser.version(), width, height, touch, groups: [], screenshots: [] }
    results.matrix.push(row)
    const group = async (name, run) => {
      try { await run(); row.groups.push({ name, status: 'passed' }) }
      catch (error) {
        const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((node) => node.getBoundingClientRect().width > 0 && (node.getBoundingClientRect().right > innerWidth + .5 || node.scrollWidth > node.clientWidth + 1)).slice(-30).map((node) => ({ tag: node.tagName, className: node.className, text: node.textContent?.slice(0, 80), width: node.getBoundingClientRect().width, scroll: node.scrollWidth, client: node.clientWidth, right: node.getBoundingClientRect().right, minWidth: getComputedStyle(node).minWidth })))
        const diagnosis = await page.evaluate(() => {
          const changes = [
            ['outline', '* { outline: none !important }'],
            ['native appearance', 'select,input { appearance: none !important; -webkit-appearance: none !important }'],
            ['number spinners', 'input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none !important; display: none !important }'],
            ['details marker', 'summary { list-style: none !important } summary::-webkit-details-marker { display: none !important }'],
            ['legend', 'legend { display: none !important }'],
          ]
          return changes.map(([label, css]) => { const style=document.createElement('style'); style.textContent=css; document.head.append(style); const width=document.documentElement.scrollWidth; style.remove(); return { label, width } })
        })
        row.groups.push({ name, status: 'failed', error: String(error), overflow, diagnosis, sizes: await page.evaluate(() => ({ innerWidth, document: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, body: document.body.scrollWidth, viewport: visualViewport?.width, left: window.scrollX, rightmost: Math.max(...[...document.querySelectorAll('body *')].map((node) => node.getBoundingClientRect().right)) })) })
        const filename = `${engine}-${width}-failure.png`
        await page.screenshot({ path: join(output, filename), fullPage: true }); row.screenshots.push(filename)
      }
    }
    async function open(mode = 'normal') {
      await page.goto(baseURL)
      await wait(page, () => Boolean(window.legacyAdoptionHarness))
      await page.evaluate((mode) => window.legacyAdoptionHarness.reset(mode), mode)
      await page.getByLabel('Persona de esta sede').selectOption('member')
      await page.getByRole('button', { name: 'Revisar esta asignación de Legacy routine', exact: true }).click()
      if (mode !== 'wrong-preview') await page.getByRole('heading', { name: 'Revisar una rutina anterior', exact: true }).waitFor()
    }
    async function complete({ sourcePolicy = 'reviewed', external = false } = {}) {
      const load = page.getByLabel('Carga a confirmar · movimiento 1', { exact: true })
      await load.selectOption(external ? 'external' : 'bodyweight')
      if (external) {
        const kg = page.getByLabel('Carga externa a confirmar (kg) · movimiento 1', { exact: true })
        await kg.focus(); await kg.fill('0'); await kg.press('Tab')
      }
      for (const index of [1, 2]) await page.getByLabel(`Lados y conteo a confirmar · movimiento ${index}`, { exact: true }).selectOption('bilateral')
      await page.getByLabel('Alternativas en esta versión · movimiento 1', { exact: true }).selectOption(sourcePolicy)
      await page.getByLabel('Alternativas en esta versión · movimiento 2', { exact: true }).selectOption('blocked')
      if (sourcePolicy === 'reviewed') {
        await page.getByRole('checkbox', { name: 'Confirmo la dosis propia y todas las condiciones de Timed target para este origen.', exact: true }).check()
        await page.getByRole('checkbox', { name: 'Confirmo la dosis propia y todas las condiciones de Repetition target para este origen.', exact: true }).check()
      }
      await page.getByRole('checkbox', { name: /^Confirmo las dosis originales y las decisiones explícitas/ }).check()
      await page.getByRole('checkbox', { name: /^Entiendo que esta revisión se aplica a todas las personas/ }).check()
    }
    const save = () => page.getByRole('button', { name: 'Guardar revisión explícita de esta versión', exact: true })
    await group('labels, keyboard number input, no default confirmations, hashes and responsive layout', async () => {
      await open()
      assert.equal(await save().isDisabled(), true)
      assert.equal(await page.getByLabel('Carga a confirmar · movimiento 1', { exact: true }).inputValue(), '')
      assert.equal(await page.getByLabel('Lados y conteo a confirmar · movimiento 2', { exact: true }).inputValue(), '')
      await complete({ external: true })
      assert.equal(await save().isEnabled(), true)
      for (const summary of await page.locator('summary').all()) await summary.click()
      assert.ok((await page.locator('code').allTextContents()).includes('4'.repeat(64)))
      assert.ok((await page.locator('code').allTextContents()).includes('6'.repeat(64)))
      assert.ok((await page.getByText('manual-variant', { exact: false }).textContent()).includes('No acreditan relaciones revisadas'))
      const labels = await page.locator('label[for]').evaluateAll((labels) => labels.every((label) => Boolean(document.getElementById(label.htmlFor))))
      assert.equal(labels, true)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow')
      const controls = await page.locator('button, select, input:not([type=checkbox])').evaluateAll((nodes) => nodes.filter((node) => node.getBoundingClientRect().height > 0).every((node) => node.getBoundingClientRect().height >= 44))
      assert.equal(controls, true)
      const filename = `${engine}-${width}-review.png`
      await page.screenshot({ path: join(output, filename), fullPage: true }); row.screenshots.push(filename)
    })
    await group('explicit adoption preserves source and refreshes actual version data', async () => {
      await open(); await complete(); await save().click()
      await page.getByRole('heading', { name: 'Esta versión ya tiene una revisión explícita' }).waitFor()
      await wait(page, () => window.legacyAdoptionHarness.state().refreshedVersion === 1 && window.legacyAdoptionHarness.state().refreshedSupplement === 1)
      const state = await page.evaluate(() => window.legacyAdoptionHarness.state())
      assert.equal(state.accepted, 1); assert.equal(state.originalUnchanged, true)
      assert.equal(state.posts[0].sourceSteps[1].dose.load.kilograms.value, 0)
      assert.deepEqual(state.posts[0].targetConfirmations.map((c) => c.relationHash), ['4'.repeat(64), '6'.repeat(64)])
    })
    await group('conflict refresh displays changed target dose/hash and requires every confirmation again', async () => {
      await open('conflict'); await complete(); await save().click()
      await wait(page, () => window.legacyAdoptionHarness.state().previews >= 2)
      await page.getByRole('heading', { name: 'Revisar una rutina anterior', exact: true }).waitFor()
      assert.equal(await page.getByLabel('Carga a confirmar · movimiento 1', { exact: true }).inputValue(), '')
      assert.equal(await save().isDisabled(), true)
      assert.equal(await page.getByRole('checkbox', { name: /^Entiendo que esta revisión/ }).isChecked(), false)
      await complete(); await save().click()
      await page.getByRole('heading', { name: 'Esta versión ya tiene una revisión explícita' }).waitFor()
      const state = await page.evaluate(() => window.legacyAdoptionHarness.state())
      assert.notEqual(state.posts[0].operationId, state.posts[1].operationId)
      assert.equal(state.posts[1].targetConfirmations[0].relationHash, '8'.repeat(64))
    })
    for (const mode of ['server-error', 'lost-response']) await group(`${mode} keeps exact retry operation and never duplicates acceptance`, async () => {
      await open(mode); await complete(); await save().click()
      await page.getByRole('alert').waitFor()
      assert.equal(await save().isEnabled(), true)
      await save().click()
      await page.getByRole('heading', { name: 'Esta versión ya tiene una revisión explícita' }).waitFor()
      const state = await page.evaluate(() => window.legacyAdoptionHarness.state())
      assert.deepEqual(state.posts[0], state.posts[1]); assert.equal(state.accepted, 1)
    })
    for (const mode of ['revoked', 'refresh-revoked']) await group(`${mode} hides source/targets and permits no second adoption`, async () => {
      await open(mode); await complete(); await save().click()
      await page.getByText('El acceso cambió. Ocultamos la revisión anterior.', { exact: false }).waitFor()
      assert.equal(await page.getByText('Original source notes', { exact: false }).count(), 0)
      assert.equal(await save().count(), 0)
    })
    await group('already adopted version never silently readopts', async () => {
      await page.goto(baseURL); await wait(page, () => Boolean(window.legacyAdoptionHarness))
      await page.evaluate(() => window.legacyAdoptionHarness.reset('existing'))
      await page.getByLabel('Persona de esta sede').selectOption('member')
      await page.getByRole('button', { name: 'Revisar esta asignación de Legacy routine', exact: true }).click()
      await page.getByRole('heading', { name: 'Esta versión ya tiene una revisión explícita' }).waitFor()
      assert.equal((await page.evaluate(() => window.legacyAdoptionHarness.state())).posts.length, 0)
      assert.equal(await save().count(), 0)
    })
    await group('foreign preview never renders protected original data', async () => {
      await open('wrong-preview')
      await page.getByRole('alert').waitFor()
      assert.equal(await page.getByRole('heading', { name: 'Revisar una rutina anterior', exact: true }).count(), 0)
    })
    await group('scope lifetime abort clears prior data immediately', async () => {
      await open(); await page.evaluate(() => window.legacyAdoptionHarness.revoke())
      await page.getByRole('alert').waitFor()
      assert.equal(await page.getByText('Original source notes', { exact: false }).count(), 0)
      assert.equal(await save().count(), 0)
    })
    await group('explicit blocked policy suppresses targets and changing it clears confirmations', async () => {
      await open(); await complete()
      await page.getByLabel('Alternativas en esta versión · movimiento 1', { exact: true }).selectOption('blocked')
      assert.equal(await page.getByRole('checkbox', { name: /^Confirmo la dosis propia y todas las condiciones/ }).count(), 0)
      assert.equal(await save().isDisabled(), true)
      await page.getByRole('checkbox', { name: /^Confirmo las dosis originales/ }).check()
      await page.getByRole('checkbox', { name: /^Entiendo que esta revisión/ }).check()
      await save().click(); await page.getByRole('heading', { name: 'Esta versión ya tiene una revisión explícita' }).waitFor()
      assert.deepEqual((await page.evaluate(() => window.legacyAdoptionHarness.state())).posts[0].targetConfirmations, [])
    })
    await group('no unhandled component page errors', async () => assert.deepEqual(errors, []))
    await context.close()
  }
  await browser.close()
}
await new Promise((resolve) => server.close(resolve))
results.passed = results.matrix.flatMap((m) => m.groups).filter((g) => g.status === 'passed').length
results.failed = results.matrix.flatMap((m) => m.groups).filter((g) => g.status === 'failed').length
results.skipped = 0
await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results))
if (results.failed) process.exitCode = 1
