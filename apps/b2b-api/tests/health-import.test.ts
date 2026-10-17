import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  emptyHealth,
  errorCode,
  importFile,
  measurement,
  NOW,
  withHealthFixture,
} from './fixtures/health.ts';

test('manual preview writes nothing; confirm stores owner data and provenance without consent or gym audit payload', async () => {
  await withHealthFixture(async (f) => {
    const request = {
      operationId: randomUUID(),
      expectedRevision: 0,
      format: 'klisteniapp.health' as const,
      version: 1 as const,
      raw: importFile(),
    };
    const preview = await f.as((c) => f.services.previewHealthImport(c, request));
    assert.equal(preview.additions.measurements, 1);
    assert.deepEqual(preview.issues, []);
    assert.equal((await f.pool.query('SELECT * FROM b2b_health')).rowCount, 0);
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_operation')).rowCount, 0);
    const response = await f.as((c) =>
      f.services.applyHealthImport(c, { ...request, previewHash: preview.previewHash }),
    );
    assert.equal(response.ownerId, 'member');
    assert.equal(response.revision, 1);
    assert.equal(response.data.measurements[0]!.source.externalId, 'synthetic-weight');
    assert.equal(response.data.measurements[0]!.timeZone, 'UTC');
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_consent')).rowCount, 0);
    assert.equal(
      (await f.pool.query("SELECT * FROM b2b_audit WHERE action LIKE 'health.%'")).rowCount,
      0,
    );
    assert.deepEqual(await f.as((c) => f.services.ownHealth(c, {}), 'other'), {
      schemaVersion: 2,
      ownerId: 'other',
      revision: 0,
      data: emptyHealth(),
    });
  });
});

test('exact response-loss retries survive ticket expiry and later edits; operation ID reuse conflicts', async () => {
  await withHealthFixture(async (f) => {
    const request = {
      operationId: randomUUID(),
      expectedRevision: 0,
      format: 'klisteniapp.health' as const,
      version: 1 as const,
      raw: importFile(),
    };
    const preview = await f.as((c) => f.services.previewHealthImport(c, request));
    const commit = { ...request, previewHash: preview.previewHash };
    const response = await f.as((c) => f.services.applyHealthImport(c, commit));
    await f.as((c) =>
      f.services.saveOwnHealth(c, {
        operationId: randomUUID(),
        expectedRevision: 1,
        data: { ...response.data, profile: { context: 'Owner correction' } },
      }),
    );
    f.setNow(new Date(NOW.getTime() + 6 * 60 * 1000));
    assert.deepEqual(await f.as((c) => f.services.applyHealthImport(c, commit)), response);
    await assert.rejects(
      f.as((c) =>
        f.services.applyHealthImport(c, {
          ...commit,
          raw: importFile({ measurements: [measurement('different')] }),
        }),
      ),
      errorCode('OPERATION_CONFLICT'),
    );
    assert.equal((await f.pool.query('SELECT revision FROM b2b_health')).rows[0].revision, 2);
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_operation')).rowCount, 2);
  });
});

test('reimport deduplicates equivalent source records and rejects the complete file on conflict', async () => {
  await withHealthFixture(async (f) => {
    const first = {
      operationId: randomUUID(),
      expectedRevision: 0,
      format: 'klisteniapp.health' as const,
      version: 1 as const,
      raw: importFile(),
    };
    const preview = await f.as((c) => f.services.previewHealthImport(c, first));
    await f.as((c) =>
      f.services.applyHealthImport(c, { ...first, previewHash: preview.previewHash }),
    );
    const same = {
      ...first,
      operationId: randomUUID(),
      expectedRevision: 1,
      raw: importFile({
        measurements: [
          {
            ...measurement('another-local-id'),
            source: measurement().source,
            recordedAt: '2026-10-16T12:00:00+02:00',
          },
        ],
      }),
    };
    const duplicate = await f.as((c) => f.services.previewHealthImport(c, same));
    assert.equal(duplicate.duplicates, 1);
    assert.equal(duplicate.additions.measurements, 0);
    const saved = await f.as((c) =>
      f.services.applyHealthImport(c, { ...same, previewHash: duplicate.previewHash }),
    );
    assert.equal(saved.data.measurements.length, 1);
    const bad = {
      ...same,
      operationId: randomUUID(),
      expectedRevision: 2,
      raw: importFile({
        measurements: [measurement('new-valid'), { ...measurement(), weightKg: 90 }],
      }),
    };
    const rejected = await f.as((c) => f.services.previewHealthImport(c, bad));
    assert.ok(rejected.issues.length);
    assert.equal(rejected.additions.measurements, 0);
    await assert.rejects(
      f.as((c) => f.services.applyHealthImport(c, { ...bad, previewHash: rejected.previewHash })),
      errorCode('INVALID_INPUT'),
    );
    assert.equal((await f.as((c) => f.services.ownHealth(c, {}))).data.measurements.length, 1);
  });
});

