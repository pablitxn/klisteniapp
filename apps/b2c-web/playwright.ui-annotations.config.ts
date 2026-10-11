import { defineConfig } from '@playwright/test'
import base from './playwright.config'

const output = process.env.KLISTENI_UI_BUILD_OUTPUT ??= `/tmp/klisteniapp-ui-build-${process.pid}`
export default defineConfig({
  ...base,
  testMatch: ['body-guide.spec.ts', 'ui-annotations.spec.ts', 'ui-annotations-account.spec.ts'],
  testIgnore: [],
  timeout: 30_000,
  outputDir: process.env.CI ? './test-results/ui-annotations' : `/tmp/klisteniapp-ui-results-${process.pid}`,
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:43274',
    reducedMotion: 'reduce',
    launchOptions: { args: ['--disable-webgl'] },
  },
  webServer: {
    command: `pnpm exec vite build --outDir ${output} --emptyOutDir && pnpm exec vite preview --outDir ${output} --host 127.0.0.1 --port 43274 --strictPort`,
    env: {
      VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: 'instance-profile.example.json',
      VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_HOST_URL: '', VITE_UMAMI_WEBSITE_ID: '', VITE_UMAMI_ALLOWED_HOSTNAME: '',
    },
    url: 'http://127.0.0.1:43274', reuseExistingServer: false, timeout: 120_000,
  },
})
