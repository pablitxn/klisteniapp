import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createEmptyHealthData, type HealthData } from '../src/health.ts';
import {
  createHealthImportTemplate, HEALTH_IMPORT_MAX_BYTES, HEALTH_IMPORT_MAX_RECORDS,
  HealthImportSchema, healthImportCategories, klisteniHealthImportAdapter,
  previewHealthImport, type HealthImportAdapter,
} from '../src/health-import.ts';

type ParityFixtures = {
  provenance: { sourceCommit: string; sourcePath: string; syntheticOnly: boolean };
  cases: { name: string; raw: string; current: HealthData; now: string; expected: string }[];
  templates: { now: string; timeZone: string; expected: string }[];
};
const fixtures: ParityFixtures = JSON.parse(readFileSync(new URL('./fixtures/health-import-parity.json', import.meta.url), 'utf8'));
const now = new Date('2026-10-04T12:00:00Z');
const measurement = (id = 'synthetic-weight') => ({
  id, date: '2026-10-03', recordedAt: '2026-10-03T07:00:00Z',
  source: { kind: 'manual' as const, externalId: id }, weightKg: 80,
});
const file = (records: Record<string, unknown> = {}) => JSON.stringify({
  format: 'klisteniapp.health', version: 1, exportedAt: now.toISOString(), timeZone: 'UTC',
  records: { measurements: [], sleep: [], activity: [], nutrition: [], supplements: [], ...records },
});
function freeze(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}
function expectFailure(raw: string, error: RegExp, current = createEmptyHealthData()) {
  const before = JSON.stringify(current);
  freeze(current);
  const result = previewHealthImport(raw, current, now);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, error);
  assert.equal(JSON.stringify(current), before);
}

test('parity fixtures identify the original importer and use synthetic records only', () => {
  assert.deepEqual(fixtures.provenance, {
    sourceCommit: 'd65261d18de4522fb9a66104aabb5750104fb8b8',
    sourcePath: 'apps/b2c-web/src/lib/health-import.ts', syntheticOnly: true,
  });
});

for (const fixture of fixtures.cases) {
  test(`original importer byte parity: ${fixture.name}`, () => {
    const current = structuredClone(fixture.current);
    const before = JSON.stringify(current);
    freeze(current);
    const raw = new TextDecoder().decode(new TextEncoder().encode(fixture.raw));
    const result = klisteniHealthImportAdapter.preview(raw, current, new Date(fixture.now));
    assert.equal(JSON.stringify(result), fixture.expected);
    assert.equal(JSON.stringify(current), before);
  });
}

test('adapter exposes exactly the reserved manual-only capabilities under Node', () => {
  assert.equal('window' in globalThis, false);
  assert.equal('document' in globalThis, false);
  assert.equal('localStorage' in globalThis, false);
  const adapter: HealthImportAdapter = klisteniHealthImportAdapter;
  assert.deepEqual(Object.keys(adapter).sort(), [
    'categories', 'createTemplate', 'format', 'manualOnly', 'maxBytes', 'maxRecords', 'preview', 'version',
  ]);
  assert.equal(adapter.format, 'klisteniapp.health');
  assert.equal(adapter.version, 1);
  assert.equal(adapter.manualOnly, true);
  assert.equal(adapter.categories, healthImportCategories);
  assert.deepEqual(adapter.categories, ['measurements', 'sleep', 'activity', 'nutrition', 'supplements']);
  assert.equal(adapter.maxBytes, 2 * 1024 * 1024);
  assert.equal(adapter.maxBytes, HEALTH_IMPORT_MAX_BYTES);
  assert.equal(adapter.maxRecords, 10000);
  assert.equal(adapter.maxRecords, HEALTH_IMPORT_MAX_RECORDS);
  assert.equal(adapter.preview, previewHealthImport);
  assert.equal(adapter.createTemplate, createHealthImportTemplate);
});

test('template bytes and exact shape match the original importer without fabricated records', () => {
  for (const fixture of fixtures.templates) {
    const raw = createHealthImportTemplate(new Date(fixture.now), fixture.timeZone);
    assert.equal(raw, fixture.expected);
    assert.deepEqual(JSON.parse(raw), {
      format: 'klisteniapp.health', version: 1, exportedAt: fixture.now, timeZone: fixture.timeZone,
      records: { measurements: [], sleep: [], activity: [], nutrition: [], supplements: [] },
    });
    assert.equal(HealthImportSchema.safeParse(JSON.parse(raw)).success, true);
  }
  assert.equal(JSON.parse(createHealthImportTemplate(now)).timeZone, 'UTC');
  assert.throws(() => createHealthImportTemplate(now, 'Invalid/Zone'));
  assert.throws(() => createHealthImportTemplate(new Date('invalid')), RangeError);
});