test('preview is owner/revision/input/expiry bound and survives a rolled-back confirmation', async () => {
  await withHealthFixture(async (f) => {
    const request = {
      operationId: randomUUID(),
      expectedRevision: 0,
      format: 'klisteniapp.health' as const,
      version: 1 as const,
      raw: importFile(),
    };
    const preview = await f.as((c) => f.services.previewHealthImport(c, request));
    const commit = { ...request, previewHash: preview.previewHash };
    await assert.rejects(
      f.as((c) => f.services.applyHealthImport(c, commit), 'other'),
      errorCode('INVALID_INPUT'),
    );
    await assert.rejects(
      f.as((c) =>
        f.services.applyHealthImport(c, {
          ...commit,
          raw: importFile({ measurements: [measurement('changed')] }),
        }),
      ),
      errorCode('INVALID_INPUT'),
    );
    await assert.rejects(
      f.as(async (c) => {
        await f.services.applyHealthImport(c, commit);
        throw new Error('Synthetic rollback');
      }),
      /Synthetic rollback/,
    );
    assert.equal((await f.pool.query('SELECT * FROM b2b_health')).rowCount, 0);
    f.setNow(new Date(NOW.getTime() + 5 * 60 * 1000));
    await assert.rejects(
      f.as((c) => f.services.applyHealthImport(c, commit)),
      errorCode('INVALID_INPUT'),
    );
    f.setNow(NOW);
    await f.as((c) =>
      f.services.saveOwnHealth(c, {
        operationId: randomUUID(),
        expectedRevision: 0,
        data: emptyHealth(),
      }),
    );
    await assert.rejects(
      f.as((c) => f.services.applyHealthImport(c, commit)),
      errorCode('REVISION_CONFLICT'),
    );
  });
});

test('malformed, CSV, ZIP, wrong version, future, invalid units and oversized imports produce no writes', async () => {
  await withHealthFixture(async (f) => {
    const base = {
      operationId: randomUUID(),
      expectedRevision: 0,
      format: 'klisteniapp.health' as const,
      version: 1 as const,
    };
    const rejectedFiles = [
      '{',
      'date,weight\n2026-10-16,80',
      'PK\u0003\u0004synthetic-zip',
      JSON.stringify({ format: 'vendor', version: 1 }),
      importFile({ measurements: [{ ...measurement(), weightKg: -1 }] }),
      importFile({ measurements: [{ ...measurement(), recordedAt: '2099-01-01T00:00:00Z' }] }),
      importFile({ measurements: [{ ...measurement(), date: '2099-01-01' }] }),
      importFile({ measurements: [] }),
    ];
    for (const raw of rejectedFiles) {
      const request = { ...base, raw };
      const preview = await f.as((c) => f.services.previewHealthImport(c, request));
      assert.ok(preview.issues.length);
      await assert.rejects(
        f.as((c) =>
          f.services.applyHealthImport(c, { ...request, previewHash: preview.previewHash }),
        ),
        errorCode('INVALID_INPUT'),
      );
    }
    await assert.rejects(
      f.as((c) => f.services.previewHealthImport(c, { ...base, raw: 'é'.repeat(1024 * 1024 + 1) })),
      errorCode('INVALID_INPUT'),
    );
    const many = Array.from({ length: 10001 }, (_, i) => ({ ...measurement(`m${i}`) }));
    const tooMany = await f
      .as((c) =>
        f.services.previewHealthImport(c, { ...base, raw: importFile({ measurements: many }) }),
      )
      .catch((error) => error);
    assert.ok(tooMany.issues?.length || tooMany.code === 'INVALID_INPUT');
    assert.equal((await f.pool.query('SELECT * FROM b2b_health')).rowCount, 0);
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_operation')).rowCount, 0);
  });
});

