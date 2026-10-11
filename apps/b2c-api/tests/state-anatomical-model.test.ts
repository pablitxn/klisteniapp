import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { createDefaultPersonalData } from '@klisteniapp/scene-schema';
import { StateRepository } from '../src/state.ts';

const repository = new StateRepository({} as Pool, () => new Date('2026-10-05T10:00:00Z'));

test('server saves model preferences independently of health and rejects stale replacements', () => {
  const settings = createDefaultPersonalData('Original', 'UTC').settings;
  settings.health!.profile.sex = 'male';
  const row = { settings, revision: 4 };
  const draft = { ...structuredClone(settings), anatomicalModel: 'female' as const };
  assert.throws(() => repository.replaceSettings(row, draft, 3), /Tus datos cambiaron/);
  assert.equal(row.settings.anatomicalModel, undefined);
  assert.equal(repository.replaceSettings(row, draft, 4), true);
  assert.equal(row.settings.anatomicalModel, 'female');
  assert.equal(row.settings.health?.profile.sex, 'male');
  const legacy = createDefaultPersonalData('New name', 'UTC').settings;
  delete legacy.health;
  assert.equal(repository.replaceSettings(row, legacy, 4), true);
  assert.equal(row.settings.anatomicalModel, 'female');
  assert.equal(row.settings.profile.displayName, 'New name');
  assert.equal(row.settings.health?.profile.sex, 'male');
});
