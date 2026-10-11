import type { Pool } from 'pg';
import { z } from 'zod';
import {
  BrandInputSchema,
  ExerciseInputSchema,
  ProgramInputSchema,
  WebsiteInputSchema,
  type Exercise,
  type Machine,
  type ProgramVersion,
} from '@klisteniapp/b2b-contracts';
import type { Config } from './config.ts';
import type { Auth } from './auth.ts';
import { B2BService, createUser, seedBaseCatalog } from './service.ts';

export const DEMO_GYMS = [
  {
    id: 'atlas-demo',
    slug: 'atlas-demo',
    name: 'Atlas Demo',
    color: '#c75b35',
    adminEmail: 'admin@atlas.example.test',
    coachEmail: 'coach@atlas.example.test',
    unassignedCoachEmail: 'unassigned-coach@atlas.example.test',
    memberEmail: 'member@atlas.example.test',
  },
  {
    id: 'sur-demo',
    slug: 'sur-demo',
    name: 'Sur Demo',
    color: '#246b63',
    adminEmail: 'admin@sur.example.test',
    coachEmail: 'coach@sur.example.test',
    unassignedCoachEmail: 'unassigned-coach@sur.example.test',
    memberEmail: 'member@sur.example.test',
  },
] as const;
const passwordSchema = z.string().min(12).max(128);
const demoRoleLabels = {
  admin: 'Administrador',
  coach: 'Instructor',
  unassignedCoach: 'Instructor sin socios asignados',
  member: 'Socio',
} as const;
export async function requireDemoDatabase(pool: Pool, config: Config) {
  if (!config.demoMode || config.production)
    throw new Error('Demo operations require B2B_DEMO_MODE=true outside production');
  const name = (await pool.query<{ name: string }>('SELECT current_database() name')).rows[0].name;
  if (!/(?:b2b.*(?:demo|test)|(?:demo|test).*b2b)/i.test(name))
    throw new Error(
      'Demo operations require a dedicated database with b2b and demo/test in its name',
    );
}
export async function seedDemo(pool: Pool, auth: Auth, config: Config, password: string) {
  passwordSchema.parse(password);
  await requireDemoDatabase(pool, config);
  const service = new B2BService(pool, auth, config);
  return service.transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('klisteni-b2b:demo',0))");
    const purpose = (
      await db.query<{ purpose: string }>(
        'SELECT purpose FROM b2b_environment WHERE id=true FOR UPDATE',
      )
    ).rows[0]?.purpose;
    if (purpose !== 'demo' && (await db.query('SELECT id FROM b2b_auth_user LIMIT 1')).rowCount)
      throw new Error('Refusing to mark an existing non-demo installation as demo');
    await db.query("UPDATE b2b_environment SET purpose='demo' WHERE id=true");
    await seedBaseCatalog(db);
    const gyms = [];
    for (const gym of DEMO_GYMS) {
      const users: Record<string, { id: string; email: string; name: string }> = {};
      for (const [role, email] of [
        ['admin', gym.adminEmail],
        ['coach', gym.coachEmail],
        ['unassignedCoach', gym.unassignedCoachEmail],
        ['member', gym.memberEmail],
      ] as const) {
        const existing = (
          await db.query<{ id: string; email: string; name: string }>(
            'SELECT id,email,name FROM b2b_auth_user WHERE email=$1',
            [email],
          )
        ).rows[0];
        users[role] =
          existing ??
          (await createUser(db, auth, {
            email,
            name: `${gym.name} ${demoRoleLabels[role]}`,
            password,
          }));
      }
      const brand = BrandInputSchema.parse({
        name: gym.name,
        color: gym.color,
        description: 'Gimnasio de demostración con personas y actividad ficticias.',
        address: 'Sala de entrenamiento demo',
        contact: 'equipo@example.test',
      });
      await db.query(
        'INSERT INTO b2b_organization(id,slug,brand) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
        [gym.id, gym.slug, brand],
      );
      const website = WebsiteInputSchema.parse({
        headline: gym.name,
        introduction: brand.description,
        activities: [
          {
            id: 'strength',
            name: 'Sala de fuerza',
            description: 'Entrenamiento acompañado por instructores.',
            schedule: 'Durante el horario de apertura',
          },
        ],
        openingHours: [{ id: 'weekdays', days: 'Lunes a viernes', hours: '08:00 a 21:00' }],
      });
      await db.query(
        'INSERT INTO b2b_website(organization_id,draft,published,published_revision,published_at) VALUES($1,$2,$3,0,now()) ON CONFLICT DO NOTHING',
        [gym.id, website, { content: website, brand }],
      );
      for (const role of ['admin', 'coach', 'unassignedCoach', 'member'])
        await db.query(
          'INSERT INTO b2b_membership(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [gym.id, users[role].id, role === 'unassignedCoach' ? 'coach' : role],
        );
      await db.query(
        'INSERT INTO b2b_coach_assignment(organization_id,coach_id,member_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [gym.id, users.coach.id, users.member.id],
      );
      await db.query('INSERT INTO b2b_platform_admin(user_id) VALUES($1) ON CONFLICT DO NOTHING', [
        users.admin.id,
      ]);
      const unitId = `${gym.id}-cable-01`,
        exerciseId = `${gym.id}-cable-row`,
        programId = `${gym.id}-starter`,
        assignmentId = `${gym.id}-assignment`;
      await db.query(
        'INSERT INTO b2b_unit(id,organization_id,machine_id,label,location,adjustments) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',
        [
          unitId,
          gym.id,
          'base-cable-station-v1',
          'Polea 01',
          'Sala principal',
          'Comprobá el pasador y ajustá el asiento antes de empezar.',
        ],
      );
      // Two physical units deliberately share one catalog model. A long label
      // exercises the same wrapping and QR layout used by real inventories.
      const secondUnitId = `${gym.id}-cable-02`;
      await db.query(
        'INSERT INTO b2b_unit(id,organization_id,machine_id,label,location,adjustments) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',
        [
          secondUnitId,
          gym.id,
          'base-cable-station-v1',
          'Polea 02 · estación de tracción y fortalecimiento con ajuste de asiento independiente',
          'Sala principal · sector de entrenamiento acompañado',
          'Esta unidad tiene otro ajuste de asiento. Verificá tu posición con el instructor.',
        ],
      );
      const exercise = ExerciseInputSchema.parse({
        name: 'Remo en polea sentado',
        description: 'Ejercicio propio del gimnasio usando un modelo compartido de polea.',
        instructions: [
          'Ajustá el asiento y la carga con ayuda del instructor.',
          'Con el tronco estable, llevá el agarre hacia el torso.',
          'Volvé de forma controlada.',
        ],
        equipment: 'cable',
        machineId: 'base-cable-station-v1',
        compatibleMachineIds: ['base-cable-station-v1'],
        pattern: 'Tracción',
        muscles: ['lats', 'biceps'],
      });
      await db.query(
        "INSERT INTO b2b_exercise(id,organization_id,data,status) VALUES($1,$2,$3,'published') ON CONFLICT(id) DO NOTHING",
        [exerciseId, gym.id, exercise],
      );
      const unpublishedExerciseId = `${gym.id}-cable-row-draft`;
      await db.query(
        "INSERT INTO b2b_exercise(id,organization_id,data,status) VALUES($1,$2,$3,'draft') ON CONFLICT(id) DO NOTHING",
        [
          unpublishedExerciseId,
          gym.id,
          ExerciseInputSchema.parse({
            ...exercise,
            name: 'Remo en polea · adaptación pendiente de revisión y publicación del instructor',
            description:
              'Borrador privado para validar que el catálogo público no adelanta contenido.',
          }),
        ],
      );
      const data = ProgramInputSchema.parse({
        name: 'Inicio · fuerza y técnica',
        description: 'Rutina de ejemplo asignada por tu instructor.',
        steps: [
          {
            id: 'squat-step',
            exerciseId: 'squat',
            sets: 2,
            reps: 10,
            restSeconds: 60,
            alternatives: ['quarter-squat'],
          },
          {
            id: 'row-step',
            exerciseId,
            sets: 2,
            reps: 10,
            loadKg: 10,
            restSeconds: 60,
            alternatives: ['row'],
          },
        ],
      });
      await db.query(
        'INSERT INTO b2b_program(id,organization_id,data,published_version) VALUES($1,$2,$3,1) ON CONFLICT(id) DO NOTHING',
        [programId, gym.id, data],
      );
      const exercises = (
        await db.query<{
          id: string;
          organization_id: string | null;
          data: Exercise;
          version: number;
          revision: number;
        }>('SELECT * FROM b2b_exercise WHERE id=ANY($1::text[])', [
          ['squat', 'quarter-squat', 'row', exerciseId],
        ])
      ).rows.map((r) => ({
        ...r.data,
        id: r.id,
        version: r.version,
        revision: r.revision,
        status: 'published' as const,
        scope: r.organization_id ? ('organization' as const) : ('base' as const),
      }));
      const machines = (
        await db.query<{ id: string; data: Machine; version: number; revision: number }>(
          "SELECT * FROM b2b_machine WHERE id='base-cable-station-v1'",
        )
      ).rows.map((r) => ({
        ...r.data,
        id: r.id,
        scope: 'base' as const,
        status: 'published' as const,
        version: r.version,
        revision: r.revision,
      }));
      const snapshot: ProgramVersion = {
        ...data,
        programId,
        version: 1,
        exercises,
        machines,
        publishedAt: new Date().toISOString(),
      };
      await db.query(
        'INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot) VALUES($1,$2,1,$3) ON CONFLICT DO NOTHING',
        [gym.id, programId, snapshot],
      );
      await db.query(
        'INSERT INTO b2b_program_assignment(id,organization_id,member_id,program_id,version,assigned_by) VALUES($1,$2,$3,$4,1,$5) ON CONFLICT(id) DO NOTHING',
        [assignmentId, gym.id, users.member.id, programId, users.coach.id],
      );
      gyms.push({
        id: gym.id,
        slug: gym.slug,
        admin: users.admin,
        coach: users.coach,
        unassignedCoach: users.unassignedCoach,
        member: users.member,
        unitId,
        secondUnitId,
        unpublishedExerciseId,
        assignmentId,
      });
    }
    return { gyms, passwordSource: 'B2B_DEMO_PASSWORD' };
  });
}
export async function resetDemo(pool: Pool, config: Config, confirmed: boolean) {
  await requireDemoDatabase(pool, config);
  if (!confirmed)
    throw new Error('Pass --confirm-demo-reset to reset the dedicated synthetic demo database');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('klisteni-b2b:demo',0))");
    if (
      (
        await db.query<{ purpose: string }>(
          'SELECT purpose FROM b2b_environment WHERE id=true FOR UPDATE',
        )
      ).rows[0]?.purpose !== 'demo'
    )
      throw new Error('Database has no synthetic demo marker');
    // Explicit owned tables; never discover/truncate unrelated schemas or B2C tables.
    await db.query(
      `TRUNCATE b2b_media,b2b_unit_batch,b2b_website,b2b_audit,b2b_execution,b2b_program_assignment,b2b_program_version,b2b_program,b2b_exercise,b2b_unit,b2b_machine,b2b_invitation,b2b_coach_assignment,b2b_membership,b2b_organization,b2b_platform_admin,b2b_auth_account,b2b_auth_session,b2b_auth_verification,b2b_auth_rate_limit,b2b_auth_user,b2b_public_rate_limit`,
    );
    await db.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    db.release();
  }
}
