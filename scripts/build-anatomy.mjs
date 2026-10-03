/** Rebuild the attributed Z-Anatomy assets without opening Blender's UI. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = resolve(root, '.cache/anatomy');
const manifest = JSON.parse(await readFile(resolve(root, 'apps/web/public/models/anatomy-manifest.json'), 'utf8'));
await mkdir(cache, { recursive: true });
for (const source of manifest.sources) {
  const path = resolve(cache, source.name);
  let bytes;
  try { bytes = await readFile(path); } catch { /* Download the pinned source below. */ }
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
    console.log(`Downloading pinned source: ${source.name}`);
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error(`Checksum mismatch: ${source.name}`);
    await writeFile(path, bytes);
  }
}
// Regenerate the exact metadata consumed by the Blender scripts, without relying on mutable branches.
await writeFile(resolve(cache, 'source-commit.json'), JSON.stringify({ sha: manifest.sourceCommit }));
await writeFile(resolve(cache, 'github-files.json'), JSON.stringify(manifest.sources.map(source => ({ name: source.name, sha: source.githubBlobSha, download_url: source.url }))));
const candidates = [process.env.BLENDER_BIN, '/Applications/Blender.app/Contents/MacOS/Blender'].filter(Boolean);
let blender = 'blender';
for (const candidate of candidates) {
  try { await access(candidate); blender = candidate; break; } catch { /* Try the next location. */ }
}
for (const script of ['inspect_anatomy.py', 'build_anatomy.py']) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(blender, ['--background', '--factory-startup', '--python', resolve(root, 'scripts/blender', script)], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`Blender ${script} exited ${code}`)));
  });
}
console.log('Built anatomy.glb, rig landmarks, source manifest, optimization report and editable anatomy.blend.');
