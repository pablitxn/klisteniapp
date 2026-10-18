import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
const output = process.env.PROGRAMMING_GRID_BUILD_DIR
if (!output?.startsWith('/tmp/wp07-grid-runtime/')) throw new Error('Use a task-owned /tmp/wp07-grid-runtime/... output')
await build({
  configFile: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react()],
  build: { outDir: output, emptyOutDir: true, minify: false,
    lib: { entry: fileURLToPath(new URL('programmingGridHarness.tsx', import.meta.url)), name: 'ProgrammingGridFixture', formats: ['iife'], fileName: () => 'probe.js', cssFileName: 'probe' } },
})
