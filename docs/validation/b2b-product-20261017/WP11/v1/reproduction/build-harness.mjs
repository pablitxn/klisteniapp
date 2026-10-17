import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { syntheticExport } from '/workspace/klisteniapp/apps/b2b-web/tests/membership/fixture.ts'
const require = createRequire('/workspace/klisteniapp/apps/b2b-web/package.json')
const { build } = await import(require.resolve('vite'))
const { default: react } = await import(require.resolve('@vitejs/plugin-react'))
await mkdir('/tmp/wp11-runtime/public', { recursive: true })
await build({
  configFile: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  root: '/workspace/klisteniapp/apps/b2b-web',
  plugins: [react()],
  logLevel: 'warn',
  build: { outDir: '/tmp/wp11-runtime/public', emptyOutDir: true, minify: false,
    lib: { entry: '/workspace/klisteniapp/apps/b2b-web/tests/membership/ownedUiHarness.tsx', name: 'WP11', formats: ['iife'], fileName: () => 'owned-ui.js', cssFileName: 'owned-ui' } },
})
await writeFile('/tmp/wp11-runtime/public/export.json', JSON.stringify(syntheticExport()))
await writeFile('/tmp/wp11-runtime/public/index.html', '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WP11 owned component</title><link rel="stylesheet" href="/owned-ui.css"><body><div id="root"></div><script src="/owned-ui.js"></script></body></html>')
