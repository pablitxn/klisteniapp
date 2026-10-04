import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { createDefaultPersonalData } from '@klisteniapp/scene-schema';
import { StateRepository } from '../src/state.ts';

const repository = new StateRepository({} as Pool, () => new Date('2026-10-05T10:00:00Z'));

test('server legacy settings updates preserve health, language, theme and palette', () => {
  const settings = createDefaultPersonalData('Original', 'UTC').settings;
  settings.profile.language = 'fr';
  settings.profile.theme = 'dark';
  settings.profile.colorTheme = 'ocean';
  settings.health!.profile.heightCm = 178;
  const row = { settings, revision: 4 };
  const legacy = createDefaultPersonalData('New name', 'UTC').settings;
  delete legacy.health;
  assert.equal(repository.replaceSettings(row, legacy, 4), true);
  assert.equal(row.settings.profile.displayName, 'New name');
  assert.equal(row.settings.profile.language, 'fr');
  assert.equal(row.settings.profile.theme, 'dark');
  assert.equal(row.settings.profile.colorTheme, 'ocean');
  assert.equal(row.settings.health?.profile.heightCm, 178);
});

test('server display saves reject stale revisions before changing any personal settings', () => {
  const row = { settings: createDefaultPersonalData('Original', 'UTC').settings, revision: 4 };
  const draft = structuredClone(row.settings);
  draft.profile.language = 'en';
  draft.profile.theme = 'light';
  draft.profile.colorTheme = 'sunset';
  assert.throws(() => repository.replaceSettings(row, draft, 3), /Tus datos cambiaron/);
  assert.equal(row.settings.profile.language, undefined);
  assert.equal(row.settings.profile.theme, undefined);
  assert.equal(row.settings.profile.colorTheme, undefined);
  assert.equal(repository.replaceSettings(row, draft, 4), true);
  assert.equal(row.settings.profile.language, 'en');
  assert.equal(row.settings.profile.theme, 'light');
  assert.equal(row.settings.profile.colorTheme, 'sunset');
});
