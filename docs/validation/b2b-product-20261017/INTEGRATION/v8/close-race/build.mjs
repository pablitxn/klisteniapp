import { build } from '/workspace/klisteniapp/apps/b2b-web/node_modules/vite/dist/node/index.js'
import react from '/workspace/klisteniapp/apps/b2b-web/node_modules/@vitejs/plugin-react/dist/index.js'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
const base = '/tmp/klisteni-close-proof-v6'
const alias = []
for (const name of await readdir(path.join(base, 'source/packages'))) {
  const directory = path.join(base, 'source/packages', name)
  const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
  if (!manifest.exports) continue
  for (const [key, target] of Object.entries(manifest.exports)) {
    if (typeof target !== 'string') continue
    alias.push({ find: manifest.name + (key === '.' ? '' : key.slice(1)), replacement: path.join(directory, target) })
  }
}
alias.sort((a, b) => b.find.length - a.find.length)
await build({ configFile: false, root: base, plugins: [react()], define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias }, build: {
  outDir: path.join(base, 'dist'), emptyOutDir: true,
  lib: { entry: path.join(base, 'probe.tsx'), formats: ['iife'], name: 'CloseProof', fileName: () => 'probe.js', cssFileName: 'probe' },
} })
