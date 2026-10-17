import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildTopology } from '../apps/b2c-web/e2e/fixtures/b2b-product/topology.ts'
import { createAuth } from '../apps/b2b-api/src/auth.ts'
import { SCHEMA, LIFECYCLE_SCHEMA, CONTENT_SCHEMA } from '../apps/b2b-api/src/database.ts'
import {
  WHITE_LABEL_SCHEMA,
  WHITE_LABEL_PROFILE_SCHEMA,
} from '../apps/b2b-api/src/white-label-schema.ts'
import { migrate } from '../apps/b2b-api/src/migrate.ts'
import { seedWhiteLabelDemo } from '../apps/b2b-api/src/white-label-demo.ts'
import { B2BService, createUser } from '../apps/b2b-api/src/service.ts'
import { ExecutionInputSchema } from '../packages/b2b-contracts/src/training.ts'
import {
  DoseSchema,
  RoutineDraftContentSchema,
  RoutineVersionV2Schema,
} from '../packages/b2b-contracts/src/product-v2.ts'
const requireApi = createRequire(new URL('../apps/b2b-api/package.json', import.meta.url))
const { getMigrations } = await import(requireApi.resolve('better-auth/db/migration'))
export const PRODUCT_TEST_PASSWORD = 'b2b-product-synthetic-password-2026'
const sha256 = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex')

async function originalRows(pool) {
  const queries = {
    versions:
      'SELECT organization_id,branch_id,program_id,version,snapshot::text FROM b2b_program_version ORDER BY organization_id,branch_id,program_id,version',
    assignments: 'SELECT * FROM b2b_program_assignment ORDER BY id',
    executions: 'SELECT * FROM b2b_execution ORDER BY organization_id,id',
    audit:
      'SELECT id,organization_id,actor_id,action,resource_id,created_at FROM b2b_audit ORDER BY id',
    media: 'SELECT * FROM b2b_media ORDER BY id',
    grants: 'SELECT * FROM b2b_branch_grant ORDER BY organization_id,branch_id,user_id,role',
  }
  return Object.fromEntries(
    await Promise.all(
      Object.entries(queries).map(async ([key, sql]) => [key, (await pool.query(sql)).rows]),
    ),
  )
}

/** Synthetic harness bootstrap only, never a runtime migration alternative.
 * Build the historical 001-005 state, then invoke the normal migration registry.
 * No frozen migration, product route, ACCESS module or catalog source is edited. */
