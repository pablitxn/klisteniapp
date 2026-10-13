// Static, local UI audit. axe is installed separately so this QA harness does
// not change the app's dependency graph. No credentials or account operations.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, webkit } from '../apps/b2c-web/node_modules/@playwright/test/index.mjs'

if (!process.env.VISITOR_AXE_PATH) throw new Error('Set VISITOR_AXE_PATH to an installed axe-core/axe.min.js')
const axe = await readFile(process.env.VISITOR_AXE_PATH, 'utf8')
const output = resolve(process.env.VISITOR_A11Y_OUTPUT ?? 'artifacts/visitor-qa/accessibility')
await mkdir(output, { recursive: true })
const result = []
for (const [engine, browserType, executablePath] of [
  ['chromium', chromium, process.env.VISITOR_CHROMIUM_PATH],
  ['webkit', webkit, process.env.VISITOR_WEBKIT_PATH],
]) {
  const browser = await browserType.launch(executablePath ? { executablePath } : {})
  try {
    for (const width of [320, 430, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 932 }, hasTouch: width < 768, isMobile: width < 768, reducedMotion: 'reduce' })
      try {
        const page = await context.newPage()
        await page.route('**/models/*.glb', route => route.abort())
        await page.goto(process.env.VISITOR_URL ?? 'http://127.0.0.1:4174')
        await page.locator('.local-badge').waitFor({ state: 'attached' })
        const audit = async name => {
          await page.addScriptTag({ content: axe })
          const data = await page.evaluate(async () => {
            const report = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
            return { violations: report.violations.map(item => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })), incomplete: report.incomplete.map(item => ({ id: item.id, count: item.nodes.length })) }
          })
          await page.screenshot({ path: resolve(output, `${engine}-${width}-${name}.png`), fullPage: true })
          result.push({ engine, version: browser.version(), width, name, ...data })
          console.log(engine, width, name, data.violations.map(item => item.id).join(',') || 'PASS')
        }
        const nav = page.getByRole('navigation', { name: width < 768 ? 'Navegación móvil' : 'Navegación principal', exact: true })
        for (const [name, label] of [['routine', 'Mi rutina'], ['library', 'Ejercicios'], ['anatomy', 'Mi cuerpo'], ['progress', 'Mi progreso'], ['health', 'Mi salud'], ['yoga', 'Yoga']]) {
          await nav.getByRole('button', { name: label, exact: true }).click()
          if (name === 'yoga') await page.locator('.yoga-asana-card').first().waitFor()
          if (name === 'health') await page.locator('.health-tabs').waitFor()
          await audit(name)
        }
        await nav.getByRole('button', { name: 'Mi rutina', exact: true }).click()
        await page.getByRole('button', { name: 'Registrar actividad', exact: true }).click()
        await audit('cardio-dialog')
        await page.keyboard.press('Escape')
        await page.getByRole('button', { name: 'Abrir ajustes', exact: true }).click()
        await audit('settings-dialog')
      } finally { await context.close() }
    }
  } finally { await browser.close() }
}
await writeFile(resolve(output, 'results.json'), JSON.stringify(result, null, 2))
if (result.some(item => item.violations.length)) process.exitCode = 1
