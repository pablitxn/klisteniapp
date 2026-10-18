import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
if (!process.env.LEGACY_ADOPTION_BUILD_DIR?.startsWith('/tmp/wp07-adoption-')) {
  throw new Error('Set a task-owned /tmp/wp07-adoption-... build directory')
}
await build({
  configFile: false,
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: process.env.LEGACY_ADOPTION_BUILD_DIR,
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('legacyAdoptionHarness.html', import.meta.url)) },
  },
})