test('timestamp offset and key order equivalence includes sleep intervals and modified timestamps', () => {
  const common = measurement();
  const first = {
    ...common, weightKg: undefined, durationMinutes: 60,
    startAt: '2026-10-03T08:00:00+02:00', endAt: '2026-10-03T09:00:00+02:00',
    modifiedAt: '2026-10-03T10:00:00+02:00',
  };
  const second = {
    source: { externalId: common.id, kind: 'manual' }, id: 'synthetic-copy', date: common.date,
    durationMinutes: 60, recordedAt: common.recordedAt,
    startAt: '2026-10-03T06:00:00Z', endAt: '2026-10-03T07:00:00Z', modifiedAt: '2026-10-03T08:00:00Z',
  };
  const result = previewHealthImport(file({ sleep: [first, second] }), createEmptyHealthData(), now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.counts, { total: 2, added: 1, duplicates: 1 });
  assert.equal(result.health.sleep[0]?.startAt, first.startAt);
  assert.equal(result.health.sleep[0]?.modifiedAt, first.modifiedAt);
});

test('timezone fallback remains deterministic across DST and local midnight', () => {
  const at = new Date('2026-03-29T00:30:00Z');
  const record = { ...measurement(), date: '2026-03-29', recordedAt: at.toISOString() };
  const raw = JSON.parse(file({ measurements: [record] }));
  raw.exportedAt = at.toISOString();
  raw.timeZone = 'America/Los_Angeles';
  const rejected = previewHealthImport(JSON.stringify(raw), createEmptyHealthData(), at);
  assert.equal(rejected.ok, false);
  raw.timeZone = 'Europe/Paris';
  const accepted = previewHealthImport(JSON.stringify(raw), createEmptyHealthData(), at);
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(accepted.health.measurements[0]?.date, record.date);
    assert.equal(accepted.health.measurements[0]?.timeZone, 'Europe/Paris');
  }
});

test('raw character and UTF-8 byte bounds reject oversized input', () => {
  expectFailure(' '.repeat(HEALTH_IMPORT_MAX_BYTES + 1), /2 MiB/);
  expectFailure('é'.repeat(HEALTH_IMPORT_MAX_BYTES / 2 + 1), /2 MiB/);
  const raw = file({ measurements: [measurement()] });
  const atLimit = raw + ' '.repeat(HEALTH_IMPORT_MAX_BYTES - Buffer.byteLength(raw));
  assert.equal(previewHealthImport(atLimit, createEmptyHealthData(), now).ok, true);
  expectFailure(atLimit + ' ', /2 MiB/);
});

test('record limits accept 10000 rows and reject per-category and aggregate overflow', () => {
  const records = Array.from({ length: HEALTH_IMPORT_MAX_RECORDS }, (_, index) => measurement(`synthetic-${index}`));
  const result = previewHealthImport(file({ measurements: records }), createEmptyHealthData(), now);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.counts, { total: 10000, added: 10000, duplicates: 0 });
  expectFailure(file({ measurements: [...records, measurement('overflow')] }), /Formato/);
  expectFailure(file({
    measurements: records.slice(0, 5001),
    activity: records.slice(0, 5000).map(({ id, date, recordedAt, source }) => ({ id, date, recordedAt, source, steps: 1 })),
  }), /10.000/);
});

test('merged-state limits reject atomically after otherwise valid new rows', () => {
  const current = createEmptyHealthData();
  current.measurements = Array.from({ length: 1500 }, (_, index) => ({
    ...measurement(`saved-${index}`), notes: 'x'.repeat(1900), timeZone: 'UTC',
  }));
  const incoming = Array.from({ length: 600 }, (_, index) => ({ ...measurement(`incoming-${index}`), notes: 'x'.repeat(1900) }));
  assert.ok(Buffer.byteLength(file({ measurements: incoming })) < HEALTH_IMPORT_MAX_BYTES);
  expectFailure(file({ measurements: incoming }), /excede los límites/, current);
});
