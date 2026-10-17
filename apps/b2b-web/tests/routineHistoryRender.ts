import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'
import type * as Views from './routineHistoryRenderEntry.ts'

/** Render real JSX through the app's declared Vite toolchain. No production
 * route, test configuration, package dependency or loader is altered. */
export async function loadHistoryViews(): Promise<typeof Views> {
  const cache = fileURLToPath(new URL('../node_modules/.cache/', import.meta.url))
  await mkdir(cache, { recursive: true })
  const output = await mkdtemp(`${cache}wp08-render-`)
  try {
    await build({
      configFile: false,
      root: fileURLToPath(new URL('../', import.meta.url)),
      logLevel: 'error',
      ssr: { noExternal: [/^@klisteniapp\//] },
      build: {
        ssr: fileURLToPath(new URL('./routineHistoryRenderEntry.ts', import.meta.url)),
        outDir: output,
        emptyOutDir: true,
        rollupOptions: { output: { entryFileNames: 'views.mjs' } },
      },
    })
    return await import(pathToFileURL(`${output}/views.mjs`).href)
  } finally {
    await rm(output, { recursive: true, force: true })
  }
}
