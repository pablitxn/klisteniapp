import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  BranchSchema,
  ThemeInputSchema,
  WebsiteInputSchema,
  MODULE_IDS,
  type Branch,
  type BranchInput,
  type BranchGrantInput,
  type BrandContext,
  type Theme,
  type ThemeState,
  type ModuleId,
  type EffectiveModules,
} from '@klisteniapp/b2b-contracts';
import { accessibleTheme, effectiveModules } from '@klisteniapp/b2b-domain';
import type { DomainContext } from './domain-context.ts';
import { admin, audit, type Context } from './organization-context.ts';
import { conflict, denied, HttpError, missing } from './errors.ts';

type BranchRow = {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  address: string;
  contact: string;
  timezone: string;
  opening_hours: unknown;
  status: string;
  public: boolean;
  revision: number;
};
export const branchDTO = (row: BranchRow): Branch =>
  BranchSchema.parse({
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    contact: row.contact,
    timezone: row.timezone,
    openingHours: row.opening_hours,
    status: row.status,
    public: row.public,
    revision: row.revision,
  });
type Queryable = Pick<Pool, 'query'>;
export async function readModules(
  db: Queryable,
  organizationId: string,
  branchId?: string,
): Promise<EffectiveModules> {
  const rows = await db.query<{
    module: ModuleId;
    platform_enabled: boolean;
    brand_enabled: boolean;
  }>('SELECT * FROM b2b_module_configuration WHERE organization_id=$1', [organizationId]);
  const branch = branchId
    ? (
        await db.query<{ module: ModuleId; enabled: boolean }>(
          'SELECT module,enabled FROM b2b_branch_module WHERE organization_id=$1 AND branch_id=$2',
          [organizationId, branchId],
        )
      ).rows
    : [];
  return effectiveModules(
    rows.rows.map((r) => ({
      module: r.module,
      platformEnabled: r.platform_enabled,
      brandEnabled: r.brand_enabled,
    })),
    Object.fromEntries(branch.map((r) => [r.module, r.enabled])),
  );
}