test('owner edits use canonical medical-unit/duplicate/future validation and cannot override owner identity', async () => {
  await withHealthFixture(async (f) => {
    for (const data of [
      { ...emptyHealth(), measurements: [{ ...measurement(), weightKg: -10 }] },
      { ...emptyHealth(), measurements: [measurement(), measurement()] },
      { ...emptyHealth(), profile: { birthDate: '2099-01-01' } },
      {
        ...emptyHealth(),
        measurements: [{ ...measurement(), modifiedAt: '2099-01-01T00:00:00Z' }],
      },
    ])
      await assert.rejects(
        f.as((c) =>
          f.services.saveOwnHealth(c, { operationId: randomUUID(), expectedRevision: 0, data }),
        ),
        errorCode('INVALID_INPUT'),
      );
    await assert.rejects(
      f.as((c) =>
        f.services.saveOwnHealth(c, {
          operationId: randomUUID(),
          expectedRevision: 0,
          ownerId: 'other',
          data: emptyHealth(),
        } as never),
      ),
      errorCode('INVALID_INPUT'),
    );
    const own = await f.as((c) =>
      f.services.saveOwnHealth(c, {
        operationId: randomUUID(),
        expectedRevision: 0,
        data: { ...emptyHealth(), measurements: [measurement()] },
      }),
    );
    await f.as((c) =>
      f.services.saveOwnHealth(c, {
        operationId: randomUUID(),
        expectedRevision: 1,
        data: { ...own.data, measurements: [{ ...own.data.measurements[0]!, weightKg: 82 }] },
      }),
    );
    assert.equal(
      (await f.as((c) => f.services.ownHealth(c, {}))).data.measurements[0]!.weightKg,
      82,
    );
    assert.equal((await f.as((c) => f.services.ownHealth(c, {}), 'other')).revision, 0);
  });
});

test('accumulated 4 MiB limit fails atomically and explicitly zoned observations use their local calendar', async () => {
  await withHealthFixture(async (f) => {
    const data = {
      ...emptyHealth(),
      measurements: Array.from({ length: 2000 }, (_, i) => ({
        ...measurement(`m${i}`),
        notes: 'x'.repeat(2000),
      })),
    };
    await assert.rejects(
      f.as((c) =>
        f.services.saveOwnHealth(c, { operationId: randomUUID(), expectedRevision: 0, data }),
      ),
      errorCode('INVALID_INPUT'),
    );
    f.setNow(new Date('2026-10-17T23:30:00Z'));
    await f.as((c) =>
      f.services.saveOwnHealth(c, {
        operationId: randomUUID(),
        expectedRevision: 0,
        data: {
          ...emptyHealth(),
          measurements: [{ ...measurement(), date: '2026-10-18', timeZone: 'Pacific/Kiritimati' }],
        },
      }),
    );
    assert.equal((await f.as((c) => f.services.ownHealth(c, {}))).revision, 1);
  });
});

test('two concurrent confirmations serialize once; concurrent independent stale edits conflict', async () => {
  await withHealthFixture(async (f) => {
    const request = {
      operationId: randomUUID(),
      expectedRevision: 0,
      format: 'klisteniapp.health' as const,
      version: 1 as const,
      raw: importFile(),
    };
    const preview = await f.as((c) => f.services.previewHealthImport(c, request));
    const responses = await Promise.all([
      f.as((c) =>
        f.services.applyHealthImport(c, { ...request, previewHash: preview.previewHash }),
      ),
      f.as((c) =>
        f.services.applyHealthImport(c, { ...request, previewHash: preview.previewHash }),
      ),
    ]);
    assert.deepEqual(responses[0], responses[1]);
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_operation')).rowCount, 1);
    const edits = await Promise.allSettled(
      [1, 2].map((n) =>
        f.as((c) =>
          f.services.saveOwnHealth(c, {
            operationId: randomUUID(),
            expectedRevision: 1,
            data: { ...responses[0]!.data, profile: { context: `Edit ${n}` } },
          }),
        ),
      ),
    );
    assert.equal(edits.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(
      edits.some((r) => r.status === 'rejected' && errorCode('REVISION_CONFLICT')(r.reason)),
    );
  });
});
