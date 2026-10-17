import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productFixture, databaseUrl } from './support/product-fixture.ts';
import { seedHistory } from './wp06/fixture.ts';
import { legacyAssignments, historySubjects } from '../src/product-history.ts';
import { routineSupplement, workoutEquipment } from '../src/product-reads.ts';

test(
  'history readers retain retired archived inactive subjects without broader branch or member enumeration',
  { skip: !databaseUrl },
  async () =>
    productFixture(async (f) => {
      await seedHistory(f.pool);
      const before = (
        await f.pool.query(
          'SELECT snapshot::text FROM b2b_program_version ORDER BY program_id,version',
        )
      ).rows;
      await f.pool.query(
        "UPDATE b2b_program_assignment SET active=false WHERE id='assignment';UPDATE b2b_program SET archived_at=now() WHERE id='routine'",
      );
      const read = () =>
        f.scoped('member', 'atlas-principal', false, (c) =>
          legacyAssignments(c, { memberId: 'member' }),
        );
      const assignments = await read();
      assert.equal(assignments.length, 1);
      assert.equal(assignments[0].active, false);
      assert.ok(assignments[0].archivedAt);
      assert.deepEqual(assignments[0].routine, {
        programId: 'routine',
        version: 1,
        schemaVersion: 1,
      });
      await assert.rejects(
        f.scoped('member', 'atlas-principal', false, (c) =>
          legacyAssignments(c, { memberId: 'north-member' }),
        ),
      );
      await assert.rejects(f.scoped('member', 'atlas-principal', false, (c) => historySubjects(c)));
      assert.equal(
        await f.scoped('member', 'atlas-principal', false, (c) =>
          routineSupplement(c, { id: 'routine', version: 1 }),
        ),
        null,
      );
      assert.deepEqual(
        await f.scoped('member', 'atlas-principal', false, (c) => workoutEquipment(c)),
        { activeMachineIds: [] },
      );
      await f.pool.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member';UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      const roster = await f.scoped('coach', 'atlas-principal', false, (c) => historySubjects(c));
      assert.deepEqual(
        roster.members.find((m) => m.userId === 'member'),
        { userId: 'member', name: 'member', active: false },
      );
      assert.ok(!roster.members.some((m) => m.userId === 'foreign'));
      assert.equal(
        (
          await f.scoped('coach', 'atlas-principal', false, (c) =>
            legacyAssignments(c, { memberId: 'member' }),
          )
        ).length,
        1,
      );
      await assert.rejects(read());
      assert.deepEqual(
        (
          await f.pool.query(
            'SELECT snapshot::text FROM b2b_program_version ORDER BY program_id,version',
          )
        ).rows,
        before,
      );
    }),
);