export async function seedProductHarness(pool, config, runKey) {
  const topology = buildTopology(runKey)
  const auth = createAuth(pool, config, { migrating: true })
  if ((await pool.query("SELECT to_regclass('b2b_migration') AS existing")).rows[0].existing)
    throw new Error('Product harness seeding requires a fresh task-owned schema')
  await (await getMigrations(auth.options)).runMigrations()
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await db.query(
      SCHEMA + LIFECYCLE_SCHEMA + CONTENT_SCHEMA + WHITE_LABEL_SCHEMA + WHITE_LABEL_PROFILE_SCHEMA,
    )
    await db.query(`CREATE TABLE b2b_migration(id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO b2b_migration(id) VALUES ('001-initial'),('002-catalog-lifecycle'),('003-content-media'),('004-white-label'),('005-branch-publication-profile')`)
    await db.query('COMMIT')
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
  const demo = await seedWhiteLabelDemo(
    pool,
    auth,
    { ...config, production: false },
    PRODUCT_TEST_PASSWORD,
  )
  const organizations = Object.fromEntries(
    topology.brands.map((brand, index) => {
      const gym = demo.gyms[index]
      return [
        brand.key,
        {
          id: gym.id,
          slug: gym.slug,
          host: brand.host,
          timezone: brand.timezone,
          branches: Object.fromEntries(
            brand.branches.map((branch, i) => [branch.key, gym.branches[i].id]),
          ),
        },
      ]
    }),
  )
  const actors = {}
  const transaction = await pool.connect()
  try {
    await transaction.query('BEGIN')
    await transaction.query("SELECT set_config('b2b.explicit_branch_scope','on',true)")
    for (const actor of topology.actors) {
      const user = await createUser(transaction, auth, {
        email: actor.email,
        name: actor.key,
        password: PRODUCT_TEST_PASSWORD,
      })
      actors[actor.key] = {
        id: user.id,
        email: user.email,
        legacyFullAdmin: actor.legacyFullAdmin,
        memberships: actor.memberships.map((membership) => ({
          organizationId: organizations[membership.brandKey].id,
          intendedRole: membership.intendedRole,
          active: membership.active,
        })),
        grants: actor.grants
          .filter((grant) => ['coach', 'member'].includes(grant.intendedRole))
          .map((grant) => ({
            organizationId: organizations[grant.brandKey].id,
            branchId: organizations[grant.brandKey].branches[grant.branchKey],
            role: grant.intendedRole,
          })),
      }
      for (const membership of actors[actor.key].memberships) {
        if (!actor.legacyFullAdmin && ['admin', 'superadmin'].includes(membership.intendedRole))
          continue
        await transaction.query(
          'INSERT INTO b2b_membership(organization_id,user_id,role,active) VALUES($1,$2,$3,$4)',
          [membership.organizationId, user.id, membership.intendedRole, membership.active],
        )
      }
      for (const grant of actors[actor.key].grants)
        await transaction.query(
          'INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES($1,$2,$3,$4)',
          [grant.organizationId, grant.branchId, user.id, grant.role],
        )
    }
    for (const assignment of topology.coachAssignments)
      await transaction.query(
        'INSERT INTO b2b_coach_assignment(organization_id,branch_id,coach_id,member_id) VALUES($1,$2,$3,$4)',
        [
          organizations[assignment.brandKey].id,
          organizations[assignment.brandKey].branches[assignment.branchKey],
          actors[assignment.coachKey].id,
          actors[assignment.memberKey].id,
        ],
      )
    await transaction.query('COMMIT')
  } catch (error) {
    await transaction.query('ROLLBACK')
    throw error
  } finally {
    transaction.release()
  }

  const legacy = []
  for (const [index, assignment] of topology.coachAssignments.entries()) {
    const gym = demo.gyms[index],
      branch = gym.branches[0],
      member = actors[assignment.memberKey],
      coach = actors[assignment.coachKey]
    const assignmentId = randomUUID(),
      executionId = randomUUID(),
      mediaId = randomUUID()
    await pool.query(
      'INSERT INTO b2b_program_assignment(id,organization_id,branch_id,member_id,program_id,version,assigned_by) VALUES($1,$2,$3,$4,$5,1,$6)',
      [assignmentId, gym.id, branch.id, member.id, branch.programId, coach.id],
    )
    const snapshot = (
      await pool.query(
        'SELECT snapshot FROM b2b_program_version WHERE organization_id=$1 AND program_id=$2 AND version=1',
        [gym.id, branch.programId],
      )
    ).rows[0].snapshot
    const execution = ExecutionInputSchema.parse({
      id: executionId,
      assignmentId,
      status: 'partial',
      sets: [
        { stepId: snapshot.steps[0].id, set: 1, exerciseId: snapshot.steps[0].exerciseId, reps: 8 },
      ],
      notes: 'Synthetic preserved actuals',
      completedAt: '2026-10-01T10:00:00Z',
    })
    await pool.query(
      'INSERT INTO b2b_execution(organization_id,id,member_id,assignment_id,data,branch_id) VALUES($1,$2,$3,$4,$5,$6)',
      [gym.id, executionId, member.id, assignmentId, execution, branch.id],
    )
    await pool.query(
      "INSERT INTO b2b_audit(organization_id,actor_id,action,resource_id) VALUES($1,$2,'fixture.legacy-assignment',$3)",
      [gym.id, coach.id, assignmentId],
    )
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
      'base64',
    )
    const relative = `${mediaId.slice(0, 2)}/${mediaId}.png`
    mkdirSync(join(config.mediaRoot, mediaId.slice(0, 2)), { recursive: true })
    writeFileSync(join(config.mediaRoot, relative), bytes, { mode: 0o600 })
    await pool.query(
      "INSERT INTO b2b_media(id,organization_id,branch_id,created_by,kind,label,relative_path,mime,bytes,sha256) VALUES($1,$2,$3,$4,'image','Synthetic history',$5,'image/png',$6,$7)",
      [
        mediaId,
        gym.id,
        branch.id,
        coach.id,
        relative,
        bytes.length,
        createHash('sha256').update(bytes).digest('hex'),
      ],
    )
    legacy.push({
      organizationId: gym.id,
      branchId: branch.id,
      memberId: member.id,
      coachId: coach.id,
      programId: branch.programId,
      version: 1,
      assignmentId,
      executionId,
      mediaId,
    })
  }
  const before = await originalRows(pool)
  await migrate(pool, auth)
  await migrate(pool, auth)
  const after = await originalRows(pool)
  // The new migration emits explicit system audit; preserve all pre-existing rows exactly.
  after.audit = after.audit.filter((row) => before.audit.some((old) => old.id === row.id))
  assert.deepEqual(after, before, 'Historical seed rows changed during upgrade')
  for (const actor of topology.actors) {
    for (const membership of actors[actor.key].memberships) {
      if (actor.legacyFullAdmin || !['admin', 'superadmin'].includes(membership.intendedRole))
        continue
      await pool.query(
        'INSERT INTO b2b_membership(organization_id,user_id,role,product_role,active) VALUES($1,$2,$3,$4,$5)',
        [
          membership.organizationId,
          actors[actor.key].id,
          'admin',
          membership.intendedRole,
          membership.active,
        ],
      )
    }
  }
  const seedFixture = JSON.parse(
    readFileSync(
      new URL('../packages/b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
      'utf8',
    ),
  )
  const v2 = []
  for (const gym of demo.gyms) {
    const branch = gym.branches[1],
      id = randomUUID()
    const source = (
      await pool.query(
        'SELECT snapshot FROM b2b_program_version WHERE organization_id=$1 AND program_id=$2 AND version=1',
        [gym.id, branch.programId],
      )
    ).rows[0].snapshot
    const content = RoutineDraftContentSchema.parse({
      name: 'Synthetic range prescription',
      description: '',
      steps: [
        {
          id: 'range-step',
          exerciseId: source.steps[0].exerciseId,
          dose: DoseSchema.parse(seedFixture.dose),
          substitutionPolicy: 'reviewed',
        },
      ],
    })
    const snapshot = RoutineVersionV2Schema.parse({
      ...content,
      schemaVersion: 2,
      programId: id,
      version: 1,
      scope: { organizationId: gym.id, branchId: branch.id },
      publishedAt: '2026-10-01T10:00:00Z',
      exercises: source.exercises,
      machines: source.machines,
      relations: [],
    })
    await pool.query(
      'INSERT INTO b2b_program(id,organization_id,branch_id,data,published_version,schema_version) VALUES($1,$2,$3,$4,1,2)',
      [id, gym.id, branch.id, content],
    )
    await pool.query(
      'INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot,schema_version) VALUES($1,$2,$3,1,$4,2)',
      [gym.id, branch.id, id, snapshot],
    )
    v2.push({
      organizationId: gym.id,
      branchId: branch.id,
      programId: id,
      version: 1,
      assigned: false,
    })
  }
  assert.equal(
    (await pool.query('SELECT 1 FROM b2b_organization WHERE product_active')).rowCount,
    0,
  )
  assert.equal(
    (
      await pool.query('SELECT 1 FROM b2b_platform_admin WHERE user_id=ANY($1::text[])', [
        Object.values(actors).map((actor) => actor.id),
      ])
    ).rowCount,
    0,
  )
  if (config.activateProductFixture === true) {
    // This function has already proved the schema is fresh and task-owned, and
    // preserved historical 001-005 rows through repeated normal migrations.
    await pool.query('UPDATE b2b_organization SET product_active=true')
    const service = new B2BService(pool, auth, {
      ...config,
      productUnified: false,
      whiteLabel: false,
    })
    const today = new Date(),
      monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    monday.setUTCDate(monday.getUTCDate() + 1 - (monday.getUTCDay() || 7))
    const date = (offset) => {
      const d = new Date(monday)
      d.setUTCDate(d.getUTCDate() + offset)
      return d.toISOString().slice(0, 10)
    }
    for (const resource of v2) {
      const coach = Object.values(actors).find((a) =>
        a.grants.some(
          (g) =>
            g.organizationId === resource.organizationId &&
            g.branchId === resource.branchId &&
            g.role === 'coach',
        ),
      )
      const member = Object.values(actors).find(
        (a) =>
          a.grants.some(
            (g) =>
              g.organizationId === resource.organizationId &&
              g.branchId === resource.branchId &&
              g.role === 'member',
          ) && a.memberships.some((m) => m.organizationId === resource.organizationId && m.active),
      )
      assert.ok(coach && member)
      const sessionId = randomUUID()
      await pool.query(
        `INSERT INTO b2b_auth_session(id,"userId",token,"expiresAt","createdAt","updatedAt") VALUES($1,$2,$3,now()+interval '5 minutes',now(),now())`,
        [sessionId, coach.id, randomUUID()],
      )
      try {
        const reference = {
          programId: resource.programId,
          version: resource.version,
          schemaVersion: 2,
        }
        const content = {
          name: 'Synthetic goal program',
          goal: 'Synthetic scheduled training',
          timeZone: 'UTC',
          stages: [
            {
              id: 'synthetic-stage',
              name: 'Current stage',
              startDate: date(0),
              endDate: date(13),
              slots: [
                { id: 'monday', weekday: 1, routine: reference },
                { id: 'wednesday', weekday: 3, routine: reference },
                { id: 'friday', weekday: 5, routine: reference },
              ],
            },
          ],
        }
        const execute = (operation) =>
          service.productOrganization(
            coach.id,
            resource.organizationId,
            sessionId,
            true,
            '2',
            operation,
            { branchId: resource.branchId, role: 'coach' },
          )
        const goal = await execute((c) =>
          service.productProducers.saveGoal(c, {
            id: randomUUID(),
            memberId: member.id,
            operationId: randomUUID(),
            expectedRevision: 0,
            content,
          }),
        )
        const enrollment = await execute((c) =>
          service.productProducers.enroll(c, {
            id: randomUUID(),
            memberId: member.id,
            goalProgramId: goal.id,
            issuedGoalRevision: goal.revision,
            operationId: randomUUID(),
            expectedRevision: 0,
            content,
          }),
        )
        Object.assign(resource, {
          assigned: true,
          memberId: member.id,
          coachId: coach.id,
          goalProgramId: goal.id,
          enrollmentId: enrollment.id,
          occurrenceIds: (
            await pool.query(
              'SELECT id FROM b2b_occurrence WHERE organization_id=$1 AND branch_id=$2 AND enrollment_id=$3 ORDER BY id',
              [resource.organizationId, resource.branchId, enrollment.id],
            )
          ).rows.map((r) => r.id),
        })
      } finally {
        await pool.query('DELETE FROM b2b_auth_session WHERE id=$1', [sessionId])
      }
    }
  }
  return {
    fixtureVersion: 2,
    runKey,
    phase: config.activateProductFixture ? 'composed-product' : 'foundation-baseline',
    featuresActivated: Boolean(config.activateProductFixture),
    organizations,
    actors,
    resources: { legacy, v2 },
    preservation: {
      beforeSha256: sha256(before),
      afterSha256: sha256(after),
      counts: Object.fromEntries(Object.entries(before).map(([key, rows]) => [key, rows.length])),
    },
    featureGates: {
      businessHandlers: config.activateProductFixture ? 'composed-local-candidate' : 'inactive',
      goalScheduleSeeds: config.activateProductFixture
        ? 'production-service-synthetic'
        : 'inactive',
      healthSharing: 'none',
    },
  }
}
