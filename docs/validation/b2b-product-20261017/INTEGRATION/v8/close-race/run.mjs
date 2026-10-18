import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { chromium } from './driver-playwright-core/index.mjs'
const base = '/tmp/klisteni-close-proof-v6'
const server = createServer(async (request, response) => {
  if (request.url === '/probe.js') {
    response.setHeader('content-type', 'text/javascript')
    response.end(await readFile(base + '/dist/probe.js')); return
  }
  response.setHeader('content-type', 'text/html')
  response.end('<html><meta charset="utf-8"><body><div id="root"></div><script src="/probe.js"></script></body></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.PROOF_CHROMIUM || '/usr/bin/chromium', headless: true, chromiumSandbox: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => { errors.push(String(error)); console.error('PAGE ERROR', String(error)) })
  page.on('requestfailed', request => console.error('REQUEST FAILED', request.url(), request.failure()?.errorText))
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.waitForFunction(() => Boolean(window.closeProof))
  const results = []
  for (const closeBeforeCommit of [false, true]) {
    await page.evaluate(() => window.closeProof.mount())
    await page.waitForFunction(() => window.closeProof.state().ready)
    await page.getByLabel('Notas de la sesión', { exact: true }).fill('Notes entered before slow storage')
    await page.waitForFunction(() => window.closeProof.state().held)
    await page.getByLabel('Motivo de corrección', { exact: true }).fill('Final reason entered before close')
    if (closeBeforeCommit) {
      await page.getByRole('button', { name: 'Volver', exact: true }).click()
      await page.waitForFunction(() => window.closeProof.state().closed)
    }
    await page.evaluate(() => window.closeProof.release())
    await page.waitForFunction(async () => (await window.closeProof.read())?.content.notes === 'Notes entered before slow storage')
    if (!closeBeforeCommit) {
      await page.waitForFunction(async () => (await window.closeProof.read())?.content.correctionReason === 'Final reason entered before close')
    }
    await page.waitForTimeout(250)
    const stored = await page.evaluate(() => window.closeProof.reopen())
    const state = await page.evaluate(() => window.closeProof.state())
    assert.equal(stored.content.notes, 'Notes entered before slow storage')
    assert.equal(stored.content.correctionReason, closeBeforeCommit ? '' : 'Final reason entered before close')
    results.push({ closeBeforeCommit, storedNotes: stored.content.notes, storedReason: stored.content.correctionReason, generation: stored.generation, events: state.events })
  }
  assert.deepEqual(errors, [])
  const processes = await Promise.all((await readdir('/proc')).filter(p => /^\d+$/.test(p)).map(async pid => {
    try { return (await readFile(`/proc/${pid}/cmdline`, 'utf8')).split('\0') } catch { return [] }
  }))
  const chromiumProcesses = processes.filter(args => args[0]?.includes('chromium'))
  assert.ok(chromiumProcesses.length)
  assert.equal(chromiumProcesses.some(args => args.includes('--no-sandbox')), false)
  const result = { source: '5a727d67c60657d0affdbda38871f9d135eed07e', contractAndDomain: 'bb2a2d414f9043c2f5bfcbb9908fa4dd9e88360a', browser: browser.version(), chromiumSandbox: true, actualProductTrainingSession: true, nativeIndexedDB: true, deliberatelyDelayedStorage: true, networkSyncEnabled: false, errors, results }
  await writeFile(base + '/result.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
