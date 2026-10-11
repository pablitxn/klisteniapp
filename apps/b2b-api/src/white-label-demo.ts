import type { Pool } from 'pg';
import {
  ThemeInputSchema,
  WebsiteInputSchema,
  type ProgramVersion,
} from '@klisteniapp/b2b-contracts';
import type { Auth } from './auth.ts';
import type { Config } from './config.ts';
import { seedDemo } from './demo.ts';
import { B2BService, createUser } from './service.ts';

/** Synthetic-only fixture. No DNS requests, external domain registration or production use. */
export async function seedWhiteLabelDemo(
  pool: Pool,
  auth: Auth,
  config: Config,
  password: string,
  port?: number,
) {
  const base = await seedDemo(pool, auth, config, password);
  const service = new B2BService(pool, auth, config);
  return service.transaction(async (db) => {
    await db.query("SELECT set_config('b2b.explicit_branch_scope','on',true)");
    const gyms = [];
    for (const gym of base.gyms) {
      const label = gym.id === 'atlas-demo' ? 'atlas' : 'sur';
      const secondSlug = label === 'atlas' ? 'norte' : 'oeste';
      const firstId = `${gym.id}-principal`,
        secondId = `${gym.id}-${secondSlug}`;
      const website = (
        await db.query<{ draft: unknown }>(
          'SELECT draft FROM b2b_website WHERE organization_id=$1',
          [gym.id],
        )
      ).rows[0].draft;
      await db.query(
        "UPDATE b2b_branch SET slug='centro',name='Centro',public=true,draft=$2,published=$2,published_revision=0,published_at=now() WHERE id=$1",
        [firstId, website],
      );
      const secondWebsite = WebsiteInputSchema.parse({
        ...(website as object),
        headline: `${label === 'atlas' ? 'Atlas' : 'Sur'} ${secondSlug === 'norte' ? 'Norte' : 'Oeste'}`,
      });
      await db.query(
        `INSERT INTO b2b_branch(id,organization_id,slug,name,address,public,draft,published,published_revision,published_at)
        VALUES($1,$2,$3,$4,$5,true,$6,$6,0,now()) ON CONFLICT(id) DO NOTHING`,
        [
          secondId,
          gym.id,
          secondSlug,
          secondSlug === 'norte' ? 'Norte' : 'Oeste',
          `Avenida ${secondSlug} 200`,
          secondWebsite,
        ],
      );
      await db.query(
        "UPDATE b2b_branch SET published_profile=jsonb_build_object('id',id,'slug',slug,'name',name,'address',address,'contact',contact,'timezone',timezone) WHERE organization_id=$1 AND published IS NOT NULL",
        [gym.id],
      );
      const secondUsers: Record<string, { id: string; email: string; name: string }> = {};
      for (const role of ['coach', 'member']) {
        const email = `${role}-${secondSlug}@${label}.example.test`;
        let user = (
          await db.query<{ id: string; email: string; name: string }>(
            'SELECT id,email,name FROM b2b_auth_user WHERE email=$1',
            [email],
          )
        ).rows[0];
        if (!user)
          user = await createUser(db, auth, {
            email,
            name: `${label} ${secondSlug} ${role}`,
            password,
          });
        secondUsers[role] = user;
        await db.query(
          'INSERT INTO b2b_membership(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [gym.id, user.id, role],
        );
        await db.query(
          'INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [gym.id, secondId, user.id, role],
        );
      }
      await db.query(
        'INSERT INTO b2b_coach_assignment(organization_id,branch_id,coach_id,member_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [gym.id, secondId, secondUsers.coach.id, secondUsers.member.id],
      );
      const unitId = `${gym.id}-${secondSlug}-cable-01`,
        programId = `${gym.id}-${secondSlug}-starter`,
        assignmentId = `${gym.id}-${secondSlug}-assignment`;
      await db.query(
        "INSERT INTO b2b_unit(id,organization_id,branch_id,machine_id,label,location) VALUES($1,$2,$3,'base-cable-station-v1','Polea 01','Sala 1') ON CONFLICT DO NOTHING",
        [unitId, gym.id, secondId],
      );
      const source = (
        await db.query<{ data: unknown }>('SELECT data FROM b2b_program WHERE id=$1', [
          `${gym.id}-starter`,
        ])
      ).rows[0];
      await db.query(
        'INSERT INTO b2b_program(id,organization_id,branch_id,data,published_version) VALUES($1,$2,$3,$4,1) ON CONFLICT DO NOTHING',
        [programId, gym.id, secondId, source.data],
      );
      const snapshot = (
        await db.query<{ snapshot: ProgramVersion }>(
          'SELECT snapshot FROM b2b_program_version WHERE organization_id=$1 AND program_id=$2 AND version=1',
          [gym.id, `${gym.id}-starter`],
        )
      ).rows[0].snapshot;
      // Explicit fixture availability is an admin's cross-branch content sharing action.
      await db.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES($1,$2,'exercise',$3,true) ON CONFLICT DO NOTHING",
        [gym.id, secondId, `${gym.id}-cable-row`],
      );
      await db.query(
        'INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot) VALUES($1,$2,$3,1,$4) ON CONFLICT DO NOTHING',
        [gym.id, secondId, programId, { ...snapshot, programId, branchId: secondId }],
      );
      await db.query(
        'INSERT INTO b2b_program_assignment(id,organization_id,branch_id,member_id,program_id,version,assigned_by) VALUES($1,$2,$3,$4,$5,1,$6) ON CONFLICT DO NOTHING',
        [assignmentId, gym.id, secondId, secondUsers.member.id, programId, secondUsers.coach.id],
      );
      const brand = (
        await db.query<{ brand: unknown }>('SELECT brand FROM b2b_organization WHERE id=$1', [
          gym.id,
        ])
      ).rows[0].brand;
      const theme = ThemeInputSchema.parse({
        brand,
        layout: label === 'atlas' ? 'energetic' : 'editorial',
        font: label === 'atlas' ? 'geometric' : 'humanist',
        radius: label === 'atlas' ? 'square' : 'round',
        palette:
          label === 'atlas'
            ? {
                primary: '#93401f',
                background: '#fffaf5',
                surface: '#faeee0',
                text: '#2e241e',
                accent: '#ecd0ac',
              }
            : {
                primary: '#246b63',
                background: '#f6fbfa',
                surface: '#e5f1ed',
                text: '#162c28',
                accent: '#aed5c6',
              },
        loginTitle: `Entrená en ${label === 'atlas' ? 'Atlas' : 'Sur'}`,
        loginDescription: 'Tu sede, tu equipo y tu entrenamiento.',
      });
      await db.query('UPDATE b2b_theme SET draft=$2,published=$2 WHERE organization_id=$1', [
        gym.id,
        theme,
      ]);
      await db.query(
        'UPDATE b2b_theme_version SET data=$2 WHERE organization_id=$1 AND version=1',
        [gym.id, theme],
      );
      const host = `${label}.b2b.test${port ? `:${port}` : ''}`;
      await db.query(
        `INSERT INTO b2b_domain(host,organization_id,status,primary_domain,verified_at,dns_verified_at,tls_verified_at,tls_expires_at,verification_evidence)
        VALUES($1,$2,'active',true,now(),now(),now(),now()+interval '1 day','isolated test fixture only') ON CONFLICT(host) DO NOTHING`,
        [host, gym.id],
      );
      gyms.push({
        ...gym,
        host,
        branches: [
          {
            id: firstId,
            slug: 'centro',
            name: 'Centro',
            coach: gym.coach,
            member: gym.member,
            unitId: gym.unitId,
            programId: `${gym.id}-starter`,
            assignmentId: gym.assignmentId,
          },
          {
            id: secondId,
            slug: secondSlug,
            name: secondSlug === 'norte' ? 'Norte' : 'Oeste',
            coach: secondUsers.coach,
            member: secondUsers.member,
            unitId,
            programId,
            assignmentId,
          },
        ],
      });
    }
    const email = 'multi@b2b.example.test';
    let multi = (
      await db.query<{ id: string; email: string; name: string }>(
        'SELECT id,email,name FROM b2b_auth_user WHERE email=$1',
        [email],
      )
    ).rows[0];
    if (!multi)
      multi = await createUser(db, auth, { email, name: 'Persona multicontexto', password });
    for (const gym of gyms) {
      await db.query(
        "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING",
        [gym.id, multi.id],
      );
      for (const [index, branch] of gym.branches.entries())
        await db.query(
          'INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [
            gym.id,
            branch.id,
            multi.id,
            gym.id === 'atlas-demo' && index === 0 ? 'coach' : 'member',
          ],
        );
    }
    return { gyms, multi, passwordSource: 'B2B_DEMO_PASSWORD' };
  });
}
