// Open only the loopback QA proxy, with exact fixture-certificate trust.
import { createRequire } from 'node:module'
import { createHash, createPublicKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const { chromium } = createRequire(new URL('../apps/b2c-web/package.json', import.meta.url))(
  '@playwright/test',
)
const spki = createHash('sha256')
  .update(
    createPublicKey(readFileSync(`${root}/.cache/wl/tls/server.crt`)).export({
      type: 'spki',
      format: 'der',
    }),
  )
  .digest('base64')
const browser = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
  headless: process.argv.includes('--headless'),
  args: [`--ignore-certificate-errors-spki-list=${spki}`],
})
const mobile = process.argv.includes('--touch')
const context = await browser.newContext({
  proxy: { server: 'http://127.0.0.1:4342' },
  viewport: mobile ? { width: 360, height: 800 } : { width: 1440, height: 1000 },
  isMobile: mobile,
  hasTouch: mobile,
  ignoreHTTPSErrors: false,
})
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void browser.close())
const page = await context.newPage()
await page.goto('https://atlas.b2b.test')
await page.locator('[data-brand="atlas-demo"] h1').waitFor({ state: 'visible' })
if (process.argv.includes('--headless')) {
  await page.screenshot({ path: `${root}/.cache/qa-anonymous/manual-open.png`, fullPage: true })
  await browser.close()
} else {
  console.info(
    'QA ficticio abierto. Atlas/Sur usan el proxy local; cerrar la ventana para terminar.',
  )
  await page.waitForEvent('close', { timeout: 0 }).catch(() => {})
  await browser.close()
}
