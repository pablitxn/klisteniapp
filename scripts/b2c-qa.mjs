/** Run one browser project at a time: each owns a disposable API schema. */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('B2C QA requires TEST_DATABASE_URL on a disposable loopback PostgreSQL database.')
}
const all = ['chromium-narrow', 'chromium-wide', 'chromium-desktop', 'webkit-narrow', 'webkit-wide', 'webkit-desktop']
const projects = process.argv.slice(2).length ? process.argv.slice(2) : all
if (projects.some(project => !all.includes(project))) throw new Error('Unknown B2C QA browser project')
const root = resolve(process.env.B2C_QA_ARTIFACTS ?? '/tmp/klisteni-b2c-qa')
for (const project of projects) {
  const output = resolve(root, project)
  await mkdir(output, { recursive: true })
  const code = await new Promise((done, reject) => {
    const child = spawn('pnpm', ['--filter', '@klisteniapp/b2c-web', 'exec', 'playwright', 'test', `--config=${process.env.B2C_QA_CONFIG ?? 'playwright.b2c-qa.config.ts'}`, `--project=${project}`, ...(process.env.B2C_QA_GREP ? ['--grep', process.env.B2C_QA_GREP] : [])], {
      stdio: 'inherit', env: { ...process.env, B2C_QA_OUTPUT: output, B2C_QA_REPORT: resolve(output, 'report.json') },
    })
    child.once('error', reject)
    child.once('exit', code => done(code ?? 1))
  })
  if (code !== 0) process.exitCode = 1
}
