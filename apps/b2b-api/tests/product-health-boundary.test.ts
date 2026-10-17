import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmptyHealthData } from '@klisteniapp/scene-schema';
import { klisteniHealthImportAdapter } from '@klisteniapp/scene-schema/health-import';
import {
  parseProductHealth,
  previewProductHealthImport,
  productHealthImportFormat,
} from '../src/product-health-adapter.ts';
const now = new Date('2026-10-17T12:00:00Z');
const file = {
  format: 'klisteniapp.health',
  version: 1,
  exportedAt: '2026-10-17T10:00:00Z',
  timeZone: 'UTC',
  records: {
    measurements: [
      {
        id: 'weight',
        date: '2026-10-16',
        recordedAt: '2026-10-16T10:00:00Z',
        source: { kind: 'manual', externalId: 'synthetic-weight' },
        weightKg: 80,
      },
    ],
    sleep: [],
    activity: [],
    nutrition: [],
    supplements: [],
  },
};
test('B2B mapping preserves canonical normalized JSON, provenance and adapter preview bytes', () => {
  const current = createEmptyHealthData(),
    raw = JSON.stringify(file);
  assert.equal(
    JSON.stringify(previewProductHealthImport(raw, current, now)),
    JSON.stringify(klisteniHealthImportAdapter.preview(raw, current, now)),
  );
  const preview = previewProductHealthImport(raw, current, now);
  assert.equal(preview.ok, true);
  if (preview.ok) {
    assert.deepEqual(parseProductHealth(preview.health), preview.health);
    assert.equal(preview.health.measurements[0]!.source.externalId, 'synthetic-weight');
  }
  assert.deepEqual(current, createEmptyHealthData());
});
test('B2B semantic boundary rejects invalid measurements and unsupported vendor formats without importing', () => {
  assert.throws(() =>
    parseProductHealth({
      ...createEmptyHealthData(),
      measurements: [{ ...file.records.measurements[0], weightKg: -1 }],
    }),
  );
  assert.equal(
    previewProductHealthImport('date,weight\n2026-10-16,80', createEmptyHealthData(), now).ok,
    false,
  );
  assert.equal(productHealthImportFormat.format, 'klisteniapp.health');
  assert.equal(productHealthImportFormat.manualOnly, true);
  assert.equal(productHealthImportFormat.maxRecords, 10000);
});
