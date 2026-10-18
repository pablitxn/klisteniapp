import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const app = '/workspace/klisteniapp/apps/b2b-web'
const require = createRequire(`${app}/package.json`)
const { build } = await import(require.resolve('vite'))
const { default: react } = await import(require.resolve('@vitejs/plugin-react'))
const css = `${app}/src/features/programs/product/programming.css`
await build({
  configFile: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  root: app,
  plugins: [
    { name: 'exact-predecessor-css', enforce: 'pre', load(id) {
      if (id === css) return readFileSync('/tmp/b2b-integration-v13/programming-before.css', 'utf8')
    } },
    react(),
  ],
  build: {
    outDir: '/tmp/wp07-grid-runtime/baseline', emptyOutDir: true, minify: false,
    lib: { entry: `${app}/tests/programmingGridHarness.tsx`, name: 'ProgrammingGridFixture', formats: ['iife'], fileName: () => 'probe.js', cssFileName: 'probe' },
  },
})
