// Uses the same binary validator as production uploads. No Blender dependency.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { parseArgs } from 'node:util';
import { MEDIA_LIMITS, validateMedia } from '../apps/b2b-api/src/media.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  poster: { type: 'string' },
  help: { type: 'boolean' },
} });
if (values.help || !positionals.length) {
  console.info('Usage: pnpm equipment:check /path/machine.glb --poster /path/machine.png');
  process.exit(values.help ? 0 : 1);
}
async function inspect(path, kind, mime) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > MEDIA_LIMITS[kind]) throw new Error(`Invalid ${kind} file or upload size limit exceeded.`);
  const bytes = await readFile(path);
  validateMedia(bytes, kind, mime);
  return { bytes: bytes.length, mime, sha256: createHash('sha256').update(bytes).digest('hex') };
}
try {
  if (positionals.length !== 1 || extname(positionals[0]).toLowerCase() !== '.glb') throw new Error('Provide exactly one GLB model.');
  const model = await inspect(positionals[0], 'model3d', 'model/gltf-binary');
  const posterTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  let poster = null;
  if (values.poster) {
    const mime = posterTypes[extname(values.poster).toLowerCase()];
    if (!mime) throw new Error('The fallback poster must be PNG, JPEG or WebP.');
    poster = await inspect(values.poster, 'image', mime);
  }
  console.info(JSON.stringify({ profile: 'static-glb-v1', model, poster }, null, 2));
  console.info('Binary profile passed. Review scale, framing, provenance and device performance before publication.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Equipment validation failed.');
  process.exitCode = 1;
}
