import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool, PoolClient } from 'pg';
import { createDefaultPersonalData, type PersonalSettings, type ServerState, type YogaData, type YogaLog, type YogaPractice } from '@klisteniapp/scene-schema';
import { StateRepository, YogaRequestSchema, isYogaRemovalOnly, mergeYogaData } from '../src/state.ts';

const practice: YogaPractice = { id: 'practice', name: 'Pausa', intention: '', steps: [{ id: 'one', asanaId: 'savasana', durationSeconds: 60, side: 'both' }] };
const log: YogaLog = { id: 'log', date: '2026-10-07', completedAt: '2026-10-07T10:00:00Z', practiceSnapshot: practice, completedSteps: [{ stepId: 'one', asanaId: 'savasana', durationSeconds: 60, side: 'both' }], durationSeconds: 60 };
const yoga: YogaData = { practices: [practice], logs: [log] };
const repository = new StateRepository({} as Pool, () => new Date('2026-10-07T12:00:00Z'));

test('yoga request requires bounded valid data and an explicit revision', () => {
  assert.equal(YogaRequestSchema.safeParse({ yoga, expectedRevision: 0 }).success, true);
  for (const input of [{ yoga }, { yoga, expectedRevision: -1 }, { yoga, expectedRevision: 0, owner: 'another' }, { yoga: { ...yoga, logs: [{ ...log, durationSeconds: 61 }] }, expectedRevision: 0 }]) {
    assert.equal(YogaRequestSchema.safeParse(input).success, false);
  }
});

test('settings preserve omitted yoga and reject stale revisions or rewritten snapshots', () => {
  const settings = createDefaultPersonalData('Owner', 'UTC').settings;
  settings.yoga = structuredClone(yoga);
  const row = { settings, revision: 4 };
  const legacy = createDefaultPersonalData('Renamed', 'UTC').settings;
  assert.throws(() => repository.replaceSettings(row, legacy, 3), /Tus datos cambiaron/);
  assert.equal(repository.replaceSettings(row, legacy, 4), true);
  assert.deepEqual(row.settings.yoga, yoga);
  const changed = structuredClone(row.settings);
  changed.yoga!.logs[0].practiceSnapshot.name = 'Rewritten history';
  assert.throws(() => repository.replaceSettings(row, changed, 4), /historial no se puede reescribir/);
  assert.deepEqual(row.settings.yoga, yoga);
});

test('observation imports merge logs idempotently and restore practices only on explicit settings imports', () => {
  const current = { practices: [{ ...practice, id: 'current' }], logs: [{ ...log, id: 'current-log' }] };
  const merged = mergeYogaData(current, yoga, false);
  assert.deepEqual(merged.practices, current.practices);
  assert.equal(merged.logs.length, 2);
  assert.deepEqual(mergeYogaData(merged, yoga, false), merged);
  assert.deepEqual(mergeYogaData(current, yoga, true).practices, yoga.practices);
  assert.throws(() => mergeYogaData(merged, { ...yoga, logs: [{ ...log, notes: 'Different' }] }, false), /registro diferente/);
});

test('the unpaid deletion exception admits only subsets of unchanged yoga data', () => {
  const current = { ...createDefaultPersonalData('Owner', 'UTC').settings, yoga };
  assert.equal(isYogaRemovalOnly(current, { ...current, yoga: { practices: [], logs: [log] } }), true);
  assert.equal(isYogaRemovalOnly(current, { ...current, yoga: { practices: [practice], logs: [] } }), true);
  assert.equal(isYogaRemovalOnly(current, { ...current, yoga: { practices: [], logs: [] } }), true);
  assert.equal(isYogaRemovalOnly(current, current), false);
  assert.equal(isYogaRemovalOnly(current, { ...current, yoga: { practices: [], logs: [{ ...log, notes: 'Changed' }] } }), false);
  assert.equal(isYogaRemovalOnly(current, { ...current, profile: { ...current.profile, displayName: 'Changed' }, yoga: { practices: [], logs: [] } }), false);
  assert.equal(isYogaRemovalOnly(current, { ...current, yoga: { practices: [], logs: [log, { ...log, id: 'new' }] } }), false);
});

