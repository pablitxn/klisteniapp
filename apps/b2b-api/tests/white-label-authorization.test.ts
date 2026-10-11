import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, describe, test } from 'node:test';
import { Pool, type PoolClient } from 'pg';
import {
  BranchInputSchema,
  ThemeInputSchema,
  ExerciseInputSchema,
  type Role,
} from '@klisteniapp/b2b-contracts';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { seedWhiteLabelDemo } from '../src/white-label-demo.ts';
import { B2BService } from '../src/service.ts';
import type { Config } from '../src/config.ts';
import type { DomainContext } from '../src/domain-context.ts';
import type { Context } from '../src/organization-context.ts';
import { HttpError } from '../src/errors.ts';
import { setPlatformModule } from '../src/operator.ts';

const databaseUrl = process.env.B2B_TEST_DATABASE_URL;
const code = (expected: string) => (error: unknown) =>
  error instanceof HttpError && error.code === expected;

describe('WL revocation, branch publication and capabilities', { skip: !databaseUrl }, () => {
  const schema = `b2b_wl_authz_${randomUUID().replaceAll('-', '')}`;
  let owner: Pool, pool: Pool, service: B2BService;
  let fixture: Awaited<ReturnType<typeof seedWhiteLabelDemo>>;
  const org = 'atlas-demo',
    principal = 'atlas-demo-principal',
    north = 'atlas-demo-norte';
  before(async () => {
    const url = new URL(databaseUrl!);
    assert.match(url.pathname, /b2b.*test|test.*b2b/i);
    assert.equal(url.searchParams.has('options'), false);
    owner = new Pool({ connectionString: url.href });
    await owner.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.href, application_name: schema });
    const config: Config = {
      databaseUrl: url.href,
      secret: 'wl-authorization-test-only-secret-123456789',
      origin: 'https://atlas.b2b.test',
      host: '127.0.0.1',
      port: 0,
      production: false,
      demoMode: true,
      whiteLabel: true,
      proxySecret: 'wl-authorization-proxy-test-only-123456789',
    };
    const auth = createAuth(pool, config, { migrating: true });
    await migrate(pool, auth);
    await migrate(pool, auth);
    fixture = await seedWhiteLabelDemo(pool, auth, config, 'wl-authorization-test-password');
    service = new B2BService(pool, auth, config);
  });
  after(async () => {
    await pool?.end();
    if (owner) {
      await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await owner.end();
    }
  });
  async function domain(organizationId = org): Promise<DomainContext> {
    const row = (
      await pool.query<{ host: string; generation: number }>(
        'SELECT host,generation FROM b2b_domain WHERE organization_id=$1 AND primary_domain',
        [organizationId],
      )
    ).rows[0];
    return {
      id: row.host,
      host: row.host,
      organizationId,
      generation: row.generation,
      origin: `https://${row.host}`,
      canonicalOrigin: `https://${row.host}`,
      primaryHost: row.host,
      isPrimary: true,
    };
  }
  async function session(userId: string, current: DomainContext) {
    const id = randomUUID();
    await pool.query(
      'INSERT INTO b2b_auth_session(id,"userId",token,"expiresAt","createdAt","updatedAt") VALUES($1,$2,$1,now()+interval \'1 hour\',now(),now())',
      [id, userId],
    );
    await pool.query(
      'INSERT INTO b2b_session_context(session_id,organization_id,domain_host,domain_generation) VALUES($1,$2,$3,$4)',
      [id, current.organizationId, current.host, current.generation],
    );
    return id;
  }
  async function scoped<T>(
    userId: string,
    branchId: string,
    role: Role,
    write: boolean,
    run: (c: Context) => Promise<T>,
  ) {
    const current = await domain();
    return service.organization(userId, org, await session(userId, current), write, run, {
      domain: current,
      branchId,
      role,
    });
  }
  const admin = <T>(run: (c: Context) => Promise<T>, branchId = principal, write = true) =>
    scoped(fixture.gyms[0].admin.id, branchId, 'admin', write, run);
  async function waitUntilQueued() {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (
        (
          await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT * FROM b2b_organization%'",
            [schema],
          )
        ).rowCount
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail('The protected request did not queue behind the organization lock');
  }
  async function queued(
    run: (
      lock: PoolClient,
      identity: { userId: string; sessionId: string; current: DomainContext },
      pending: Promise<unknown>,
    ) => Promise<void>,
  ) {
    const current = await domain(),
      userId = fixture.gyms[0].coach.id;
    const sessionId = await session(userId, current),
      lock = await pool.connect();
    try {
      await lock.query('BEGIN');
      await lock.query('SELECT id FROM b2b_organization WHERE id=$1 FOR UPDATE', [org]);
      let executed = false;
      const pending = service.organization(
        userId,
        org,
        sessionId,
        true,
        async () => {
          executed = true;
          return 'unauthorized write';
        },
        { domain: current, branchId: principal, role: 'coach' },
      );
      // Attach a rejection observer before changing the authority that wakes this request.
      void pending.catch(() => {});
      await waitUntilQueued();
      await run(lock, { userId, sessionId, current }, pending);
      assert.equal(executed, false);
    } finally {
      await lock.query('ROLLBACK');
      lock.release();
    }
  }

  test('WL mode refuses organization-only service access without verified domain context', async () => {
    const current = await domain(),
      userId = fixture.gyms[0].admin.id;
    const sessionId = await session(userId, current);
    await assert.rejects(
      service.organization(userId, org, sessionId, false, async () => true),
      code('BRAND_CONTEXT_REQUIRED'),
    );
  });
  test('D07 queued mutation rechecks a revoked branch grant after its lock is released', async () => {
    await queued(async (lock, identity, pending) => {
      await lock.query(
        "UPDATE b2b_branch_grant SET active=false WHERE organization_id=$1 AND branch_id=$2 AND user_id=$3 AND role='coach'",
        [org, principal, identity.userId],
      );
      await lock.query('COMMIT');
      await assert.rejects(pending, code('BRANCH_FORBIDDEN'));
      await pool.query(
        "UPDATE b2b_branch_grant SET active=true WHERE organization_id=$1 AND branch_id=$2 AND user_id=$3 AND role='coach'",
        [org, principal, identity.userId],
      );
    });
  });
  test('D07 queued mutation rechecks domain generation and host deactivation', async () => {
    await queued(async (lock, identity, pending) => {
      await lock.query(
        "UPDATE b2b_domain SET status='paused',generation=generation+1 WHERE host=$1",
        [identity.current.host],
      );
      await lock.query('COMMIT');
      await assert.rejects(pending, code('BRAND_SESSION_REQUIRED'));
      await pool.query("UPDATE b2b_domain SET status='active' WHERE host=$1", [
        identity.current.host,
      ]);
    });
  });
  test('D07 session and TLS expiry are checked at execution time after a queue wait', async () => {
    for (const target of ['session', 'tls']) {
      await queued(async (lock, identity, pending) => {
        if (target === 'session')
          await lock.query(
            'UPDATE b2b_auth_session SET "expiresAt"=clock_timestamp()+interval \'100 milliseconds\' WHERE id=$1',
            [identity.sessionId],
          );
        else
          await lock.query(
            "UPDATE b2b_domain SET tls_verified_at=clock_timestamp()-interval '1 hour',tls_expires_at=clock_timestamp()+interval '100 milliseconds' WHERE host=$1",
            [identity.current.host],
          );
        await new Promise((resolve) => setTimeout(resolve, 150));
        await lock.query('COMMIT');
        await assert.rejects(
          pending,
          code(target === 'session' ? 'UNAUTHENTICATED' : 'BRAND_SESSION_REQUIRED'),
        );
        if (target === 'tls')
          await pool.query(
            "UPDATE b2b_domain SET tls_expires_at=now()+interval '1 day' WHERE host=$1",
            [identity.current.host],
          );
      });
    }
  });
  test('D08 queued invitation cannot grant access after domain authority changes', async () => {
    const email = 'queued-invitation@wl.example.test';
    const invitation = await admin((c) =>
      service.invite(c, { email, name: 'Queued invitation', role: 'member' }),
    );
    const token = new URLSearchParams(new URL(invitation.url).hash.slice(1)).get('token')!;
    const current = await domain(),
      lock = await pool.connect();
    try {
      await lock.query('BEGIN');
      await lock.query('SELECT id FROM b2b_organization WHERE id=$1 FOR UPDATE', [org]);
      const pending = service.acceptInvitation(
        token,
        { name: 'Queued invitation', password: 'queued-invitation-password' },
        undefined,
        current,
      );
      void pending.catch(() => {});
      await waitUntilQueued();
      await lock.query(
        "UPDATE b2b_domain SET status='paused',generation=generation+1 WHERE host=$1",
        [current.host],
      );
      await lock.query('COMMIT');
      await assert.rejects(pending, code('DOMAIN_UNAVAILABLE'));
      assert.equal(
        (await pool.query('SELECT 1 FROM b2b_auth_user WHERE email=$1', [email])).rowCount,
        0,
      );
      assert.equal(
        (await pool.query('SELECT used_at FROM b2b_invitation WHERE email=$1', [email])).rows[0]
          .used_at,
        null,
      );
      await pool.query("UPDATE b2b_domain SET status='active' WHERE host=$1", [current.host]);
    } finally {
      await lock.query('ROLLBACK');
      lock.release();
    }
  });
  test('D12 active assignments block archive and transfer; explicit retirement preserves historical snapshots', async () => {
    const before = (
      await pool.query(
        'SELECT snapshot FROM b2b_program_version WHERE organization_id=$1 ORDER BY program_id,version',
        [org],
      )
    ).rows;
    const branch = (
      await admin((c) => service.whiteLabel.branches(c), principal, false)
    ).branches.find((b) => b.id === principal)!;
    const input = BranchInputSchema.parse({
      ...Object.fromEntries(
        Object.entries(branch).filter(
          ([key]) => !['id', 'organizationId', 'revision'].includes(key),
        ),
      ),
      status: 'archived',
    });
    await assert.rejects(
      admin((c) => service.whiteLabel.updateBranch(c, principal, input, branch.revision)),
      code('ACTIVE_ASSIGNMENTS'),
    );
    const unitId = fixture.gyms[0].unitId;
    const unit = (
      await pool.query<{ revision: number }>('SELECT revision FROM b2b_unit WHERE id=$1', [unitId])
    ).rows[0];
    await assert.rejects(
      admin((c) => service.whiteLabel.transferUnit(c, unitId, north, unit.revision)),
      code('ACTIVE_ASSIGNMENTS'),
    );
    await admin((c) => service.whiteLabel.retireAssignment(c, fixture.gyms[0].assignmentId));
    await admin((c) => service.whiteLabel.transferUnit(c, unitId, north, unit.revision));
    assert.equal(
      (await pool.query('SELECT branch_id FROM b2b_unit WHERE id=$1', [unitId])).rows[0].branch_id,
      north,
    );
    await admin((c) => service.whiteLabel.updateBranch(c, principal, input, branch.revision));
    await assert.rejects(
      scoped(fixture.gyms[0].coach.id, principal, 'coach', true, async () => true),
      code('BRANCH_ARCHIVED'),
    );
    assert.deepEqual(
      (
        await pool.query(
          'SELECT snapshot FROM b2b_program_version WHERE organization_id=$1 ORDER BY program_id,version',
          [org],
        )
      ).rows,
      before,
    );
    await pool.query("UPDATE b2b_branch SET status='active' WHERE id=$1", [principal]);
    await pool.query('UPDATE b2b_unit SET branch_id=$2 WHERE id=$1', [unitId, principal]);
    await pool.query('UPDATE b2b_program_assignment SET active=true WHERE id=$1', [
      fixture.gyms[0].assignmentId,
    ]);
  });
  test('D09 unpublished profile changes and branch website disablement never leak through public context', async () => {
    const current = await domain(),
      before = await service.whiteLabel.context(current);
    const original = before.branches.find((branch) => branch.id === north)!;
    assert.ok(original);
    const branch = (
      await admin((c) => service.whiteLabel.branches(c), principal, false)
    ).branches.find((b) => b.id === north)!;
    const input = BranchInputSchema.parse(
      Object.fromEntries(
        Object.entries({
          ...branch,
          name: 'Private unpublished name',
          address: 'Private unpublished address',
          slug: 'private-slug',
        }).filter(([key]) => !['id', 'organizationId', 'revision'].includes(key)),
      ),
    );
    await admin((c) => service.whiteLabel.updateBranch(c, north, input, branch.revision));
    assert.deepEqual(
      (await service.whiteLabel.context(current)).branches.find((b) => b.id === north),
      original,
    );
    await admin((c) => service.whiteLabel.setModule(c, 'website', false), north);
    assert.equal(
      (await service.whiteLabel.context(current)).branches.some((b) => b.id === north),
      false,
    );
    await admin((c) => service.whiteLabel.setModule(c, 'website', true), north);
    const draft = await admin((c) => service.website(c), north, false);
    await admin((c) => service.publishWebsite(c, draft.revision), north);
    assert.equal(
      (await service.whiteLabel.context(current)).branches.find((b) => b.id === north)?.name,
      input.name,
    );
    await assert.rejects(
      service.publicSite('atlas-demo', undefined, current, original.slug),
      code('NOT_FOUND'),
    );
    assert.ok(await service.publicSite('atlas-demo', undefined, current, input.slug));
  });
  test('D15 branch preferences cannot elevate brand/platform capabilities; dependencies and direct writes use the same policy', async () => {
    await admin((c) => service.whiteLabel.setModule(c, 'equipment', false, true));
    const branchPreference = await admin((c) => service.whiteLabel.setModule(c, 'equipment', true));
    assert.equal(branchPreference.modules.equipment, false);
    assert.equal(branchPreference.modules.floorPlan, false);
    await assert.rejects(
      admin((c) => service.whiteLabel.requireModule(c, 'equipment')),
      code('MODULE_DISABLED'),
    );
    await admin((c) => service.whiteLabel.setModule(c, 'equipment', true, true));
    await setPlatformModule(pool, org, 'media', false);
    const platformDisabled = await admin((c) =>
      service.whiteLabel.setModule(c, 'media', true, true),
    );
    assert.equal(platformDisabled.modules.media, false);
    assert.equal(platformDisabled.modules.floorPlan, false);
    await assert.rejects(
      admin((c) => service.whiteLabel.requireModule(c, 'media')),
      code('MODULE_DISABLED'),
    );
    await setPlatformModule(pool, org, 'media', true);
    await assert.rejects(setPlatformModule(pool, org, 'unregistered', false));
    await assert.rejects(setPlatformModule(pool, 'missing-brand', 'media', false));
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM b2b_audit WHERE organization_id=$1 AND action='operator.module.update'",
          [org],
        )
      ).rows[0].count,
      2,
    );
  });
  test('D14 theme contrast, revision checks and explicit publish/restore preserve drafts and version history', async () => {
    const state = await admin((c) => service.whiteLabel.theme(c), principal, false);
    const inaccessible = ThemeInputSchema.parse({
      ...state.draft,
      palette: { ...state.draft.palette, text: '#ffffff', background: '#ffffff' },
    });
    await assert.rejects(
      admin((c) => service.whiteLabel.updateTheme(c, inaccessible, state.revision)),
      code('THEME_CONTRAST'),
    );
    const draft = ThemeInputSchema.parse({ ...state.draft, loginTitle: 'Private theme draft' });
    const updated = await admin((c) => service.whiteLabel.updateTheme(c, draft, state.revision));
    assert.notEqual(
      (await service.whiteLabel.context(await domain())).theme.loginTitle,
      draft.loginTitle,
    );
    await assert.rejects(
      admin((c) => service.whiteLabel.publishTheme(c, state.revision)),
      code('REVISION_CONFLICT'),
    );
    const published = await admin((c) =>
      service.whiteLabel.publishTheme(c, updated.theme.revision),
    );
    assert.equal(
      (await service.whiteLabel.context(await domain())).theme.loginTitle,
      draft.loginTitle,
    );
    await admin((c) =>
      service.whiteLabel.publishTheme(c, published.theme.revision, state.publishedVersion),
    );
    const restored = await admin((c) => service.whiteLabel.theme(c), principal, false);
    assert.equal(restored.draft.loginTitle, draft.loginTitle);
    assert.equal(restored.published.loginTitle, state.published.loginTitle);
    assert.equal(
      (await admin((c) => service.whiteLabel.themeVersions(c), principal, false)).versions.length,
      3,
    );
  });
  test('D10 private media ownership cannot be bypassed with absolute, encoded, or other-brand local media URLs', async () => {
    await pool.query(
      "INSERT INTO b2b_media(id,organization_id,branch_id,created_by,kind,label,relative_path,mime,bytes,sha256) VALUES('wl-north-media',$1,$2,$3,'image','North private','fixture/wl-north-media','image/png',1,$4)",
      [org, north, fixture.gyms[0].admin.id, 'a'.repeat(64)],
    );
    const current = await domain();
    for (const url of [
      '/api/b2b/media/wl-north-media',
      `${current.origin}/api/b2b/media/wl-north-media`,
      'https://sur.b2b.test/api/b2b/media/wl-north-media',
      'https://sur.b2b.test/%61pi/b2b/media/wl-north-media',
    ]) {
      await assert.rejects(
        admin((c) => service.validateMediaUrl(c, url, 'image', 'wl-north-media')),
        code('INVALID_MEDIA_REFERENCE'),
      );
    }
    await admin(
      (c) =>
        service.validateMediaUrl(c, '/api/b2b/media/wl-north-media', 'image', 'wl-north-media'),
      north,
    );
    await assert.rejects(
      service.mediaAccess(
        'wl-north-media',
        {
          userId: fixture.gyms[0].coach.id,
          sessionId: await session(fixture.gyms[0].coach.id, current),
        },
        { domain: current },
      ),
      code('NOT_FOUND'),
    );
    const coach = fixture.gyms[0].branches[1].coach.id;
    assert.equal(
      (
        await service.mediaAccess(
          'wl-north-media',
          { userId: coach, sessionId: await session(coach, current) },
          { domain: current },
        )
      ).id,
      'wl-north-media',
    );
  });
  test('D10 visible published catalog authorizes associated media without assignments, with explicit cross-branch sharing', async () => {
    await admin((c) => service.whiteLabel.setModule(c, 'website', false, true));
    const asset = {
      id: 'wl-shared-media',
      kind: 'image' as const,
      url: '/api/b2b/media/wl-shared-media',
      label: 'Shared exercise instruction',
      attribution: '',
    };
    await pool.query(
      "INSERT INTO b2b_media(id,organization_id,branch_id,created_by,kind,label,relative_path,mime,bytes,sha256) VALUES($1,$2,$3,$4,'image',$5,'fixture/wl-shared-media','image/png',1,$6)",
      [asset.id, org, principal, fixture.gyms[0].admin.id, asset.label, 'b'.repeat(64)],
    );
    const exercise = await admin((c) =>
      service.createExercise(
        c,
        ExerciseInputSchema.parse({
          name: 'Shared media reference',
          instructions: ['Follow the image'],
          assets: [asset],
        }),
      ),
    );
    const reviewed = await admin((c) => service.reviewExercise(c, exercise.id, exercise.revision));
    await admin((c) => service.publishExercise(c, reviewed.id, reviewed.revision));
    const current = await domain();
    const read = async (userId: string) =>
      service.mediaAccess(
        asset.id,
        { userId, sessionId: await session(userId, current) },
        { domain: current },
      );
    assert.equal(
      (await read(fixture.gyms[0].member.id)).id,
      asset.id,
      'A current member can see an exercise image before it is assigned',
    );
    const northCoach = fixture.gyms[0].branches[1].coach.id;
    await assert.rejects(read(northCoach), code('NOT_FOUND'));
    await admin(
      (c) =>
        service.whiteLabel.setCatalog(c, {
          kind: 'exercise',
          resourceId: exercise.id,
          enabled: true,
        }),
      north,
    );
    assert.equal((await read(northCoach)).id, asset.id);
    const third = (
      await admin((c) =>
        service.whiteLabel.createBranch(c, { slug: 'unshared', name: 'Unshared branch' }),
      )
    ).branch;
    const otherMember = fixture.gyms[1].member.id;
    await service.transaction(async (db) => {
      await db.query("SELECT set_config('b2b.explicit_branch_scope','on',true)");
      await db.query(
        "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES($1,$2,'member')",
        [org, otherMember],
      );
    });
    await admin((c) =>
      service.whiteLabel.grant(c, {
        userId: otherMember,
        branchId: third.id,
        role: 'member',
        active: true,
      }),
    );
    await assert.rejects(read(otherMember), code('NOT_FOUND'));
    await pool.query("UPDATE b2b_exercise SET status='draft' WHERE id=$1", [exercise.id]);
    await assert.rejects(read(northCoach), code('NOT_FOUND'), 'Sharing does not publish a draft');
    await pool.query("UPDATE b2b_exercise SET status='published' WHERE id=$1", [exercise.id]);
    await admin(
      (c) =>
        service.whiteLabel.setCatalog(c, {
          kind: 'exercise',
          resourceId: exercise.id,
          enabled: false,
        }),
      north,
    );
    await assert.rejects(
      read(northCoach),
      code('NOT_FOUND'),
      'Removing availability revokes access to an unassigned media reference',
    );
    await admin((c) => service.whiteLabel.setModule(c, 'website', true, true));
  });
  test('D05 administration and explicit training grants remain distinct selectable roles', async () => {
    const userId = fixture.gyms[0].admin.id;
    await admin((c) =>
      service.whiteLabel.grant(c, { userId, branchId: north, role: 'member', active: true }),
    );
    const access = await service.whiteLabel.access(org, userId, true);
    assert.deepEqual(access.branches.find((b) => b.branch.id === north)?.roles, [
      'admin',
      'member',
    ]);
    const role = await scoped(userId, north, 'member', false, async (c) => c.role);
    assert.equal(role, 'member');
  });
});
