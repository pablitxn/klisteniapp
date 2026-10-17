import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { SessionRevisionSchema } from '@klisteniapp/b2b-contracts/product-v2';
import { productFixture } from '../support/product-fixture.ts';
import { authorizeExportIdentity } from '../../src/membership/access.ts';
import { createPersonalExportServices } from '../../src/exports/index.ts';
import type { AuthorizedProductIdentityContext } from '../../src/product-context.ts';
import type { DomainContext } from '../../src/domain-context.ts';

export const NOW = '2026-10-17T12:00:00.000Z';
export const domain: DomainContext = {
  id: 'atlas.b2b.test',
  host: 'atlas.b2b.test',
  organizationId: 'atlas',
  generation: 1,
  origin: 'https://atlas.b2b.test',
  primaryHost: 'atlas.b2b.test',
  canonicalOrigin: 'https://atlas.b2b.test',
  isPrimary: true,
};
export const contract = JSON.parse(
  await readFile(
    new URL('../../../../packages/b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
);
export const errorCode = (code: string) => (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === code;
export type Fixture = Parameters<Parameters<typeof productFixture>[0]>[0] & {
  own<T>(
    operation: (c: AuthorizedProductIdentityContext) => Promise<T>,
    actorId?: string,
    organizationId?: string,
    selectedDomain?: DomainContext | null,
  ): Promise<T>;
  exports: ReturnType<typeof createPersonalExportServices>;
};
export async function fixture(run: (f: Fixture) => Promise<void>) {
  return productFixture(async (f) => {
    await f.pool
      .query(`INSERT INTO b2b_domain(host,organization_id,status,primary_domain,verified_at,dns_verified_at,tls_verified_at,tls_expires_at)
      VALUES('atlas.b2b.test','atlas','active',true,now(),now(),now(),now()+interval '1 day'),
      ('sur.b2b.test','sur','active',true,now(),now(),now(),now()+interval '1 day');
      INSERT INTO b2b_session_context(session_id,organization_id,domain_host,domain_generation)
      SELECT 'session-'||user_id,organization_id,'atlas.b2b.test',1 FROM b2b_membership WHERE organization_id='atlas';`);
    await run({
      ...f,
      exports: createPersonalExportServices({ now: () => new Date(NOW) }),
      own: (operation, actorId = 'member', organizationId = 'atlas', selectedDomain = domain) =>
        f.service.transaction(async (db) =>
          operation(
            await authorizeExportIdentity(db, actorId, organizationId, `session-${actorId}`, {
              whiteLabel: selectedDomain !== null,
              domain: selectedDomain,
              contractHeader: '2',
            }),
          ),
        ),
    });
  });
}

export async function queued(f: Fixture) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (
      (
        await f.pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",
          [f.schema],
        )
      ).rowCount
    )
      return;
    await setTimeout(5);
  }
  assert.fail('Concurrent transaction did not reach the expected lock');
}

/** Synthetic issued legacy routine plus all accepted correction revisions. */
export async function seedHistory(pool: Pool, memberId = 'member', prefix = '') {
  const program = `${prefix}routine`,
    assignment = `${prefix}assignment`,
    execution = `${prefix}execution`;
  await pool.query(
    `INSERT INTO b2b_program(id,organization_id,branch_id,data,published_version) VALUES($1,'atlas','atlas-principal',$2,1)`,
    [program, { name: 'Issued routine', description: '', steps: contract.legacyRoutine.steps }],
  );
  const routine = { ...contract.legacyRoutine, programId: program };
  await pool.query(
    `INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot) VALUES('atlas','atlas-principal',$1,1,$2)`,
    [program, routine],
  );
  await pool.query(
    `INSERT INTO b2b_program_assignment(id,organization_id,branch_id,member_id,program_id,version,assigned_by)
     VALUES($1,'atlas','atlas-principal',$2,$3,1,'coach')`,
    [assignment, memberId, program],
  );
  const original = { ...contract.legacyRetry, id: execution, assignmentId: assignment };
  await pool.query(
    `INSERT INTO b2b_execution(organization_id,branch_id,id,member_id,assignment_id,data)
     VALUES('atlas','atlas-principal',$1,$2,$3,$4)`,
    [execution, memberId, assignment, original],
  );
  await pool.query(
    `INSERT INTO b2b_training_session(organization_id,branch_id,member_id,id,legacy_assignment_id,legacy_execution_id,program_id,program_version,revision)
     VALUES('atlas','atlas-principal',$1,$2,$3,$2,$4,1,2)`,
    [memberId, execution, assignment, program],
  );
  const revisions = [];
  for (const revision of [1, 2]) {
    const snapshot = SessionRevisionSchema.parse({
      schemaVersion: 2,
      id: execution,
      scope: { organizationId: 'atlas', branchId: 'atlas-principal', memberId },
      origin: {
        kind: 'legacy',
        assignmentId: assignment,
        executionId: execution,
        routine: { programId: program, version: 1, schemaVersion: 1 },
      },
      revision,
      operationId: `${prefix}correction-${revision}`,
      content: {
        status: 'partial',
        explicitCompletion: false,
        performedAt: NOW,
        notes: `Owner correction ${revision}`,
        correctionReason: 'Correct actuals',
        segments: [
          {
            segmentId: 'segment',
            originalStepId: 'step',
            exerciseId: 'exercise',
            dose: contract.dose,
            relation: null,
            confirmedConditions: [],
            createdAt: NOW,
          },
        ],
        selectedSegments: [{ originalStepId: 'step', segmentId: 'segment' }],
        sets: [
          {
            performedSetId: 'set',
            segmentId: 'segment',
            ordinal: 1,
            side: 'both',
            repetitions: revision + 5,
            durationSeconds: null,
            loadKg: 12.5,
            rpe: null,
            notes: '',
          },
        ],
      },
      actorId: memberId,
      acceptedAt: NOW,
    });
    await pool.query(
      `INSERT INTO b2b_session_revision(organization_id,branch_id,member_id,session_id,revision,schema_version,snapshot,actor_id)
       VALUES('atlas','atlas-principal',$1,$2,$3,2,$4,$1)`,
      [memberId, execution, revision, snapshot],
    );
    revisions.push(snapshot);
  }
  return { routine, original, revisions };
}