test('repository yoga writes permit expired deletion and report stale retries before checking access', async () => {
  const owners = new Map<string, { settings: PersonalSettings; revision: number }>();
  for (const id of ['a', 'b']) owners.set(id, { settings: createDefaultPersonalData(id, 'UTC').settings, revision: 0 });
  let paid = true;
  const client = { query: async (_sql: string, [ownerId]: string[]) => {
    assert.equal(ownerId, 'a');
    return { rows: [{ lifetime: paid, trial_ends_at: null, paid_through: null }] };
  } } as unknown as PoolClient;
  class TestRepository extends StateRepository {
    override async transaction(owner: { id: string; name: string }, operation: (client: PoolClient, row: { settings: PersonalSettings; revision: number }) => Promise<boolean>, cloudWrite = true): Promise<ServerState> {
      assert.equal(cloudWrite, false, 'yoga enforces access only after examining its diff');
      const row = structuredClone(owners.get(owner.id)!);
      if (await operation(client, row)) row.revision++;
      owners.set(owner.id, row);
      return { data: { ...createDefaultPersonalData(owner.name), settings: row.settings }, revision: row.revision };
    }
  }
  const instance = new TestRepository({} as Pool);
  const owner = { id: 'a', name: 'A' };
  assert.equal((await instance.yoga(owner, { yoga, expectedRevision: 0 })).revision, 1);
  assert.equal(owners.get('b')!.settings.yoga, undefined);
  await assert.rejects(instance.yoga(owner, { yoga, expectedRevision: 0 }), /Tus datos cambiaron/);
  paid = false;
  await assert.rejects(instance.yoga(owner, { yoga: { ...yoga, practices: [{ ...practice, name: 'Edit' }] }, expectedRevision: 1 }), /acceso a la nube venció/);
  const deleted = await instance.yoga(owner, { yoga: { practices: [], logs: [] }, expectedRevision: 1 });
  assert.equal(deleted.revision, 2);
  assert.deepEqual(deleted.data.settings.yoga, { practices: [], logs: [] });
  // A lost response or another device's deletion leaves this request stale.
  // Report conflict before access so the client can refresh the canonical state.
  for (const staleYoga of [{ practices: [], logs: [] }, yoga]) {
    await assert.rejects(instance.yoga(owner, { yoga: staleYoga, expectedRevision: 1 }), { status: 409, code: 'REVISION_CONFLICT' });
  }
  await assert.rejects(instance.yoga(owner, { yoga, expectedRevision: 2 }), { status: 402, code: 'CLOUD_ACCESS_REQUIRED' });
  assert.deepEqual(owners.get('a'), { settings: deleted.data.settings, revision: 2 });
});

test('repository imports merge yoga observations without settings and legacy restores preserve the existing library', async () => {
  let row = { settings: createDefaultPersonalData('Owner', 'UTC').settings, revision: 0 };
  row.settings.yoga = { practices: [{ ...practice, id: 'retained' }], logs: [{ ...log, id: 'retained-log' }] };
  const client = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as PoolClient;
  class ImportRepository extends StateRepository {
    override async transaction(owner: { id: string; name: string }, operation: (client: PoolClient, row: { settings: PersonalSettings; revision: number }) => Promise<boolean>): Promise<ServerState> {
      assert.equal(owner.id, 'owner');
      const draft = structuredClone(row);
      if (await operation(client, draft)) draft.revision++;
      row = draft;
      return { data: { ...createDefaultPersonalData(owner.name), settings: row.settings }, revision: row.revision };
    }
  }
  const instance = new ImportRepository({} as Pool);
  const owner = { id: 'owner', name: 'Owner' };
  const backup = createDefaultPersonalData('Imported', 'UTC');
  backup.settings.yoga = yoga;
  const result = await instance.import(owner, { data: backup, includeSettings: false });
  assert.equal(result.revision, 1);
  assert.equal(result.data.settings.profile.displayName, 'Owner');
  assert.equal(result.data.settings.yoga!.practices[0].id, 'retained');
  assert.deepEqual(result.data.settings.yoga!.logs.map(record => record.id), ['retained-log', 'log']);
  assert.equal((await instance.import(owner, { data: backup, includeSettings: false })).revision, 1);
  const legacy = createDefaultPersonalData('Legacy import', 'UTC');
  const restored = await instance.import(owner, { data: legacy, includeSettings: true, expectedRevision: 1 });
  assert.equal(restored.data.settings.profile.displayName, 'Legacy import');
  assert.deepEqual(restored.data.settings.yoga, result.data.settings.yoga);
});
