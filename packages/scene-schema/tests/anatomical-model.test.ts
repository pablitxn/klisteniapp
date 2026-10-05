import assert from 'node:assert/strict';
import test from 'node:test';
import { AnatomicalModelVariantSchema, PersonalSettingsSchema, createDefaultPersonalData, preserveOptionalPersonalSettings } from '../src/index.ts';

test('model variants are explicit visual settings and legacy omission stays distinguishable', () => {
  const settings = createDefaultPersonalData('Legacy', 'UTC').settings;
  assert.equal(PersonalSettingsSchema.parse(settings).anatomicalModel, undefined);
  for (const anatomicalModel of AnatomicalModelVariantSchema.options) {
    assert.equal(PersonalSettingsSchema.parse({ ...settings, anatomicalModel }).anatomicalModel, anatomicalModel);
  }
  for (const anatomicalModel of ['unknown', '', null, 1]) {
    assert.equal(PersonalSettingsSchema.safeParse({ ...settings, anatomicalModel }).success, false);
  }
});

test('older clients preserve a selected model while explicit selections can replace it', () => {
  const current = createDefaultPersonalData('Current', 'UTC').settings;
  current.anatomicalModel = 'female';
  current.health!.profile.sex = 'male';
  const legacy = createDefaultPersonalData('Renamed', 'UTC').settings;
  delete legacy.health;
  const preserved = preserveOptionalPersonalSettings(current, legacy);
  assert.equal(preserved.anatomicalModel, 'female');
  assert.equal(preserved.profile.displayName, 'Renamed');
  assert.equal(preserved.health?.profile.sex, 'male');
  const explicit = preserveOptionalPersonalSettings(current, { ...legacy, anatomicalModel: 'male' });
  assert.equal(explicit.anatomicalModel, 'male');
  assert.deepEqual(explicit.routines, current.routines);
});
