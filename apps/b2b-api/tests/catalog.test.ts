import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
  BrandInputSchema,
  ExerciseInputSchema,
  MachineInputSchema,
  UnitInputSchema,
  type Role,
} from '@klisteniapp/b2b-contracts';
import { CatalogModule } from '../src/catalog/index.ts';
import { EquipmentModule } from '../src/equipment/index.ts';
import { HttpError } from '../src/errors.ts';
import type { Context } from '../src/organization-context.ts';

test('extracted catalogue and equipment modules reject unauthorized writes before touching dependencies', async () => {
  const untouched = () => {
    assert.fail('Unauthorized operation reached a dependency');
  };
  const catalog = new CatalogModule(async () => untouched());
  const equipment = new EquipmentModule({ validateMachine: async () => untouched() }, async () =>
    untouched(),
  );
  const context = (role: Role): Context => ({
    db: { query: untouched } as unknown as PoolClient,
    actorId: 'actor',
    role,
    org: {
      id: 'gym',
      slug: 'gym',
      brand: BrandInputSchema.parse({ name: 'Gym' }),
      service_enabled: true,
      service_ends_at: null,
    },
  });
  const machine = MachineInputSchema.parse({ name: 'Press', type: 'press' });
  const movement = ExerciseInputSchema.parse({ name: 'Press', instructions: ['Contenido.'] });
  const unit = UnitInputSchema.parse({ machineId: 'press', label: 'Press 1' });
  const forbidden = (error: unknown) =>
    error instanceof HttpError && error.status === 403 && error.code === 'FORBIDDEN';
  for (const role of ['member', 'coach'] as const) {
    const c = context(role);
    await assert.rejects(catalog.createMachine(c, machine), forbidden);
    await assert.rejects(catalog.updateMachine(c, 'press', machine, 0), forbidden);
    await assert.rejects(catalog.transitionMachine(c, 'press', 0, false), forbidden);
    await assert.rejects(catalog.transitionMachine(c, 'press', 0, true), forbidden);
    await assert.rejects(equipment.createUnit(c, unit), forbidden);
    await assert.rejects(equipment.updateUnit(c, 'unit', unit, 0), forbidden);
    await assert.rejects(equipment.batchUnits(c, { id: 'batch', units: [unit] }), forbidden);
  }
  const member = context('member');
  await assert.rejects(catalog.createExercise(member, movement), forbidden);
  await assert.rejects(catalog.updateExercise(member, 'exercise', movement, 0), forbidden);
  await assert.rejects(catalog.reviewExercise(member, 'exercise', 0), forbidden);
  await assert.rejects(catalog.publishExercise(member, 'exercise', 0), forbidden);
});
