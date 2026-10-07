import assert from 'node:assert/strict';
import test from 'node:test';
import { YogaAsanaIdSchema, YogaPracticeSchema } from '@klisteniapp/scene-schema';
import { asanas, getAsana, yogaContext, yogaPracticeTemplates, yogaSources } from '../src/data/yoga.ts';

test('the yoga catalog resolves every persisted asana and keeps useful instruction and context', () => {
  assert.equal(asanas.length, new Set(asanas.map(asana => asana.id)).size);
  assert.deepEqual(new Set(asanas.map(asana => asana.id)), new Set(YogaAsanaIdSchema.options));
  assert.ok(asanas.length >= 24);
  assert.ok(new Set(asanas.map(asana => asana.family)).size >= 6);
  for (const asana of asanas) {
    assert.equal(getAsana(asana.id), asana);
    for (const field of ['name', 'sanskritName', 'englishName', 'description', 'intention', 'breathing', 'history', 'culturalContext'] as const) {
      assert.ok(asana[field].trim().length > 0, `${asana.id}: missing ${field}`);
    }
    for (const field of ['aliases', 'setup', 'steps', 'exit', 'sensations', 'mistakes', 'adaptations', 'cautions'] as const) {
      assert.ok(asana[field].length > 0, `${asana.id}: missing ${field}`);
      assert.ok(asana[field].every(item => item.trim().length > 0), `${asana.id}: empty ${field}`);
    }
    assert.ok(asana.steps.length >= 3, `${asana.id}: preparation alone is not a demonstration`);
    assert.ok(Number.isInteger(asana.defaultHoldSeconds) && asana.defaultHoldSeconds >= 5);
    assert.ok(asana.bilateral || asana.sideGuide, `${asana.id}: the reference side must be unambiguous`);
    assert.ok(asana.sources.length >= 1, `${asana.id}: no learning reference`);
    for (const source of asana.sources) {
      assert.equal(new URL(source.url).protocol, 'https:');
      assert.ok(source.title.trim().length > 0);
    }
  }
  assert.equal(getAsana('unknown-asana'), undefined);
});

test('editable starter practices are valid, have balanced sides and reserve time for rest', () => {
  assert.equal(yogaPracticeTemplates.length, 3);
  assert.equal(new Set(yogaPracticeTemplates.map(practice => practice.id)).size, yogaPracticeTemplates.length);
  const totalDurations = [];
  for (const template of yogaPracticeTemplates) {
    assert.ok(YogaPracticeSchema.safeParse(template).success, template.id);
    assert.ok(template.description.trim().length > 0);
    const unilateralDurations = new Map<string, { left: number; right: number }>();
    for (const step of template.steps) {
      const asana = getAsana(step.asanaId);
      assert.ok(asana, `${template.id}: unresolved ${step.asanaId}`);
      assert.equal(asana.level, 'Inicial', `${template.id}: initial templates should use accessible foundations`);
      if (asana.bilateral) {
        assert.equal(step.side, 'both', `${template.id}: bilateral pose cannot claim a side`);
      } else {
        assert.notEqual(step.side, 'both', `${template.id}: unilateral pose needs a side`);
        const durations = unilateralDurations.get(asana.id) ?? { left: 0, right: 0 };
        if (step.side !== 'both') durations[step.side] += step.durationSeconds;
        unilateralDurations.set(asana.id, durations);
      }
    }
    for (const [asanaId, durations] of unilateralDurations) {
      assert.equal(durations.left, durations.right, `${template.id}: ${asanaId} must offer equal time on both sides`);
      assert.ok(durations.left > 0);
    }
    assert.equal(template.steps.at(-1)?.asanaId, 'savasana');
    assert.ok(template.steps.at(-1)!.durationSeconds >= 120);
    totalDurations.push(template.steps.reduce((total, step) => total + step.durationSeconds, 0));
  }
  assert.deepEqual(totalDurations, [600, 600, 480], 'template descriptions must match planned holds, excluding transitions');
});

test('the introduction distinguishes cultural context, personal choice and practice guidance', () => {
  assert.ok(yogaContext.description.includes('India'));
  assert.ok(yogaContext.principles.some(principle => principle.includes('historia documentada')));
  assert.ok(yogaContext.practiceNote.includes('dolor'));
  assert.ok(yogaSources.some(source => new URL(source.url).hostname === 'www.nccih.nih.gov'));
  assert.ok(yogaSources.some(source => new URL(source.url).hostname === 'www.soas.ac.uk'));
});
