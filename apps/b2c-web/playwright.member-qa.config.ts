import { defineConfig } from '@playwright/test'
import whiteLabel from './playwright.white-label.config'

// Synthetic HTTPS origins and disposable per-engine schemas from the WL harness.
// WebKit's context accepts only this harness's self-signed certificate; this
// suite does not attest certificate trust or change the machine's CA store.
export default defineConfig({
  ...whiteLabel,
  testMatch: 'member-qa.spec.ts',
  timeout: 180_000,
  outputDir: '../../.cache/member-qa/results',
  reporter: [
    ['list'],
    ['json', { outputFile: '../../.cache/member-qa/results.json' }],
    ['html', { outputFolder: '../../.cache/member-qa/report', open: 'never' }],
  ],
  use: { ...whiteLabel.use, trace: 'on', screenshot: 'only-on-failure' },
  projects: ['chromium', 'webkit'].flatMap((engine) =>
    [
      { name: 'narrow', viewport: { width: 320, height: 740 }, touch: true },
      { name: 'wide', viewport: { width: 430, height: 932 }, touch: true },
      { name: 'desktop', viewport: { width: 1440, height: 1000 }, touch: false },
    ].map(({ name, viewport, touch }) => ({
      name: `member-${engine}-${name}`,
      use: {
        browserName: engine as 'chromium' | 'webkit',
        viewport,
        hasTouch: touch,
        isMobile: touch,
        deviceScaleFactor: touch ? 2 : 1,
        proxy: { server: `http://127.0.0.1:${engine === 'chromium' ? 4342 : 4346}` },
        ...(engine === 'chromium'
          ? {
              launchOptions: {
                ...whiteLabel.projects![0].use!.launchOptions,
                ...(process.env.B2B_QA_CHROMIUM_PATH
                  ? { executablePath: process.env.B2B_QA_CHROMIUM_PATH }
                  : {}),
              },
            }
          : { ignoreHTTPSErrors: true }),
      },
    })),
  ),
  webServer: {
    ...whiteLabel.webServer,
    // Opt in only while manually inspecting the same disposable local harness.
    reuseExistingServer: process.env.B2B_QA_REUSE_SERVER === 'true',
  },
})
