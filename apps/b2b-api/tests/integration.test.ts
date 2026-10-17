import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { Pool } from 'pg';
import {
  ExerciseInputSchema,
  MachineInputSchema,
  UnitInputSchema,
  ProgramInputSchema,
  type Exercise,
  type Machine,
  type Unit,
  type Program,
  type Assignment,
  type ProgramVersion,
  type ExecutionInput,
  type Media,
  type Website,
  type PublicSite,
} from '@klisteniapp/b2b-contracts';
import { createAuth } from '../src/auth.ts';
import { createPool } from '../src/database.ts';
import type { Config } from '../src/config.ts';
import { createApiServer } from '../src/http.ts';
import { migrate } from '../src/migrate.ts';
import { seedDemo, resetDemo } from '../src/demo.ts';
import { B2BService, createUser } from '../src/service.ts';
import { createOrganization } from '../src/operator.ts';
import { glb } from './fixtures/glb.ts';

const databaseUrl = process.env.B2B_TEST_DATABASE_URL;
const password = 'b2b-integration-only-password';
describe('B2B independent PostgreSQL API', { skip: !databaseUrl }, () => {
  let administrator: Pool, pool: Pool, config: Config, server: Server, base: string;
  let auth: ReturnType<typeof createAuth>, service: B2BService;
  let seeded: Awaited<ReturnType<typeof seedDemo>>;
  const schema = `b2b_test_${randomUUID().replaceAll('-', '')}`;
  type Client = {
    id: string;
    request: (
      method: string,
      path: string,
      body?: unknown,
      headers?: Record<string, string>,
    ) => Promise<Response>;
    cookie: () => string;
  };
  let admin: Client,
    coach: Client,
    member: Client,
    otherAdmin: Client,
    otherCoach: Client,
    otherMember: Client;
  const route = (path: string, org = 'atlas-demo') => `/api/b2b/orgs/${org}${path}`;
  async function client(email: string, id: string, candidatePassword = password): Promise<Client> {
    let cookie = '';
    const request: Client['request'] = async (method, path, body, extra = {}) => {
      const result = await fetch(`${base}${path}`, {
        method,
        headers: {
          origin: config.origin,
          'content-type': 'application/json',
          cookie,
          'x-klisteni-b2b-account': id,
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const cookies = result.headers.getSetCookie();
      if (cookies.length) cookie = cookies.map((v) => v.split(';')[0]).join('; ');
      return result;
    };
    const result = await request('POST', '/api/b2b/auth/sign-in/email', {
      email,
      password: candidatePassword,
    });
    assert.equal(result.status, 200, await result.clone().text());
    assert.match(cookie, /klisteni-b2b\.session_token=/);
    return { id, request, cookie: () => cookie };
  }
  async function result<T>(response: Response, expected = 200): Promise<T> {
    assert.equal(response.status, expected, await response.clone().text());
    return (await response.json()) as T;
  }
  async function publishExercise(exercise: Exercise): Promise<Exercise> {
    const reviewed = (
      await result<{ exercise: Exercise }>(
        await coach.request('POST', route(`/exercises/${exercise.id}/review`), {
          expectedRevision: exercise.revision,
        }),
        201,
      )
    ).exercise;
    return (
      await result<{ exercise: Exercise }>(
        await coach.request('POST', route(`/exercises/${exercise.id}/publish`), {
          expectedRevision: reviewed.revision,
        }),
        201,
      )
    ).exercise;
  }
  async function publishMachine(machine: Machine): Promise<Machine> {
    const reviewed = (
      await result<{ machine: Machine }>(
        await admin.request('POST', route(`/machines/${machine.id}/review`), {
          expectedRevision: machine.revision,
        }),
        201,
      )
    ).machine;
    return (
      await result<{ machine: Machine }>(
        await admin.request('POST', route(`/machines/${machine.id}/publish`), {
          expectedRevision: reviewed.revision,
        }),
        201,
      )
    ).machine;
  }
  before(async () => {
    administrator = new Pool({ connectionString: databaseUrl });
    await administrator.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(databaseUrl!);
    scoped.searchParams.set('options', `-c search_path=${schema}`);
    config = {
      databaseUrl: scoped.href,
      secret: 'b2b-test-secret-never-use-in-production',
      origin: 'http://localhost:4200',
      host: '127.0.0.1',
      port: 4201,
      production: false,
      demoMode: true,
      mediaRoot: await mkdtemp(join(tmpdir(), 'b2b-media-integration-')),
      mediaQuotaMb: 256,
    };
    pool = createPool(config);
    const migrationAuth = createAuth(pool, config, { migrating: true });
    await migrate(pool, migrationAuth);
    await migrate(pool, migrationAuth);
    auth = createAuth(pool, config);
    seeded = await seedDemo(pool, auth, config, password);
    service = new B2BService(pool, auth, config);
    assert.deepEqual(
      (await seedDemo(pool, auth, config, password)).gyms.map((g) => g.member.id),
      seeded.gyms.map((g) => g.member.id),
    );
    server = createApiServer({ config, pool, auth, service });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const a = seeded.gyms[0],
      b = seeded.gyms[1];
    admin = await client(a.admin.email, a.admin.id);
    coach = await client(a.coach.email, a.coach.id);
    member = await client(a.member.email, a.member.id);
    otherAdmin = await client(b.admin.email, b.admin.id);
    otherCoach = await client(b.coach.email, b.coach.id);
    otherMember = await client(b.member.email, b.member.id);
  });
  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool?.end();
    if (config?.mediaRoot) await rm(config.mediaRoot, { recursive: true, force: true });
    if (administrator) {
      await administrator.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await administrator.end();
    }
  });
  test('independent auth, exact origin, safe cookies and absence of B2C tables', async () => {
    assert.equal((await fetch(`${base}/api/b2b/me`)).status, 401);
    const cookies = await member.request('POST', '/api/b2b/auth/sign-in/email', {
      email: seeded.gyms[0].member.email,
      password,
    });
    assert.match(cookies.headers.getSetCookie().join(';'), /HttpOnly/i);
    assert.match(cookies.headers.getSetCookie().join(';'), /SameSite=Lax/i);
    assert.equal(
      (
        await member.request(
          'POST',
          route('/executions'),
          {},
          { origin: 'https://foreign.example.test' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await member.request('GET', '/api/b2b/me', undefined, {
          'x-klisteni-b2b-account': otherMember.id,
        })
      ).status,
      401,
    );
    const missingAccount = await fetch(`${base}${route('/executions')}`, {
      method: 'POST',
      headers: {
        cookie: member.cookie(),
        origin: config.origin,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    assert.equal(missingAccount.status, 401);
    assert.equal((await member.request('POST', '/api/b2b/auth/sign-up/email', {})).status, 404);
    assert.equal((await member.request('GET', '/api/me/state')).status, 404);
    assert.equal(
      (await pool.query("SELECT to_regclass('account_access') present")).rows[0].present,
      null,
    );
    assert.equal((await member.request('GET', '/api/b2b/readyz')).status, 200);
  });
  test('tenant IDs never grant access; staff and assigned-member scope are enforced', async () => {
    assert.equal((await otherAdmin.request('GET', route('/members'))).status, 403);
    assert.equal((await otherCoach.request('GET', route('/assignments'))).status, 403);
    assert.equal((await member.request('GET', route('/reports'))).status, 403);
    assert.equal(
      (await member.request('POST', route('/machines'), { name: 'Forbidden', type: 'cable' }))
        .status,
      403,
    );
    const list = await result<{ members: Array<{ userId: string }> }>(
      await coach.request('GET', route('/members')),
    );
    assert.deepEqual(new Set(list.members.map((m) => m.userId)), new Set([coach.id, member.id]));
    assert.equal(
      (await coach.request('GET', route(`/assignments?memberId=${otherMember.id}`))).status,
      404,
    );
    assert.equal(
      (
        await admin.request('POST', route('/coach-assignments'), {
          coachId: otherCoach.id,
          memberId: member.id,
        })
      ).status,
      404,
    );
    assert.equal((await coach.request('GET', route('/assignments'))).status, 200);
  });
  test('machine models are reusable but physical units and published QR output are tenant scoped', async () => {
    const own = await result<{ units: Array<{ id: string; machineId: string }> }>(
      await coach.request('GET', route('/units')),
    );
    const other = await result<{ units: Array<{ id: string; machineId: string }> }>(
      await otherCoach.request('GET', route('/units', 'sur-demo')),
    );
    assert.equal(own.units[0].machineId, other.units[0].machineId);
    assert.notEqual(own.units[0].id, other.units[0].id);
    const qr = await result<Record<string, unknown>>(
      await fetch(`${base}/api/b2b/public/atlas-demo/units/${seeded.gyms[0].unitId}`),
    );
    assert.deepEqual(Object.keys(qr).sort(), ['exercises', 'machine', 'organization', 'unit']);
    assert.doesNotMatch(JSON.stringify(qr), /@atlas|password|memberId|assignedBy|session_token/);
    assert.equal(
      (await fetch(`${base}/api/b2b/public/sur-demo/units/${seeded.gyms[0].unitId}`)).status,
      404,
    );
    const machine = await result<{ machine: { id: string } }>(
      await admin.request('POST', route('/machines'), { name: 'Atlas custom', type: 'cable' }),
      201,
    );
    assert.equal(
      (
        await otherAdmin.request('POST', route('/units', 'sur-demo'), {
          machineId: machine.machine.id,
          label: 'Stolen machine',
        })
      ).status,
      404,
    );
  });
  test('model adaptations and unit edits preserve base data, reject stale changes and hide withdrawn/public-private units', async () => {
    const source = (
      await result<{ machines: Machine[] }>(await coach.request('GET', route('/machines')))
    ).machines.find((m) => m.id === 'base-cable-station-v1')!;
    const data = MachineInputSchema.parse({
      name: 'Atlas adapted cable',
      type: source.type,
      manufacturer: source.manufacturer,
      model: source.model,
      instructions: source.instructions,
      assets: source.assets,
      derivedFromId: source.id,
      derivedFromVersion: source.version,
    });
    // Explicitly strip DTO fields before submitting editable data.
    const copy = await publishMachine(
      (
        await result<{ machine: Machine }>(
          await admin.request('POST', route('/machines'), data),
          201,
        )
      ).machine,
    );
    assert.equal(copy.derivedFromId, source.id);
    assert.equal(
      (
        await admin.request('PUT', route(`/machines/${source.id}`), {
          ...data,
          expectedRevision: source.revision,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await otherAdmin.request('PUT', route(`/machines/${copy.id}`, 'sur-demo'), {
          ...data,
          expectedRevision: copy.revision,
        })
      ).status,
      409,
    );
    const unitInput = UnitInputSchema.parse({
      machineId: copy.id,
      label: 'Adapted cable',
      adjustments: 'Seat 4',
    });
    const unit = (
      await result<{ unit: Unit }>(await admin.request('POST', route('/units'), unitInput), 201)
    ).unit;
    const updated = (
      await result<{ machine: Machine }>(
        await admin.request('PUT', route(`/machines/${copy.id}`), {
          ...data,
          instructions: 'Adjusted model instructions',
          expectedRevision: copy.revision,
        }),
      )
    ).machine;
    assert.equal(updated.version, copy.version + 1);
    await publishMachine(updated);
    assert.equal(
      (
        await admin.request('PUT', route(`/machines/${copy.id}`), {
          ...data,
          expectedRevision: copy.revision,
        })
      ).status,
      409,
    );
    const hidden = (
      await result<{ unit: Unit }>(
        await admin.request('PUT', route(`/units/${unit.id}`), {
          ...unitInput,
          public: false,
          expectedRevision: unit.revision,
        }),
      )
    ).unit;
    assert.equal((await fetch(`${base}/api/b2b/public/atlas-demo/units/${unit.id}`)).status, 404);
    assert.equal(
      (
        await admin.request('PUT', route(`/units/${unit.id}`), {
          ...unitInput,
          expectedRevision: unit.revision,
        })
      ).status,
      409,
    );
    const archived = (
      await result<{ unit: Unit }>(
        await admin.request('PUT', route(`/units/${unit.id}`), {
          ...unitInput,
          archived: true,
          expectedRevision: hidden.revision,
        }),
      )
    ).unit;
    const memberUnits = await result<{ units: Unit[] }>(
      await member.request('GET', route('/units')),
    );
    assert.ok(!memberUnits.units.some((u) => u.id === unit.id));
    const staffUnits = await result<{ units: Unit[] }>(await coach.request('GET', route('/units')));
    assert.ok(staffUnits.units.some((u) => u.id === unit.id && u.archived));
    await result(
      await admin.request('PUT', route(`/units/${unit.id}`), {
        ...unitInput,
        expectedRevision: archived.revision,
      }),
    );
    assert.equal((await fetch(`${base}/api/b2b/public/atlas-demo/units/${unit.id}`)).status, 200);
    const after = (
      await result<{ machines: Machine[] }>(await coach.request('GET', route('/machines')))
    ).machines.find((m) => m.id === source.id);
    assert.deepEqual(after, source);
  });
  test('publishing and optimistic edits preserve immutable assigned exercise/program snapshots', async () => {
    const input = ExerciseInputSchema.parse({
      name: 'Exercise v1',
      instructions: ['Test instruction'],
      machineId: 'base-cable-station-v1',
    });
    let exercise = (
      await result<{ exercise: Exercise }>(
        await coach.request('POST', route('/exercises'), input),
        201,
      )
    ).exercise;
    const publicDraft = await result<{ exercises: Exercise[] }>(
      await fetch(`${base}/api/b2b/public/atlas-demo`),
    );
    assert.ok(!publicDraft.exercises.some((e) => e.id === exercise.id));
    exercise = await publishExercise(exercise);
    assert.equal(
      (await coach.request('PUT', route('/exercises/squat'), { ...input, expectedRevision: 0 }))
        .status,
      409,
    );
    assert.equal(
      (
        await otherCoach.request('PUT', route(`/exercises/${exercise.id}`, 'sur-demo'), {
          ...input,
          expectedRevision: exercise.revision,
        })
      ).status,
      409,
    );
    const data = ProgramInputSchema.parse({
      name: 'Routine v1',
      steps: [{ id: 'one', exerciseId: exercise.id, sets: 1, reps: 8, alternatives: ['squat'] }],
    });
    let program = (
      await result<{ program: Program }>(await coach.request('POST', route('/programs'), data), 201)
    ).program;
    const version = (
      await result<{ version: ProgramVersion }>(
        await coach.request('POST', route(`/programs/${program.id}/publish`), {
          expectedRevision: program.revision,
        }),
        201,
      )
    ).version;
    const assignment = (
      await result<{ assignment: Assignment }>(
        await coach.request('POST', route('/assignments'), {
          memberId: member.id,
          programId: program.id,
          version: version.version,
        }),
        201,
      )
    ).assignment;
    exercise = (
      await result<{ exercise: Exercise }>(
        await coach.request('PUT', route(`/exercises/${exercise.id}`), {
          ...input,
          name: 'Exercise v2',
          expectedRevision: exercise.revision,
        }),
      )
    ).exercise;
    assert.equal(
      (
        await coach.request('PUT', route(`/exercises/${exercise.id}`), {
          ...input,
          expectedRevision: exercise.revision - 1,
        })
      ).status,
      409,
    );
    program = (
      await result<{ programs: Program[] }>(await coach.request('GET', route('/programs')))
    ).programs.find((p) => p.id === program.id)!;
    const edited = { ...data, name: 'Routine v2', expectedRevision: program.revision };
    await result(await coach.request('PUT', route(`/programs/${program.id}`), edited));
    assert.equal(
      (await coach.request('PUT', route(`/programs/${program.id}`), edited)).status,
      409,
    );
    const current = await result<{ assignments: Assignment[] }>(
      await member.request('GET', route('/assignments')),
    );
    const saved = current.assignments.find((a) => a.id === assignment.id)!;
    assert.equal(saved.program.name, 'Routine v1');
    assert.equal(saved.program.exercises.find((e) => e.id === exercise.id)!.name, 'Exercise v1');
  });
  test('executions validate assigned sets and substitutions; exact replay is idempotent and histories immutable', async () => {
    const assignmentId = seeded.gyms[0].assignmentId;
    const input: ExecutionInput = {
      id: randomUUID(),
      assignmentId,
      status: 'partial',
      completedAt: new Date().toISOString(),
      notes: '',
      sets: [
        {
          stepId: 'squat-step',
          set: 1,
          exerciseId: 'quarter-squat',
          reps: 8,
          durationSeconds: null,
          rpe: null,
          loadKg: null,
          reason: 'Alternativa indicada por el instructor',
        },
      ],
    };
    await result(await member.request('POST', route('/executions'), input), 201);
    await result(await member.request('POST', route('/executions'), input), 201);
    assert.equal(
      (
        await pool.query('SELECT id FROM b2b_execution WHERE organization_id=$1 AND id=$2', [
          'atlas-demo',
          input.id,
        ])
      ).rowCount,
      1,
    );
    assert.equal(
      (await member.request('POST', route('/executions'), { ...input, notes: 'rewrite' })).status,
      409,
    );
    assert.equal(
      (
        await member.request('POST', route('/executions'), {
          ...input,
          id: randomUUID(),
          status: 'completed',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await member.request('POST', route('/executions'), {
          ...input,
          id: randomUUID(),
          sets: [{ ...input.sets[0], reason: '' }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await member.request('POST', route('/executions'), {
          ...input,
          id: randomUUID(),
          sets: [{ ...input.sets[0], exerciseId: 'pushup' }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await member.request('POST', route('/executions'), {
          ...input,
          id: randomUUID(),
          sets: [input.sets[0], input.sets[0]],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await otherMember.request('POST', route('/executions', 'sur-demo'), {
          ...input,
          id: randomUUID(),
        })
      ).status,
      404,
    );
    assert.equal(
      (await coach.request('POST', route('/executions'), { ...input, id: randomUUID() })).status,
      403,
    );
    const completed = {
      ...input,
      id: randomUUID(),
      status: 'completed',
      sets: ['squat-step', 'row-step'].flatMap((stepId, index) =>
        [1, 2].map((set) => ({
          stepId,
          set,
          exerciseId: index ? 'atlas-demo-cable-row' : 'squat',
          reps: 10,
          loadKg: index ? 10 : null,
          reason: '',
        })),
      ),
    };
    await result(await member.request('POST', route('/executions'), completed), 201);
    const report = await result<{
      members: Array<{ completed: number; partial: number }>;
      executions: unknown[];
    }>(await coach.request('GET', route('/reports')));
    assert.equal(report.members[0].completed, 1);
    assert.equal(report.members[0].partial, 1);
    assert.equal(report.executions.length, 2);
  });
  test('gym contract gates writes independently while allowing own history reads', async () => {
    await pool.query("UPDATE b2b_organization SET service_enabled=false WHERE id='atlas-demo'");
    assert.equal((await member.request('GET', route('/executions'))).status, 200);
    assert.equal((await member.request('POST', route('/executions'), {})).status, 402);
    assert.equal(
      (await admin.request('POST', route('/machines'), { name: 'Blocked', type: 'cable' })).status,
      402,
    );
    assert.equal((await otherMember.request('GET', route('/assignments', 'sur-demo'))).status, 200);
    await pool.query("UPDATE b2b_organization SET service_enabled=true WHERE id='atlas-demo'");
  });
  test('new prescriptions require active compatible units; archived machines preserve old snapshots and exact execution retries', async () => {
    const machineData = MachineInputSchema.parse({
      name: 'Dedicated press v1',
      type: 'leg-press',
      derivedFromId: 'base-leg-press-v1',
      derivedFromVersion: 1,
    });
    const machine = await publishMachine(
      (
        await result<{ machine: Machine }>(
          await admin.request('POST', route('/machines'), machineData),
          201,
        )
      ).machine,
    );
    let exercise = (
      await result<{ exercise: Exercise }>(
        await coach.request('POST', route('/exercises'), {
          name: 'Dedicated press',
          instructions: ['Follow assigned instructions'],
          machineId: machine.id,
          equipment: 'leg-press',
        }),
        201,
      )
    ).exercise;
    exercise = await publishExercise(exercise);
    const programData = ProgramInputSchema.parse({
      name: 'Press prescription',
      steps: [{ id: 'press-step', exerciseId: exercise.id, sets: 1, reps: 10 }],
    });
    let program = (
      await result<{ program: Program }>(
        await coach.request('POST', route('/programs'), programData),
        201,
      )
    ).program;
    const version = (
      await result<{ version: ProgramVersion }>(
        await coach.request('POST', route(`/programs/${program.id}/publish`), {
          expectedRevision: program.revision,
        }),
        201,
      )
    ).version;
    assert.equal(
      (await member.request('GET', route(`/programs/${program.id}/versions/${version.version}`)))
        .status,
      403,
    );
    assert.equal(
      (
        await otherCoach.request(
          'GET',
          route(`/programs/${program.id}/versions/${version.version}`, 'sur-demo'),
        )
      ).status,
      404,
    );
    const immutable = (
      await result<{ version: ProgramVersion }>(
        await coach.request('GET', route(`/programs/${program.id}/versions/${version.version}`)),
      )
    ).version;
    assert.deepEqual(immutable, version);
    const assignmentInput = {
      memberId: member.id,
      programId: program.id,
      version: version.version,
    };
    assert.equal((await coach.request('POST', route('/assignments'), assignmentInput)).status, 409);
    const unitData = UnitInputSchema.parse({
      machineId: machine.id,
      label: 'Press unit',
      public: false,
    });
    const unit = (
      await result<{ unit: Unit }>(await admin.request('POST', route('/units'), unitData), 201)
    ).unit;
    const assignment = (
      await result<{ assignment: Assignment }>(
        await coach.request('POST', route('/assignments'), assignmentInput),
        201,
      )
    ).assignment;
    assert.equal(assignment.availability[0].exercises[0].status, 'available');
    const execution: ExecutionInput = {
      id: randomUUID(),
      assignmentId: assignment.id,
      status: 'completed',
      notes: '',
      completedAt: new Date().toISOString(),
      sets: [
        {
          stepId: 'press-step',
          set: 1,
          exerciseId: exercise.id,
          reps: 10,
          durationSeconds: null,
          rpe: null,
          loadKg: 15,
          reason: '',
        },
      ],
    };
    await result(await member.request('POST', route('/executions'), execution), 201);
    await publishMachine(
      (
        await result<{ machine: Machine }>(
          await admin.request('PUT', route(`/machines/${machine.id}`), {
            ...machineData,
            name: 'Dedicated press v2',
            expectedRevision: machine.revision,
          }),
        )
      ).machine,
    );
    await result(
      await admin.request('PUT', route(`/units/${unit.id}`), {
        ...unitData,
        archived: true,
        expectedRevision: unit.revision,
      }),
    );
    const historical = (
      await result<{ assignments: Assignment[] }>(
        await member.request('GET', route('/assignments')),
      )
    ).assignments.find((a) => a.id === assignment.id)!;
    assert.equal(historical.availability[0].exercises[0].status, 'unavailable');
    assert.equal(
      historical.program.machines.find((m) => m.id === machine.id)!.name,
      'Dedicated press v1',
    );
    assert.equal(historical.program.machines.find((m) => m.id === machine.id)!.version, 1);
    await result(await member.request('POST', route('/executions'), execution), 201);
    assert.equal(
      (await member.request('POST', route('/executions'), { ...execution, id: randomUUID() }))
        .status,
      409,
    );
    assert.equal((await coach.request('POST', route('/assignments'), assignmentInput)).status, 409);
    program = (
      await result<{ programs: Program[] }>(await coach.request('GET', route('/programs')))
    ).programs.find((p) => p.id === program.id)!;
    const newData = {
      ...programData,
      name: 'Press with permitted alternative',
      steps: [{ ...programData.steps[0], alternatives: ['squat'] }],
    };
    program = (
      await result<{ program: Program }>(
        await coach.request('PUT', route(`/programs/${program.id}`), {
          ...newData,
          expectedRevision: program.revision,
        }),
      )
    ).program;
    const next = (
      await result<{ version: ProgramVersion }>(
        await coach.request('POST', route(`/programs/${program.id}/publish`), {
          expectedRevision: program.revision,
        }),
        201,
      )
    ).version;
    const alternate = (
      await result<{ assignment: Assignment }>(
        await coach.request('POST', route('/assignments'), {
          ...assignmentInput,
          version: next.version,
        }),
        201,
      )
    ).assignment;
    assert.equal(
      alternate.availability[0].exercises.find((e) => e.exerciseId === 'squat')!.status,
      'available',
    );
    const starter = (
      await result<{ assignments: Assignment[] }>(
        await member.request('GET', route('/assignments')),
      )
    ).assignments.find((a) => a.id === seeded.gyms[0].assignmentId)!;
    assert.equal(
      starter.availability
        .find((s) => s.stepId === 'row-step')!
        .exercises.find((e) => e.exerciseId === 'row')!.status,
      'equipment-required',
    );
  });
  test('machine exercise templates require local adaptation and explicit review; edits invalidate approval', async () => {
    const staffExercises = (
      await result<{ exercises: Exercise[] }>(await coach.request('GET', route('/exercises')))
    ).exercises;
    const templates = staffExercises.filter((e) => e.scope === 'base' && e.status === 'draft');
    assert.equal(templates.length, 6);
    assert.ok(
      (
        await result<{ machines: Machine[] }>(await admin.request('GET', route('/machines')))
      ).machines.filter((m) => m.scope === 'base').length >= 3,
    );
    assert.ok(
      !(
        await result<{ exercises: Exercise[] }>(await member.request('GET', route('/exercises')))
      ).exercises.some((e) => templates.some((t) => t.id === e.id)),
    );
    const template = templates[0];
    assert.equal(
      (
        await coach.request('POST', route(`/exercises/${template.id}/review`), {
          expectedRevision: template.revision,
        })
      ).status,
      409,
    );
    const { id, scope, status, version, revision, ...data } = template;
    void scope;
    void status;
    void version;
    void revision;
    let own = (
      await result<{ exercise: Exercise }>(
        await coach.request('POST', route('/exercises'), { ...data, baseExerciseId: id }),
        201,
      )
    ).exercise;
    assert.equal(
      (
        await coach.request('POST', route(`/exercises/${own.id}/publish`), {
          expectedRevision: own.revision,
        })
      ).status,
      409,
    );
    own = (
      await result<{ exercise: Exercise }>(
        await coach.request('POST', route(`/exercises/${own.id}/review`), {
          expectedRevision: own.revision,
        }),
        201,
      )
    ).exercise;
    own = (
      await result<{ exercise: Exercise }>(
        await coach.request('PUT', route(`/exercises/${own.id}`), {
          ...data,
          baseExerciseId: id,
          name: 'Local reviewed adaptation',
          expectedRevision: own.revision,
        }),
      )
    ).exercise;
    assert.equal(own.status, 'draft');
    assert.equal(
      (
        await coach.request('POST', route(`/exercises/${own.id}/publish`), {
          expectedRevision: own.revision,
        })
      ).status,
      409,
    );
    await publishExercise(own);
    assert.ok(
      (
        await pool.query(
          "SELECT id FROM b2b_audit WHERE action='exercise.review' AND actor_id=$1 AND resource_id=$2",
          [coach.id, own.id],
        )
      ).rowCount,
    );
    assert.equal(
      (
        await coach.request('POST', route('/machines'), {
          name: 'Coach cannot manage equipment',
          type: 'cable',
        })
      ).status,
      403,
    );
  });
  test('unit batches are atomic, scoped and idempotent even after response loss', async () => {
    const input = {
      id: randomUUID(),
      units: [
        UnitInputSchema.parse({ machineId: 'base-leg-press-v1', label: 'Batch press01' }),
        UnitInputSchema.parse({ machineId: 'base-leg-press-v1', label: 'Batch press02' }),
      ],
    };
    const first = await result<{ units: Unit[] }>(
      await admin.request('POST', route('/units/batch'), input),
      201,
    );
    const again = await result<{ units: Unit[] }>(
      await admin.request('POST', route('/units/batch'), input),
      201,
    );
    assert.deepEqual(again, first);
    assert.equal(
      (
        await admin.request('POST', route('/units/batch'), {
          ...input,
          units: input.units.slice(1),
        })
      ).status,
      409,
    );
    assert.equal((await coach.request('POST', route('/units/batch'), input)).status, 403);
    const before = (await pool.query('SELECT id FROM b2b_unit')).rowCount;
    assert.equal(
      (
        await admin.request('POST', route('/units/batch'), {
          id: randomUUID(),
          units: [input.units[0], { ...input.units[1], machineId: 'absent-model' }],
        })
      ).status,
      404,
    );
    assert.equal((await pool.query('SELECT id FROM b2b_unit')).rowCount, before);
  });
  test('timed prescriptions retain actual dose, RPE, immutable history and normalized legacy replays', async () => {
    const program = (
      await result<{ program: Program }>(
        await coach.request('POST', route('/programs'), {
          name: 'Práctica por tiempo',
          steps: [
            {
              id: 'timed',
              exerciseId: 'squat',
              sets: 1,
              reps: null,
              durationSeconds: 30,
              targetRpe: 6,
            },
          ],
        }),
        201,
      )
    ).program;
    await result(
      await coach.request('POST', route(`/programs/${program.id}/publish`), {
        expectedRevision: program.revision,
      }),
      201,
    );
    const assignment = (
      await result<{ assignment: Assignment }>(
        await coach.request('POST', route('/assignments'), {
          memberId: member.id,
          programId: program.id,
          version: 1,
        }),
        201,
      )
    ).assignment;
    const execution = {
      id: randomUUID(),
      assignmentId: assignment.id,
      status: 'completed',
      completedAt: new Date().toISOString(),
      sets: [
        { stepId: 'timed', exerciseId: 'squat', set: 1, reps: null, durationSeconds: 25, rpe: 7 },
      ],
    };
    assert.equal(
      (
        await member.request('POST', route('/executions'), {
          ...execution,
          sets: [{ ...execution.sets[0], reps: 10, durationSeconds: null }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await member.request('POST', route('/executions'), {
          ...execution,
          sets: [{ ...execution.sets[0], durationSeconds: 0 }],
        })
      ).status,
      400,
    );
    const first = await result(await member.request('POST', route('/executions'), execution), 201);
    assert.deepEqual(
      await result(await member.request('POST', route('/executions'), execution), 201),
      first,
    );
    assert.equal(
      (
        await member.request('POST', route('/executions'), {
          ...execution,
          sets: [{ ...execution.sets[0], rpe: 8 }],
        })
      ).status,
      409,
    );
    await result(
      await coach.request('PUT', route(`/programs/${program.id}`), {
        name: 'Versión futura',
        description: '',
        steps: [{ ...program.steps[0], durationSeconds: 60 }],
        expectedRevision: 1,
      }),
    );
    const history = (
      await result<{
        executions: Array<{
          id: string;
          program: ProgramVersion;
          sets: Array<{ durationSeconds: number; rpe: number }>;
        }>;
      }>(await coach.request('GET', route(`/executions?memberId=${member.id}`)))
    ).executions.find((item) => item.id === execution.id)!;
    assert.equal(history.program.steps[0].durationSeconds, 30);
    assert.equal(history.program.steps[0].targetRpe, 6);
    assert.equal(history.sets[0].durationSeconds, 25);
    assert.equal(history.sets[0].rpe, 7);
    // Simulate an accepted execution from before these optional observations existed.
    const legacy = {
      id: randomUUID(),
      assignmentId: seeded.gyms[0].assignmentId,
      status: 'partial',
      completedAt: new Date().toISOString(),
      sets: [{ stepId: 'squat-step', set: 1, exerciseId: 'squat', reps: 8 }],
    };
    await result(await member.request('POST', route('/executions'), legacy), 201);
    await pool.query(
      "UPDATE b2b_execution SET data=jsonb_set(data,'{sets}',(SELECT jsonb_agg(value-'durationSeconds'-'rpe') FROM jsonb_array_elements(data->'sets'))) WHERE organization_id='atlas-demo' AND id=$1",
      [legacy.id],
    );
    await result(await member.request('POST', route('/executions'), legacy), 201);
  });
  test('floor plans publish snapshots, reject foreign units and remove revoked markers immediately', async () => {
    let website = (
      await result<{ website: Website }>(await admin.request('GET', route('/website')))
    ).website;
    const original = website.draft;
    const publicSite = await result<PublicSite>(await fetch(`${base}/api/b2b/public/atlas-demo`));
    const unit = publicSite.units[0];
    assert.ok(unit);
    const plan = {
      title: 'Orientación',
      description: 'Sector de entrenamiento',
      image: {
        id: 'plan-image',
        kind: 'image',
        url: '/models/plan.png',
        label: 'Croquis',
        attribution: 'Contenido ficticio',
      },
      points: [{ unitId: unit.id, x: 20, y: 40 }],
    };
    assert.equal(
      (
        await admin.request('PUT', route('/website'), {
          ...original,
          floorPlan: { ...plan, points: [{ unitId: 'sur-demo-cable-01', x: 1, y: 1 }] },
          expectedRevision: website.revision,
        })
      ).status,
      400,
    );
    website = (
      await result<{ website: Website }>(
        await admin.request('PUT', route('/website'), {
          ...original,
          floorPlan: plan,
          expectedRevision: website.revision,
        }),
      )
    ).website;
    assert.equal(
      (await result<PublicSite>(await fetch(`${base}/api/b2b/public/atlas-demo`))).website
        .floorPlan,
      null,
    );
    website = (
      await result<{ website: Website }>(
        await admin.request('POST', route('/website/publish'), {
          expectedRevision: website.revision,
        }),
        201,
      )
    ).website;
    assert.equal(
      (await result<PublicSite>(await fetch(`${base}/api/b2b/public/atlas-demo`))).website.floorPlan
        ?.points[0].unitId,
      unit.id,
    );
    await pool.query('UPDATE b2b_unit SET public=false WHERE organization_id=$1 AND id=$2', [
      'atlas-demo',
      unit.id,
    ]);
    const revoked = await result<PublicSite>(await fetch(`${base}/api/b2b/public/atlas-demo`));
    assert.equal(revoked.website.floorPlan?.points.length, 0);
    assert.equal(JSON.stringify(revoked.website).includes(unit.id), false);
    await pool.query(
      'UPDATE b2b_unit SET public=true,archived=true WHERE organization_id=$1 AND id=$2',
      ['atlas-demo', unit.id],
    );
    assert.equal(
      (
        await admin.request('POST', route('/website/publish'), {
          expectedRevision: website.revision,
        })
      ).status,
      400,
    );
    website = (
      await result<{ website: Website }>(
        await admin.request('POST', route('/website/unpublish'), {
          expectedRevision: website.revision,
        }),
        201,
      )
    ).website;
    await pool.query('UPDATE b2b_unit SET archived=false WHERE organization_id=$1 AND id=$2', [
      'atlas-demo',
      unit.id,
    ]);
    website = (
      await result<{ website: Website }>(
        await admin.request('PUT', route('/website'), {
          ...original,
          expectedRevision: website.revision,
        }),
      )
    ).website;
    await result(
      await admin.request('POST', route('/website/publish'), {
        expectedRevision: website.revision,
      }),
      201,
    );
  });
  test('website drafts preserve public snapshots, explicit publication and derived completion', async () => {
    let site = (await result<{ website: Website }>(await admin.request('GET', route('/website'))))
      .website;
    const old = await result<PublicSite>(await fetch(`${base}/api/b2b/public/atlas-demo`));
    site = (
      await result<{ website: Website }>(
        await admin.request('PUT', route('/website'), {
          ...site.draft,
          headline: 'A new public headline',
          expectedRevision: site.revision,
        }),
      )
    ).website;
    assert.equal(
      (await result<PublicSite>(await fetch(`${base}/api/b2b/public/atlas-demo`))).website.headline,
      old.website.headline,
    );
    assert.equal(
      (await coach.request('POST', route('/website/publish'), { expectedRevision: site.revision }))
        .status,
      403,
    );
    site = (
      await result<{ website: Website }>(
        await admin.request('POST', route('/website/publish'), { expectedRevision: site.revision }),
        201,
      )
    ).website;
    assert.equal(
      (await result<PublicSite>(await fetch(`${base}/api/b2b/public/atlas-demo`))).website.headline,
      'A new public headline',
    );
    await result(
      await admin.request('PUT', route('/brand'), {
        ...old.organization.brand,
        name: 'Atlas current brand',
      }),
    );
    assert.equal(
      (await result<PublicSite>(await fetch(`${base}/api/b2b/public/atlas-demo`))).organization
        .brand.name,
      old.organization.brand.name,
    );
    assert.equal(
      (await admin.request('POST', route('/website/publish'), { expectedRevision: site.revision }))
        .status,
      409,
    );
    const progress = await result<{ checks: Array<{ id: string; complete: boolean }> }>(
      await admin.request('GET', route('/setup-progress')),
    );
    assert.equal(progress.checks.find((c) => c.id === 'website')!.complete, false);
    site = (await result<{ website: Website }>(await admin.request('GET', route('/website'))))
      .website;
    site = (
      await result<{ website: Website }>(
        await admin.request('POST', route('/website/unpublish'), {
          expectedRevision: site.revision,
        }),
        201,
      )
    ).website;
    assert.equal((await fetch(`${base}/api/b2b/public/atlas-demo`)).status, 404);
    await result(
      await admin.request('POST', route('/website/publish'), { expectedRevision: site.revision }),
      201,
    );
    assert.equal((await fetch(`${base}/api/b2b/public/atlas-demo`)).status, 200);
  });
  test('uploaded media remains tenant-private, validates every reference and preserves authorized historical access', async () => {
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
      'base64',
    );
    const upload = (who: Client, body = bytes, extra: Record<string, string> = {}) =>
      fetch(`${base}${route('/media?kind=image&label=Test%20image')}`, {
        method: 'POST',
        headers: {
          origin: config.origin,
          cookie: who.cookie(),
          'x-klisteni-b2b-account': who.id,
          'content-type': 'image/png',
          ...extra,
        },
        body,
      });
    assert.equal((await upload(member)).status, 403);
    assert.equal((await upload(otherAdmin)).status, 403);
    assert.equal(
      (await upload(admin, bytes, { origin: 'https://foreign.example.test' })).status,
      403,
    );
    assert.equal((await upload(admin, bytes, { 'x-klisteni-b2b-account': '' })).status, 401);
    assert.equal((await upload(admin, Buffer.from('<svg/>'))).status, 415);
    const media = (await result<{ media: Media }>(await upload(coach), 201)).media;
    const asset = {
      id: media.id,
      kind: media.kind,
      url: media.url,
      label: media.label,
      attribution: media.attribution,
    };
    assert.equal((await fetch(base + media.url)).status, 404);
    assert.equal((await member.request('GET', media.url)).status, 404);
    assert.equal((await otherAdmin.request('GET', media.url)).status, 404);
    const privateRead = await admin.request('GET', media.url);
    assert.equal(privateRead.status, 200);
    assert.deepEqual(Buffer.from(await privateRead.arrayBuffer()), bytes);
    assert.equal(privateRead.headers.get('cache-control'), 'no-store');
    const ranged = await admin.request('GET', media.url, undefined, { range: 'bytes=0-7' });
    assert.equal(ranged.status, 206);
    assert.equal((await ranged.arrayBuffer()).byteLength, 8);
    const absolute = config.origin + media.url,
      encoded = media.url.replace('/media/', '/%6dedia/');
    for (const url of [media.url, absolute, encoded]) {
      const foreign = { ...asset, url };
      assert.equal(
        (
          await otherAdmin.request('PUT', route('/brand', 'sur-demo'), {
            name: 'No stolen image',
            logoUrl: url,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await otherAdmin.request('POST', route('/machines', 'sur-demo'), {
            name: 'No stolen machine image',
            type: 'cable',
            assets: [foreign],
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await otherAdmin.request('POST', route('/units', 'sur-demo'), {
            machineId: 'base-cable-station-v1',
            label: 'No stolen unit image',
            assets: [foreign],
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await otherCoach.request('POST', route('/exercises', 'sur-demo'), {
            name: 'No stolen exercise image',
            instructions: ['Test'],
            assets: [foreign],
          })
        ).status,
        400,
      );
      const site = (
        await result<{ website: Website }>(
          await otherAdmin.request('GET', route('/website', 'sur-demo')),
        )
      ).website;
      assert.equal(
        (
          await otherAdmin.request('PUT', route('/website', 'sur-demo'), {
            ...site.draft,
            gallery: [foreign],
            expectedRevision: site.revision,
          })
        ).status,
        400,
      );
    }
    assert.equal(
      (
        await admin.request('POST', route('/machines'), {
          name: 'Wrong kind',
          type: 'cable',
          assets: [{ ...asset, kind: 'video' }],
        })
      ).status,
      400,
    );
    const data = ExerciseInputSchema.parse({
      name: 'Historical media exercise',
      instructions: ['Demonstration'],
      assets: [asset],
    });
    let exercise = await publishExercise(
      (
        await result<{ exercise: Exercise }>(
          await coach.request('POST', route('/exercises'), data),
          201,
        )
      ).exercise,
    );
    assert.equal((await fetch(base + media.url)).status, 200);
    const program = (
      await result<{ program: Program }>(
        await coach.request('POST', route('/programs'), {
          name: 'Media prescription',
          steps: [{ id: 'media-step', exerciseId: exercise.id, sets: 1, reps: 1 }],
        }),
        201,
      )
    ).program;
    const version = (
      await result<{ version: ProgramVersion }>(
        await coach.request('POST', route(`/programs/${program.id}/publish`), {
          expectedRevision: program.revision,
        }),
        201,
      )
    ).version;
    await result(
      await coach.request('POST', route('/assignments'), {
        memberId: member.id,
        programId: program.id,
        version: version.version,
      }),
      201,
    );
    exercise = (
      await result<{ exercise: Exercise }>(
        await coach.request('PUT', route(`/exercises/${exercise.id}`), {
          ...data,
          assets: [],
          expectedRevision: exercise.revision,
        }),
      )
    ).exercise;
    assert.equal(exercise.status, 'draft');
    assert.equal((await fetch(base + media.url)).status, 404);
    assert.equal((await member.request('GET', media.url)).status, 200);
    assert.equal((await otherMember.request('GET', media.url)).status, 404);
    let site = (await result<{ website: Website }>(await admin.request('GET', route('/website'))))
      .website;
    site = (
      await result<{ website: Website }>(
        await admin.request('PUT', route('/website'), {
          ...site.draft,
          gallery: [asset],
          expectedRevision: site.revision,
        }),
      )
    ).website;
    assert.equal((await fetch(base + media.url)).status, 404);
    site = (
      await result<{ website: Website }>(
        await admin.request('POST', route('/website/publish'), { expectedRevision: site.revision }),
        201,
      )
    ).website;
    assert.equal((await fetch(base + media.url)).status, 200);
    site = (
      await result<{ website: Website }>(
        await admin.request('POST', route('/website/unpublish'), {
          expectedRevision: site.revision,
        }),
        201,
      )
    ).website;
    assert.equal((await fetch(base + media.url)).status, 404);
    site = (
      await result<{ website: Website }>(
        await admin.request('PUT', route('/website'), {
          ...site.draft,
          gallery: [],
          expectedRevision: site.revision,
        }),
      )
    ).website;
    await result(
      await admin.request('POST', route('/website/publish'), { expectedRevision: site.revision }),
      201,
    );
    const quota = config.mediaQuotaMb;
    config.mediaQuotaMb = bytes.length / 1024 ** 2;
    try {
      assert.equal((await upload(admin)).status, 413);
    } finally {
      config.mediaQuotaMb = quota;
    }
    const list = await result<{ media: Media[]; usage: { bytes: number } }>(
      await admin.request('GET', route('/media')),
    );
    assert.equal(list.media.length, 1);
    assert.equal(list.usage.bytes, bytes.length);
  });
  test('website floor plan images and spatial models reject another gym’s uploaded media without changing either snapshot', async () => {
    const { media: library } = await result<{ media: Media[] }>(
      await admin.request('GET', route('/media')),
    );
    const image = library.find((media) => media.kind === 'image');
    assert.ok(image, 'Use the real validated PNG uploaded in the media fixture');
    const bytes = glb();
    const model = (
      await result<{ media: Media }>(
        await fetch(`${base}${route('/media?kind=model3d&label=Spatial%20test%20triangle')}`, {
          method: 'POST',
          headers: {
            origin: config.origin,
            cookie: admin.cookie(),
            'x-klisteni-b2b-account': admin.id,
            'content-type': 'model/gltf-binary',
          },
          body: bytes,
        }),
        201,
      )
    ).media;
    const privateModel = await admin.request('GET', model.url);
    assert.equal(privateModel.status, 200);
    assert.deepEqual(Buffer.from(await privateModel.arrayBuffer()), bytes);
    assert.equal((await fetch(base + model.url)).status, 404);
    const before = (
      await result<{ website: Website }>(
        await otherAdmin.request('GET', route('/website', 'sur-demo')),
      )
    ).website;
    const publicBefore = await result<PublicSite>(await fetch(`${base}/api/b2b/public/sur-demo`));

    for (const media of [image, model]) {
      assert.equal((await otherAdmin.request('GET', media.url)).status, 404);
      const asset = {
        id: media.id,
        kind: media.kind,
        url: media.url,
        label: media.label,
        attribution: media.attribution,
      };
      const variants = [
        [asset, 'INVALID_MEDIA_REFERENCE'],
        // Development's absolute HTTP origin is rejected by the asset input schema.
        [{ ...asset, url: config.origin + media.url }, 'INVALID_INPUT'],
        [{ ...asset, url: media.url.replace('/media/', '/%6dedia/') }, 'INVALID_MEDIA_REFERENCE'],
        [{ ...asset, id: `forged-${media.id}` }, 'INVALID_MEDIA_REFERENCE'],
      ] as const;
      for (const [foreign, expectedCode] of variants) {
        const field =
          media.kind === 'image'
            ? {
                floorPlan: {
                  title: 'Foreign floor plan',
                  description: '',
                  image: foreign,
                  points: [],
                },
              }
            : { spatialModel: foreign };
        const rejected = await result<{ code: string }>(
          await otherAdmin.request('PUT', route('/website', 'sur-demo'), {
            ...before.draft,
            ...field,
            expectedRevision: before.revision,
          }),
          400,
        );
        assert.equal(rejected.code, expectedCode);
        assert.deepEqual(
          (
            await result<{ website: Website }>(
              await otherAdmin.request('GET', route('/website', 'sur-demo')),
            )
          ).website,
          before,
          'A rejected foreign asset must preserve the draft, revision and publication metadata',
        );
      }
      assert.equal((await otherAdmin.request('GET', media.url)).status, 404);
    }
    assert.deepEqual(
      await result<PublicSite>(await fetch(`${base}/api/b2b/public/sur-demo`)),
      publicBefore,
      'Rejected draft writes must not add foreign assets to the published website',
    );
    assert.equal((await fetch(base + model.url)).status, 404);
  });
  test(
    'membership revocation during an upload prevents its commit and cleans the unreferenced file',
    { timeout: 10000 },
    async () => {
      const user = await service.transaction(async (db) => {
        const user = await createUser(db, auth, {
          email: `uploader-${randomUUID()}@example.test`,
          name: 'Temporary uploader',
          password,
        });
        await db.query(
          "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES('atlas-demo',$1,'coach')",
          [user.id],
        );
        return user;
      });
      const uploader = await client(user.email, user.id),
        beforeFiles = (await readdir(config.mediaRoot!)).sort();
      const bytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
        'base64',
      );
      let ready!: () => void, continueBody!: () => void;
      const checked = new Promise<void>((resolve) => {
          ready = resolve;
        }),
        gate = new Promise<void>((resolve) => {
          continueBody = resolve;
        });
      const original = service.uploadAllowance.bind(service);
      service.uploadAllowance = async (context, size) => {
        await original(context, size);
        ready();
      };
      const body = Readable.from(
        (async function* () {
          yield bytes.subarray(0, 8);
          await gate;
          yield bytes.subarray(8);
        })(),
      );
      const options = {
        method: 'POST',
        headers: {
          origin: config.origin,
          cookie: uploader.cookie(),
          'content-type': 'image/png',
          'x-klisteni-b2b-account': user.id,
        },
        body,
        duplex: 'half',
      };
      const pending = fetch(
        `${base}${route('/media?kind=image&label=Must%20not%20commit')}`,
        options as unknown as RequestInit,
      );
      try {
        await checked;
        await result(await admin.request('PATCH', route(`/members/${user.id}`), { active: false }));
        continueBody();
        assert.equal((await pending).status, 403);
        assert.deepEqual((await readdir(config.mediaRoot!)).sort(), beforeFiles);
        assert.equal(
          (await pool.query('SELECT id FROM b2b_media WHERE created_by=$1', [user.id])).rowCount,
          0,
        );
      } finally {
        continueBody();
        service.uploadAllowance = original;
      }
    },
  );
  test('new invitation is one-use; an existing B2B identity joins another gym without password reset', async () => {
    const email = `new-${randomUUID()}@example.test`;
    const invite = await result<{ url: string }>(
      await admin.request('POST', route('/invitations'), {
        email,
        name: 'New member',
        role: 'member',
      }),
      201,
    );
    const token = new URL(invite.url).searchParams.get('token')!;
    await result(
      await member.request('POST', '/api/b2b/invitations/accept', {
        token,
        name: 'New member',
        password,
      }),
      201,
    );
    assert.equal(
      (
        await member.request('POST', '/api/b2b/invitations/accept', {
          token,
          name: 'New member',
          password,
        })
      ).status,
      400,
    );
    const existingInvite = await result<{ url: string }>(
      await otherAdmin.request('POST', route('/invitations', 'sur-demo'), {
        email: seeded.gyms[0].member.email,
        name: 'Existing member',
        role: 'member',
      }),
      201,
    );
    const existingToken = new URL(existingInvite.url).searchParams.get('token')!;
    const before = (
      await pool.query('SELECT password FROM b2b_auth_account WHERE "userId"=$1', [member.id])
    ).rows[0].password;
    assert.equal(
      (
        await member.request('POST', '/api/b2b/invitations/accept', {
          token: existingToken,
          name: 'Replace',
          password: 'must-not-replace-password',
        })
      ).status,
      409,
    );
    assert.equal(
      (await otherMember.request('POST', '/api/b2b/invitations/join', { token: existingToken }))
        .status,
      409,
    );
    await result(
      await member.request('POST', '/api/b2b/invitations/join', { token: existingToken }),
    );
    assert.equal(
      (await pool.query('SELECT password FROM b2b_auth_account WHERE "userId"=$1', [member.id]))
        .rows[0].password,
      before,
    );
    assert.equal((await member.request('GET', route('/assignments', 'sur-demo'))).status, 200);
    // Coaching relationships remain informational inside the authorized Principal branch.
    assert.equal(
      (await otherCoach.request('GET', route(`/assignments?memberId=${member.id}`, 'sur-demo')))
        .status,
      200,
    );
  });
  test('membership suspension and role changes revoke capabilities immediately, last admin protected', async () => {
    assert.equal(
      (await admin.request('PATCH', route(`/members/${admin.id}`), { active: false })).status,
      409,
    );
    await result(await admin.request('PATCH', route(`/members/${coach.id}`), { active: false }));
    assert.equal((await coach.request('GET', route('/reports'))).status, 403);
    await result(
      await admin.request('PATCH', route(`/members/${coach.id}`), { active: true, role: 'member' }),
    );
    await pool.query(
      'INSERT INTO b2b_coach_assignment(organization_id,coach_id,member_id) VALUES($1,$2,$3)',
      ['atlas-demo', coach.id, member.id],
    );
    assert.equal((await coach.request('GET', route('/reports'))).status, 403);
    assert.equal(
      (await coach.request('GET', route(`/executions?memberId=${member.id}`))).status,
      403,
    );
    await result(await admin.request('PATCH', route(`/members/${coach.id}`), { role: 'coach' }));
    assert.equal(
      (await coach.request('GET', route(`/executions?memberId=${member.id}`))).status,
      200,
    );
    await result(
      await admin.request('POST', route('/coach-assignments'), {
        coachId: coach.id,
        memberId: member.id,
      }),
      201,
    );
    assert.equal(
      (await coach.request('GET', route(`/executions?memberId=${member.id}`))).status,
      200,
    );
  });
  test('an unassigned coach covers another coach student within the authorized Principal branch', async () => {
    const stranger = await service.transaction(async (db) => {
      const user = await createUser(db, auth, {
        email: `coach-${randomUUID()}@example.test`,
        name: 'Unassigned coach',
        password,
      });
      await db.query(
        "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES('atlas-demo',$1,'coach')",
        [user.id],
      );
      return user;
    });
    const unassigned = await client(stranger.email, stranger.id);
    const list = await result<{ assignments: Assignment[] }>(
      await unassigned.request('GET', route('/assignments')),
    );
    assert.ok(list.assignments.some((assignment) => assignment.memberId === member.id));
    assert.equal(
      (await unassigned.request('GET', route(`/executions?memberId=${member.id}`))).status,
      200,
    );
    assert.equal(
      (
        await unassigned.request('POST', route('/assignments'), {
          memberId: member.id,
          programId: 'atlas-demo-starter',
          version: 1,
        })
      ).status,
      201,
    );
  });
  test('a write queued behind a suspension rechecks membership after acquiring the organization lock', async () => {
    const lock = await pool.connect();
    await lock.query('BEGIN');
    await lock.query("SELECT id FROM b2b_organization WHERE id='atlas-demo' FOR UPDATE");
    const input: ExecutionInput = {
      id: randomUUID(),
      assignmentId: seeded.gyms[0].assignmentId,
      status: 'partial',
      completedAt: new Date().toISOString(),
      notes: '',
      sets: [
        {
          stepId: 'squat-step',
          set: 1,
          exerciseId: 'squat',
          reps: 5,
          durationSeconds: null,
          rpe: null,
          loadKg: null,
          reason: '',
        },
      ],
    };
    const pending = member.request('POST', route('/executions'), input);
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const found = await pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE application_name='klisteni-b2b-api' AND wait_event_type='Lock' AND (query LIKE 'SELECT * FROM b2b_organization%' OR query='SELECT id FROM b2b_organization WHERE id=$1 FOR SHARE') AND datname=current_database()",
        );
        if (found.rowCount) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(waiting, 'request must reach the lock before revocation commits');
      await lock.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas-demo' AND user_id=$1",
        [member.id],
      );
      await lock.query('COMMIT');
      assert.equal((await pending).status, 403);
      assert.equal(
        (
          await pool.query('SELECT id FROM b2b_execution WHERE organization_id=$1 AND id=$2', [
            'atlas-demo',
            input.id,
          ])
        ).rowCount,
        0,
      );
    } finally {
      await lock.query('ROLLBACK');
      lock.release();
      await pool.query(
        "UPDATE b2b_membership SET active=true WHERE organization_id='atlas-demo' AND user_id=$1",
        [member.id],
      );
    }
  });
  test('operator adds gyms to an existing installation idempotently without resetting an existing identity', async () => {
    const input = {
      email: seeded.gyms[0].admin.email,
      name: 'Existing admin',
      slug: 'third-gym',
      organizationName: 'Third gym',
    };
    const before = (
      await pool.query('SELECT password FROM b2b_auth_account WHERE "userId"=$1', [admin.id])
    ).rows[0].password;
    const added = await createOrganization(pool, auth, config, {
      ...input,
      password: 'ignored-existing-password',
    });
    assert.equal(added.created, true);
    assert.equal(added.admin.id, admin.id);
    assert.equal((await fetch(`${base}/api/b2b/public/third-gym`)).status, 404);
    const newWebsite = await result<{ website: Website }>(
      await admin.request('GET', route('/website', 'third-gym')),
    );
    assert.equal(newWebsite.website.publishedRevision, null);
    assert.equal((await createOrganization(pool, auth, config, input)).created, false);
    assert.equal(
      (await pool.query('SELECT password FROM b2b_auth_account WHERE "userId"=$1', [admin.id]))
        .rows[0].password,
      before,
    );
    await assert.rejects(
      createOrganization(pool, auth, config, { ...input, email: seeded.gyms[1].admin.email }),
    );
    await assert.rejects(
      createOrganization(pool, auth, config, { ...input, organizationName: 'Conflicting name' }),
    );
    await assert.rejects(
      createOrganization(pool, auth, config, {
        ...input,
        slug: 'new-without-password',
        email: 'new-admin@example.test',
      }),
    );
    const newOrg = await createOrganization(pool, auth, config, {
      ...input,
      slug: 'new-with-password',
      email: 'new-admin@example.test',
      password,
    });
    assert.equal(newOrg.created, true);
    assert.notEqual(newOrg.admin.id, admin.id);
  });
  test('a session revoked while a write waits cannot authorize the queued mutation', async () => {
    const lock = await pool.connect();
    await lock.query('BEGIN');
    await lock.query("SELECT id FROM b2b_organization WHERE id='atlas-demo' FOR UPDATE");
    const input: ExecutionInput = {
      id: randomUUID(),
      assignmentId: seeded.gyms[0].assignmentId,
      status: 'partial',
      completedAt: new Date().toISOString(),
      notes: '',
      sets: [
        {
          stepId: 'squat-step',
          set: 1,
          exerciseId: 'squat',
          reps: 5,
          durationSeconds: null,
          rpe: null,
          loadKg: null,
          reason: '',
        },
      ],
    };
    const pending = member.request('POST', route('/executions'), input);
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const found = await pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE application_name='klisteni-b2b-api' AND wait_event_type='Lock' AND (query LIKE 'SELECT * FROM b2b_organization%' OR query='SELECT id FROM b2b_organization WHERE id=$1 FOR SHARE') AND datname=current_database()",
        );
        if (found.rowCount) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(waiting);
      await result(await member.request('POST', '/api/b2b/auth/sign-out', {}));
      await lock.query('COMMIT');
      assert.equal((await pending).status, 401);
      assert.equal(
        (
          await pool.query('SELECT id FROM b2b_execution WHERE organization_id=$1 AND id=$2', [
            'atlas-demo',
            input.id,
          ])
        ).rowCount,
        0,
      );
    } finally {
      await lock.query('ROLLBACK');
      lock.release();
    }
  });
  test('demo reset requires explicit mode, marker and confirmation; leaves unrelated tables untouched', async () => {
    await assert.rejects(resetDemo(pool, { ...config, demoMode: false }, true));
    await assert.rejects(resetDemo(pool, config, false));
    await pool.query("UPDATE b2b_environment SET purpose='normal'");
    await assert.rejects(resetDemo(pool, config, true));
    await pool.query("UPDATE b2b_environment SET purpose='demo'");
    await pool.query('CREATE TABLE unrelated_data(id integer)');
    await pool.query('INSERT INTO unrelated_data VALUES(7)');
    await resetDemo(pool, config, true);
    assert.equal((await pool.query('SELECT id FROM unrelated_data')).rows[0].id, 7);
    assert.equal((await pool.query('SELECT id FROM b2b_auth_user')).rowCount, 0);
    assert.equal((await pool.query('SELECT id FROM b2b_migration')).rowCount, 10);
  });
});
