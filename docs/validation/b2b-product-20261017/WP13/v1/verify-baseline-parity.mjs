import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../../../../../', import.meta.url);
const fixtures = JSON.parse(readFileSync(new URL('packages/scene-schema/tests/fixtures/health-import-parity.json', root), 'utf8'));
const source = execFileSync('git', [
  'show', `${fixtures.provenance.sourceCommit}:${fixtures.provenance.sourcePath}`,
], { cwd: fileURLToPath(root), encoding: 'utf8' });
const extracted = readFileSync(new URL('packages/scene-schema/src/health-import.ts', root), 'utf8');
assert.equal(
  extracted.slice(extracted.indexOf('export const HEALTH_IMPORT_MAX_BYTES'), extracted.indexOf('/** Pure format capabilities')).trimEnd(),
  source.slice(source.indexOf('export const HEALTH_IMPORT_MAX_BYTES')).trimEnd(),
);
const require = createRequire(new URL('packages/scene-schema/package.json', root));
const zod = new URL('./index.js', pathToFileURL(require.resolve('zod/package.json')));
const original = source.replace("from 'zod'", `from '${zod.href}'`)
  .replace("from '@klisteniapp/scene-schema'", `from '${new URL('packages/scene-schema/src/index.ts', root).href}'`);
const directory = mkdtempSync(join(tmpdir(), 'wp13-original-'));
try {
  const modulePath = join(directory, 'health-import.mts');
  writeFileSync(modulePath, original);
  const importer = await import(pathToFileURL(modulePath).href);
  for (const fixture of fixtures.cases) {
    assert.equal(JSON.stringify(importer.previewHealthImport(fixture.raw, fixture.current, new Date(fixture.now))), fixture.expected, fixture.name);
  }
  for (const fixture of fixtures.templates) {
    assert.equal(importer.createHealthImportTemplate(new Date(fixture.now), fixture.timeZone), fixture.expected);
  }
  console.log(`${fixtures.cases.length} preview cases and ${fixtures.templates.length} template fixtures match the audited baseline; extracted parser body is byte-identical.`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