export class WhiteLabelService {
  readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async context(domain: DomainContext): Promise<BrandContext> {
    const row = (
      await this.pool.query<{
        id: string;
        slug: string;
        published: Theme;
        published_version: number;
        website: boolean;
      }>(
        `SELECT o.id,o.slug,t.published,t.published_version,EXISTS(SELECT 1 FROM b2b_website w WHERE w.organization_id=o.id AND w.published IS NOT NULL) website
       FROM b2b_organization o JOIN b2b_theme t ON t.organization_id=o.id WHERE o.id=$1`,
        [domain.organizationId],
      )
    ).rows[0];
    if (!row) throw missing();
    const theme = ThemeInputSchema.parse(row.published);
    const modules = await readModules(this.pool, row.id);
    const branches = modules.website
      ? (
          await this.pool.query<{ published_profile: BrandContext['branches'][number] }>(
            `SELECT published_profile FROM b2b_branch b WHERE organization_id=$1 AND status='active' AND public AND published IS NOT NULL AND published_profile IS NOT NULL
       AND NOT EXISTS(SELECT 1 FROM b2b_branch_module bm WHERE bm.organization_id=b.organization_id AND bm.branch_id=b.id AND bm.module='website' AND NOT bm.enabled)
       ORDER BY published_profile->>'name',id`,
            [row.id],
          )
        ).rows.map(({ published_profile }) => published_profile)
      : [];
    return {
      organization: { id: row.id, slug: row.slug, brand: theme.brand },
      theme,
      themeVersion: row.published_version,
      branches,
      modules,
      canonicalOrigin: domain.canonicalOrigin,
      websitePublished: row.website && modules.website,
    };
  }
  async access(organizationId: string, userId: string, brandAdmin: boolean) {
    const rows = await this.pool.query<BranchRow & { roles: ('admin' | 'coach' | 'member')[] }>(
      `SELECT b.*, (CASE WHEN $3 THEN ARRAY['admin']::text[] ELSE ARRAY[]::text[] END || ARRAY(SELECT role FROM b2b_branch_grant g WHERE g.organization_id=b.organization_id AND g.branch_id=b.id AND g.user_id=$2 AND g.active ORDER BY role)) roles
       FROM b2b_branch b WHERE b.organization_id=$1 AND b.status='active'
       AND ($3 OR EXISTS(SELECT 1 FROM b2b_branch_grant g WHERE g.organization_id=b.organization_id AND g.branch_id=b.id AND g.user_id=$2 AND g.active)) ORDER BY b.name,b.id`,
      [organizationId, userId, brandAdmin],
    );
    return {
      organizationId,
      brandAdmin,
      branches: rows.rows.map((row) => ({ branch: branchDTO(row), roles: row.roles })),
    };
  }
  async branches(c: Context) {
    admin(c);
    return {
      branches: (
        await c.db.query<BranchRow>(
          'SELECT * FROM b2b_branch WHERE organization_id=$1 ORDER BY name,id',
          [c.org.id],
        )
      ).rows.map(branchDTO),
    };
  }
  async createBranch(c: Context, input: BranchInput) {
    admin(c);
    const id = randomUUID();
    const row = (
      await c.db.query<BranchRow>(
        `INSERT INTO b2b_branch(id,organization_id,slug,name,address,contact,timezone,opening_hours,status,public,draft)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active',false,$9) RETURNING *`,
        [
          id,
          c.org.id,
          input.slug,
          input.name,
          input.address ?? '',
          input.contact ?? '',
          input.timezone ?? 'UTC',
          JSON.stringify(input.openingHours ?? []),
          WebsiteInputSchema.parse({}),
        ],
      )
    ).rows[0];
    await audit(c, 'branch.create', id);
    return { branch: branchDTO(row) };
  }
  async updateBranch(c: Context, id: string, input: BranchInput, revision: number) {
    admin(c);
    if (input.status === 'archived') {
      const active = await c.db.query(
        'SELECT 1 FROM b2b_program_assignment WHERE organization_id=$1 AND branch_id=$2 AND active LIMIT 1',
        [c.org.id, id],
      );
      if (active.rowCount)
        throw new HttpError(
          409,
          'ACTIVE_ASSIGNMENTS',
          'Retirá explícitamente las asignaciones activas antes de archivar esta sede.',
        );
    }
    const row = (
      await c.db.query<BranchRow>(
        `UPDATE b2b_branch SET slug=$3,name=$4,address=$5,contact=$6,timezone=$7,opening_hours=$8,status=$9,public=$10,revision=revision+1
       WHERE organization_id=$1 AND id=$2 AND revision=$11 RETURNING *`,
        [
          c.org.id,
          id,
          input.slug,
          input.name,
          input.address ?? '',
          input.contact ?? '',
          input.timezone ?? 'UTC',
          JSON.stringify(input.openingHours ?? []),
          input.status ?? 'active',
          input.public ?? false,
          revision,
        ],
      )
    ).rows[0];
    if (!row) throw conflict();
    await audit(c, 'branch.update', id);
    return { branch: branchDTO(row) };
  }
  async grants(c: Context) {
    admin(c);
    const rows = await c.db.query<{
      organization_id: string;
      branch_id: string;
      user_id: string;
      role: string;
      active: boolean;
    }>('SELECT * FROM b2b_branch_grant WHERE organization_id=$1 ORDER BY branch_id,user_id,role', [
      c.org.id,
    ]);
    return {
      grants: rows.rows.map((r) => ({
        organizationId: r.organization_id,
        branchId: r.branch_id,
        userId: r.user_id,
        role: r.role,
        active: r.active,
      })),
    };
  }
  async grant(c: Context, input: BranchGrantInput) {
    admin(c);
    const valid = await c.db.query(
      `SELECT 1 FROM b2b_branch b JOIN b2b_membership m ON m.organization_id=b.organization_id
       WHERE b.organization_id=$1 AND b.id=$2 AND b.status='active' AND m.user_id=$3 AND m.active`,
      [c.org.id, input.branchId, input.userId],
    );
    if (!valid.rowCount) throw missing();
    if (
      !input.active &&
      input.role === 'member' &&
      (
        await c.db.query(
          'SELECT 1 FROM b2b_program_assignment WHERE organization_id=$1 AND branch_id=$2 AND member_id=$3 AND active LIMIT 1',
          [c.org.id, input.branchId, input.userId],
        )
      ).rowCount
    )
      throw new HttpError(
        409,
        'ACTIVE_ASSIGNMENTS',
        'Retirá las asignaciones activas antes de retirar el acceso del socio.',
      );
    await c.db.query(
      `INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role,active) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(organization_id,branch_id,user_id,role) DO UPDATE SET active=EXCLUDED.active`,
      [c.org.id, input.branchId, input.userId, input.role, input.active],
    );
    if (!input.active)
      await c.db.query(
        'DELETE FROM b2b_coach_assignment WHERE organization_id=$1 AND branch_id=$2 AND (coach_id=$3 OR member_id=$3)',
        [c.org.id, input.branchId, input.userId],
      );
    await audit(c, 'branch.grant', `${input.branchId}:${input.userId}:${input.role}`);
    return { ok: true as const };
  }
  async retireAssignment(c: Context, id: string) {
    admin(c);
    if (
      !(
        await c.db.query(
          'UPDATE b2b_program_assignment SET active=false WHERE organization_id=$1 AND id=$2 AND branch_id=$3 RETURNING id',
          [c.org.id, id, c.branchId],
        )
      ).rowCount
    )
      throw missing();
    await audit(c, 'assignment.retire', id);
    return { ok: true as const };
  }
  async transferUnit(c: Context, id: string, targetBranchId: string, revision: number) {
    admin(c);
    if (!c.branchId || c.branchId === targetBranchId) throw denied();
    const target = await c.db.query(
      "SELECT 1 FROM b2b_branch WHERE organization_id=$1 AND id=$2 AND status='active'",
      [c.org.id, targetBranchId],
    );
    const unit = (
      await c.db.query<{ machine_id: string; revision: number }>(
        'SELECT machine_id,revision FROM b2b_unit WHERE organization_id=$1 AND branch_id=$2 AND id=$3 FOR UPDATE',
        [c.org.id, c.branchId, id],
      )
    ).rows[0];
    if (!target.rowCount || !unit) throw missing();
    if (unit.revision !== revision) throw conflict();
    // Conservatively require an explicit resolution of all active prescriptions in the source.
    if (
      (
        await c.db.query(
          'SELECT 1 FROM b2b_program_assignment WHERE organization_id=$1 AND branch_id=$2 AND active LIMIT 1',
          [c.org.id, c.branchId],
        )
      ).rowCount
    )
      throw new HttpError(
        409,
        'ACTIVE_ASSIGNMENTS',
        'Retirá las asignaciones activas de origen antes de trasladar el equipo.',
      );
    await c.db.query(
      'UPDATE b2b_unit SET branch_id=$3,public=false,revision=revision+1 WHERE organization_id=$1 AND id=$2',
      [c.org.id, id, targetBranchId],
    );
    await audit(c, 'unit.transfer', id);
    return { ok: true as const };
  }
  async theme(c: Context): Promise<ThemeState> {
    admin(c);
    const row = (
      await c.db.query<{
        draft: Theme;
        published: Theme;
        revision: number;
        published_version: number;
      }>('SELECT * FROM b2b_theme WHERE organization_id=$1', [c.org.id])
    ).rows[0];
    if (!row) throw missing();
    return {
      draft: ThemeInputSchema.parse(row.draft),
      published: ThemeInputSchema.parse(row.published),
      revision: row.revision,
      publishedVersion: row.published_version,
    };
  }
  async updateTheme(c: Context, theme: Theme, revision: number) {
    admin(c);
    if (!accessibleTheme(theme))
      throw new HttpError(
        400,
        'THEME_CONTRAST',
        'La paleta necesita contraste legible entre texto y fondos.',
      );
    if (
      !(
        await c.db.query(
          'UPDATE b2b_theme SET draft=$2,revision=revision+1 WHERE organization_id=$1 AND revision=$3 RETURNING organization_id',
          [c.org.id, theme, revision],
        )
      ).rowCount
    )
      throw conflict();
    await audit(c, 'theme.update', c.org.id);
    return { theme: await this.theme(c) };
  }
  async publishTheme(c: Context, revision: number, restoreVersion?: number) {
    const theme = await this.theme(c);
    if (theme.revision !== revision) throw conflict();
    let data = theme.draft;
    if (restoreVersion !== undefined) {
      const row = (
        await c.db.query<{ data: Theme }>(
          'SELECT data FROM b2b_theme_version WHERE organization_id=$1 AND version=$2',
          [c.org.id, restoreVersion],
        )
      ).rows[0];
      if (!row) throw missing();
      data = ThemeInputSchema.parse(row.data);
    }
    if (!accessibleTheme(data))
      throw new HttpError(400, 'THEME_CONTRAST', 'La paleta necesita contraste legible.');
    const version = theme.publishedVersion + 1;
    await c.db.query(
      'INSERT INTO b2b_theme_version(organization_id,version,data,actor_id) VALUES($1,$2,$3,$4)',
      [c.org.id, version, data, c.actorId],
    );
    await c.db.query(
      'UPDATE b2b_theme SET published=$2,published_version=$3,revision=revision+1 WHERE organization_id=$1',
      [c.org.id, data, version],
    );
    await audit(
      c,
      restoreVersion === undefined ? 'theme.publish' : 'theme.restore',
      String(version),
    );
    return { theme: await this.theme(c) };
  }
  async themeVersions(c: Context) {
    admin(c);
    const rows = await c.db.query<{ version: number; data: Theme; created_at: Date }>(
      'SELECT version,data,created_at FROM b2b_theme_version WHERE organization_id=$1 ORDER BY version DESC',
      [c.org.id],
    );
    return {
      versions: rows.rows.map((r) => ({
        version: r.version,
        data: ThemeInputSchema.parse(r.data),
        createdAt: r.created_at.toISOString(),
      })),
    };
  }
  async modules(c: Context) {
    const configuration = await c.db.query<{
      module: ModuleId;
      platform_enabled: boolean;
      brand_enabled: boolean;
    }>('SELECT * FROM b2b_module_configuration WHERE organization_id=$1', [c.org.id]);
    return {
      modules: await readModules(c.db, c.org.id, c.branchId),
      configuration: configuration.rows.map((r) => ({
        module: r.module,
        platformEnabled: r.platform_enabled,
        brandEnabled: r.brand_enabled,
      })),
    };
  }
  async setModule(c: Context, module: ModuleId, enabled: boolean, brand = false) {
    admin(c);
    if (!MODULE_IDS.includes(module)) throw missing();
    if (brand)
      await c.db.query(
        'UPDATE b2b_module_configuration SET brand_enabled=$3 WHERE organization_id=$1 AND module=$2',
        [c.org.id, module, enabled],
      );
    else {
      if (!c.branchId) throw denied();
      await c.db.query(
        'INSERT INTO b2b_branch_module(organization_id,branch_id,module,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,branch_id,module) DO UPDATE SET enabled=EXCLUDED.enabled',
        [c.org.id, c.branchId, module, enabled],
      );
    }
    await audit(c, 'module.update', `${brand ? 'brand' : c.branchId}:${module}`);
    return this.modules(c);
  }
  async requireModule(c: Context, module: ModuleId) {
    if (c.domain && !(await readModules(c.db, c.org.id, c.branchId))[module])
      throw new HttpError(
        403,
        'MODULE_DISABLED',
        'Esta función no está habilitada en este contexto.',
      );
  }
  async catalog(c: Context) {
    admin(c);
    const rows = await c.db.query<{ kind: string; resource_id: string; enabled: boolean }>(
      'SELECT kind,resource_id,enabled FROM b2b_branch_catalog WHERE organization_id=$1 AND branch_id=$2',
      [c.org.id, c.branchId],
    );
    return {
      availability: rows.rows.map((r) => ({
        kind: r.kind,
        resourceId: r.resource_id,
        enabled: r.enabled,
      })),
    };
  }
  async setCatalog(
    c: Context,
    input: { kind: 'machine' | 'exercise'; resourceId: string; enabled: boolean },
  ) {
    admin(c);
    if (!c.branchId) throw denied();
    const table = input.kind === 'machine' ? 'b2b_machine' : 'b2b_exercise';
    if (
      !(
        await c.db.query(
          `SELECT 1 FROM ${table} WHERE id=$1 AND (organization_id IS NULL OR organization_id=$2)`,
          [input.resourceId, c.org.id],
        )
      ).rowCount
    )
      throw missing();
    await c.db.query(
      'INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,branch_id,kind,resource_id) DO UPDATE SET enabled=EXCLUDED.enabled',
      [c.org.id, c.branchId, input.kind, input.resourceId, input.enabled],
    );
    await audit(c, 'catalog.availability', input.resourceId);
    return { ok: true as const };
  }
}
