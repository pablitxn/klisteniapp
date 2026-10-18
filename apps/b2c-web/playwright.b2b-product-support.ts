import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  productHarnessLayout,
  type ProductHarnessMode,
} from '../../scripts/b2b-product-harness-settings.ts'

export function productHarnessConfig(mode: ProductHarnessMode) {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const offset = Number(process.env.B2B_PRODUCT_PORT_OFFSET ?? 0)
  const layout = productHarnessLayout(mode, offset)
  const output = resolve(
    process.env.B2B_PRODUCT_OUTPUT ?? `/tmp/klisteni-b2b-product-${mode}-${process.pid}`,
  )
  if (!output.startsWith('/tmp/')) throw new Error('Product evidence output must be under /tmp')
  return defineConfig({
    testDir: './e2e',
    testMatch: 'b2b-product-*.spec.ts',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: Boolean(process.env.CI),
    timeout: 180_000,
    outputDir: `${output}/artifacts`,
    reporter: [['list'], ['json', { outputFile: `${output}/playwright.json` }]],
    use: {
      ignoreHTTPSErrors: false,
      locale: 'es-AR',
      timezoneId: 'UTC',
      reducedMotion: 'reduce',
      colorScheme: 'light',
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
    },
    projects: layout.projects.map((project) => ({
      name: `product-${project.name}`,
      metadata: {
        fixtureIndex: project.index,
        fixtureControlPort: layout.controlPort,
        b2bProduct: {
          mode,
          engine: project.engine,
          width: project.width,
          height: project.height,
          touch: project.touch,
        },
      },
      use: {
        browserName: project.engine,
        viewport: { width: project.width, height: project.height },
        isMobile: project.touch,
        hasTouch: project.touch,
        baseURL:
          mode === 'unified-http'
            ? `http://127.0.0.1:${project.gatewayPort}`
            : `${mode === 'white-label-http' ? 'http' : 'https'}://atlas.b2b.test`,
        ...(mode === 'unified-http'
          ? {}
          : { proxy: { server: `http://127.0.0.1:${project.proxyPort}` } }),
        launchOptions: project.engine === 'chromium' ? { chromiumSandbox: true } : {},
      },
    })),
    webServer: {
      command:
        process.env.B2B_PRODUCT_USE_BUILT === '1'
          ? 'node scripts/b2b-product-e2e-server.mjs'
          : 'pnpm --filter @klisteniapp/b2b-web build && node scripts/b2b-product-e2e-server.mjs',
      cwd: root,
      env: { B2B_PRODUCT_MODE: mode, B2B_PRODUCT_PORT_OFFSET: String(offset) },
      url: `http://127.0.0.1:${layout.controlPort}/healthz`,
      reuseExistingServer: false,
      timeout: 300_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 20000 },
    },
  })
}
