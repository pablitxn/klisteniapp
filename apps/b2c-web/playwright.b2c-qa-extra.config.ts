import { defineConfig } from '@playwright/test'
import qa from './playwright.b2c-qa.config'
const servers = qa.webServer
if (!Array.isArray(servers) || servers.length !== 2)
  throw new Error('B2C extra QA requires two servers')
export default defineConfig({
  ...qa,
  testMatch: 'b2c-selfservice-extra.spec.ts',
  use: { ...qa.use, baseURL: 'http://127.0.0.1:4195' },
  webServer: [
    {
      ...servers[0]!,
      url: 'http://127.0.0.1:4196/api/readyz',
      env: { B2C_QA_WEB_ORIGIN: 'http://127.0.0.1:4195', B2C_QA_API_PORT: '4196' },
    },
    {
      ...servers[1]!,
      command: servers[1]!.command.replaceAll('--port 4181', '--port 4195'),
      url: 'http://127.0.0.1:4195',
      env: { ...servers[1]!.env, KLISTENI_API_URL: 'http://127.0.0.1:4196' },
    },
  ],
})
