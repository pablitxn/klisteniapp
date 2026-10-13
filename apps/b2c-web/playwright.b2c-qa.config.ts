import { defineConfig } from '@playwright/test'
import accounts from './playwright.accounts.config'

process.env.B2C_QA_FIXTURES = '1'
const webkit = process.env.B2C_QA_WEBKIT_PATH
const chromium = process.env.B2C_QA_CHROMIUM_PATH
const touch = { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
export default defineConfig({
  ...accounts,
  testMatch: ['accounts.spec.ts', 'subscriptions.spec.ts', 'account-access.spec.ts', 'forgot-password.spec.ts', 'health.spec.ts', 'yoga-account.spec.ts', 'b2c-selfservice.spec.ts'],
  outputDir: process.env.B2C_QA_OUTPUT ?? '/tmp/klisteni-b2c-qa-results',
  reporter: [['list'], ['json', { outputFile: process.env.B2C_QA_REPORT ?? '/tmp/klisteni-b2c-qa-results/report.json' }]],
  use: { ...accounts.use, trace: { mode: 'on', screenshots: false, snapshots: true, sources: true } },
  projects: [
    { name: 'chromium-narrow', use: { browserName: 'chromium', viewport: { width: 360, height: 800 }, ...touch, launchOptions: chromium ? { executablePath: chromium } : {} } },
    { name: 'chromium-wide', use: { browserName: 'chromium', viewport: { width: 430, height: 932 }, ...touch, launchOptions: chromium ? { executablePath: chromium } : {} } },
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 }, launchOptions: chromium ? { executablePath: chromium } : {} } },
    { name: 'webkit-narrow', use: { browserName: 'webkit', launchOptions: webkit ? { executablePath: webkit } : {}, viewport: { width: 360, height: 800 }, ...touch } },
    { name: 'webkit-wide', use: { browserName: 'webkit', launchOptions: webkit ? { executablePath: webkit } : {}, viewport: { width: 430, height: 932 }, ...touch } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', launchOptions: webkit ? { executablePath: webkit } : {}, viewport: { width: 1440, height: 1000 } } },
  ],
})
