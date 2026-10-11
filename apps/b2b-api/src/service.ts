import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import {
  BrandInputSchema,
  WebsiteInputSchema,
  type Organization,
  type Membership,
  type Me,
  type Member,
  type Role,
  type Brand,
  type PublicSite,
  type PublicUnit,
  type Asset,
  type Media,
  type Website,
  type WebsiteInput,
  type SetupProgress,
  type Theme,
} from '@klisteniapp/b2b-contracts';
import type { Auth } from './auth.ts';
import type { Config } from './config.ts';
import { conflict, denied, HttpError, missing } from './errors.ts';
import { admin, audit, staff, type Context, type OrgRow } from './organization-context.ts';
import { CatalogModule } from './catalog/index.ts';
import { EquipmentModule } from './equipment/index.ts';
import { supportsMachine } from '@klisteniapp/b2b-domain/catalog';
import { TrainingModule } from './training/index.ts';
import type { StoredMedia } from './media.ts';
import {
  authorizeWorkContext,
  requireActiveDomain,
  requireBrandSession,
  type WorkContext,
} from './white-label-access.ts';
import type { DomainContext } from './domain-context.ts';
import { WhiteLabelService, readModules } from './white-label-service.ts';

export type MediaRow = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  kind: Asset['kind'];
  label: string;
  attribution: string;
  relative_path: string;
  mime: string;
  bytes: string | number;
  sha256: string;
  created_at: Date;
};
const mediaDTO = (r: MediaRow): Media => ({
  id: r.id,
  kind: r.kind,
  label: r.label,
  attribution: r.attribution,
  url: `/api/b2b/media/${r.id}`,
  mime: r.mime,
  bytes: Number(r.bytes),
  sha256: r.sha256,
  createdAt: r.created_at.toISOString(),
});
function referencesMedia(value: unknown, url: string): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => referencesMedia(item, url));
  const record = value as Record<string, unknown>;
  return (
    record.url === url ||
    record.logoUrl === url ||
    Object.values(record).some((item) => referencesMedia(item, url))
  );
}
type WebsiteRow = {
  draft: WebsiteInput;
  revision: number;
  published: { content: WebsiteInput; brand: Brand } | null;
  published_revision: number | null;
  published_at: Date | null;
};
const websiteDTO = (r: WebsiteRow): Website => ({
  draft: WebsiteInputSchema.parse(r.draft),
  revision: r.revision,
  publishedRevision: r.published_revision,
  publishedAt: r.published_at?.toISOString() ?? null,
});
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const organizationDTO = (r: OrgRow): Organization => ({
  id: r.id,
  slug: r.slug,
  brand: r.brand,
  serviceActive: r.service_enabled && (!r.service_ends_at || r.service_ends_at > new Date()),
  serviceEndsAt: r.service_ends_at?.toISOString() ?? null,
});

export async function createUser(
  db: PoolClient,
  auth: Auth,
  input: { email: string; name: string; password: string },
) {
  const password = await (await auth.$context).password.hash(input.password);
  const id = randomUUID();
  await db.query(
    `INSERT INTO b2b_auth_user (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,true,now(),now())`,
    [id, input.name, input.email.toLowerCase()],
  );
  await db.query(
    `INSERT INTO b2b_auth_account (id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES ($1,$2,$2,'credential',$3,now(),now())`,
    [randomUUID(), id, password],
  );
  return { id, name: input.name, email: input.email.toLowerCase() };
}

export class B2BService {
  readonly pool: Pool;
  readonly auth: Auth;
  readonly config: Config;
  readonly catalog: CatalogModule;
  readonly equipment: EquipmentModule;
  readonly training: TrainingModule;
  readonly whiteLabel: WhiteLabelService;
  constructor(pool: Pool, auth: Auth, config: Config) {
    this.pool = pool;
    this.auth = auth;
    this.config = config;
    this.whiteLabel = new WhiteLabelService(pool);
    const validateAssets = (context: Context, assets: Asset[]) =>
      this.validateAssets(context, assets);
    this.catalog = new CatalogModule(validateAssets);
    this.equipment = new EquipmentModule(this.catalog, validateAssets);
    this.training = new TrainingModule({
      catalog: this.catalog,
      equipment: this.equipment,
      memberAccess: (context, memberId) => this.memberAccess(context, memberId),
      members: (context) => this.members(context),
    });
  }
  async transaction<T>(operation: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const result = await operation(db);
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      db.release();
    }
  }
  async requireSession(db: PoolClient, actorId: string, sessionId: string) {
    const current = await db.query(
      'SELECT id FROM b2b_auth_session WHERE id=$1 AND "userId"=$2 AND "expiresAt">clock_timestamp() FOR SHARE',
      [sessionId, actorId],
    );
    if (!current.rowCount)
      throw new HttpError(
        401,
        'UNAUTHENTICATED',
        'Tu sesión finalizó. Iniciá sesión para continuar.',
      );
  }
  async organization<T>(
    actorId: string,
    orgId: string,
    sessionId: string,
    write: boolean,
    operation: (context: Context) => Promise<T>,
    work: WorkContext = {},
  ): Promise<T> {
    if (this.config.whiteLabel && !work.domain)
      throw new HttpError(403, 'BRAND_CONTEXT_REQUIRED', 'El dominio de la marca es obligatorio.');
    return this.transaction(async (db) => {
      if (work.domain && work.domain.organizationId !== orgId) throw missing();
      // Every B2B mutation takes this lock before checking membership/contract.
      // Revocation and writes cannot race past one another across API instances.
      const found = await db.query<OrgRow>(
        `SELECT * FROM b2b_organization WHERE id=$1 ${write ? 'FOR UPDATE' : 'FOR SHARE'}`,
        [orgId],
      );
      const org = found.rows[0];
      if (!org) throw missing();
      // Session deletion (logout/reset) and protected transactions are ordered:
      // a queued request cannot outlive a session revoked while it waited.
      await this.requireSession(db, actorId, sessionId);
      if (work.domain) await requireBrandSession(db, actorId, sessionId, work.domain);
      const membership = await db.query<{ role: Role }>(
        'SELECT role FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 AND active',
        [orgId, actorId],
      );
      if (!membership.rows[0]) {
        if (work.domain)
          throw new HttpError(403, 'MEMBERSHIP_REQUIRED', 'Tu acceso a esta marca cambió.');
        throw denied();
      }
      if (write && !organizationDTO(org).serviceActive)
        throw new HttpError(
          402,
          'GYM_SERVICE_INACTIVE',
          'El servicio del gimnasio está suspendido. Tus datos guardados siguen disponibles.',
        );
      const scope = await authorizeWorkContext(
        db,
        actorId,
        orgId,
        membership.rows[0].role,
        write,
        work,
      );
      return operation({ db, actorId, org, ...scope });
    });
  }
  staff(c: Context) {
    staff(c);
  }
  admin(c: Context) {
    admin(c);
  }
  audit(c: Context, action: string, resourceId: string) {
    return audit(c, action, resourceId);
  }
  async memberAccess(c: Context, memberId: string): Promise<void> {
    const member = await c.db.query(
      `SELECT m.role FROM b2b_membership m WHERE organization_id=$1 AND user_id=$2 AND active
       AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM b2b_branch_grant g WHERE g.organization_id=m.organization_id AND g.user_id=m.user_id AND g.branch_id=$3 AND g.role='member' AND g.active))`,
      [c.org.id, memberId, c.branchId ?? null],
    );
    if (!member.rows[0] || (!c.branchId && member.rows[0].role !== 'member')) throw missing();
    if (c.role === 'admin' || (c.role === 'member' && c.actorId === memberId)) return;
    if (
      c.role === 'coach' &&
      (
        await c.db.query(
          'SELECT 1 FROM b2b_coach_assignment WHERE organization_id=$1 AND coach_id=$2 AND member_id=$3 AND ($4::text IS NULL OR branch_id=$4)',
          [c.org.id, c.actorId, memberId, c.branchId ?? null],
        )
      ).rowCount
    )
      return;
    throw denied();
  }
  async me(user: Me['user'], domain?: DomainContext | null): Promise<Me> {
    const found = await this.pool.query<OrgRow & { role: Role }>(
      'SELECT o.*,m.role FROM b2b_membership m JOIN b2b_organization o ON o.id=m.organization_id WHERE m.user_id=$1 AND m.active AND ($2::text IS NULL OR o.id=$2) ORDER BY o.slug',
      [user.id, domain?.organizationId ?? null],
    );
    return {
      user,
      ...(domain
        ? {
            whiteLabel: await this.whiteLabel.access(
              domain.organizationId,
              user.id,
              found.rows[0]?.role === 'admin',
            ),
          }
        : {}),
      memberships: found.rows.map(
        (r): Membership => ({ organization: organizationDTO(r), role: r.role }),
      ),
    };
  }
  async members(c: Context): Promise<Member[]> {
    if (c.branchId) {
      const found = await c.db.query<{
        user_id: string;
        name: string;
        email: string;
        role: Role;
        active: boolean;
        coach_ids: string[];
      }>(
        `SELECT g.user_id,u.name,u.email,g.role,(g.active AND m.active) active,
         ARRAY(SELECT ca.coach_id FROM b2b_coach_assignment ca WHERE ca.organization_id=g.organization_id AND ca.branch_id=g.branch_id AND ca.member_id=g.user_id) coach_ids
         FROM b2b_branch_grant g JOIN b2b_membership m ON m.organization_id=g.organization_id AND m.user_id=g.user_id
         JOIN b2b_auth_user u ON u.id=g.user_id WHERE g.organization_id=$1 AND g.branch_id=$4
         AND ($3='admin' OR g.user_id=$2 OR ($3='coach' AND g.role='member' AND g.active AND m.active AND EXISTS(
           SELECT 1 FROM b2b_coach_assignment ca WHERE ca.organization_id=g.organization_id AND ca.branch_id=g.branch_id AND ca.member_id=g.user_id AND ca.coach_id=$2))) ORDER BY u.name,g.role`,
        [c.org.id, c.actorId, c.role, c.branchId],
      );
      return found.rows.map((r) => ({
        userId: r.user_id,
        name: r.name,
        email: r.email,
        role: r.role,
        active: r.active,
        coachIds: r.coach_ids,
      }));
    }
    const found = await c.db.query<{
      user_id: string;
      name: string;
      email: string;
      role: Role;
      active: boolean;
      coach_ids: string[];
    }>(
      `SELECT m.user_id,u.name,u.email,m.role,m.active,
      ARRAY(SELECT coach_id FROM b2b_coach_assignment a WHERE a.organization_id=m.organization_id AND a.member_id=m.user_id) coach_ids
      FROM b2b_membership m JOIN b2b_auth_user u ON u.id=m.user_id WHERE m.organization_id=$1
      AND ($3='admin' OR m.user_id=$2 OR ($3='coach' AND m.active AND EXISTS(SELECT 1 FROM b2b_coach_assignment a WHERE a.organization_id=m.organization_id AND a.member_id=m.user_id AND a.coach_id=$2))) ORDER BY u.name`,
      [c.org.id, c.actorId, c.role],
    );
    return found.rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      email: r.email,
      role: r.role,
      active: r.active,
      coachIds: r.coach_ids,
    }));
  }
  async updateMembership(c: Context, userId: string, input: { role?: Role; active?: boolean }) {
    this.admin(c);
    const found = await c.db.query<{ role: Role; active: boolean }>(
      'SELECT role,active FROM b2b_membership WHERE organization_id=$1 AND user_id=$2',
      [c.org.id, userId],
    );
    const previous = found.rows[0];
    if (!previous) throw missing();
    const role = input.role ?? previous.role,
      active = input.active ?? previous.active;
    if (previous.role === 'admin' && previous.active && (role !== 'admin' || !active)) {
      const count = await c.db.query(
        "SELECT 1 FROM b2b_membership WHERE organization_id=$1 AND role='admin' AND active",
        [c.org.id],
      );
      if (count.rowCount === 1)
        throw new HttpError(
          409,
          'LAST_ADMIN',
          'El gimnasio debe conservar un administrador activo.',
        );
    }
    await c.db.query(
      'UPDATE b2b_membership SET role=$3,active=$4 WHERE organization_id=$1 AND user_id=$2',
      [c.org.id, userId, role, active],
    );
    if (role !== previous.role || !active)
      await c.db.query(
        'DELETE FROM b2b_coach_assignment WHERE organization_id=$1 AND (coach_id=$2 OR member_id=$2)',
        [c.org.id, userId],
      );
    await this.audit(c, 'membership.update', userId);
    return { ok: true };
  }
  async assignCoach(c: Context, input: { coachId: string; memberId: string }) {
    this.admin(c);
    if (c.branchId) {
      const rows = await c.db.query<{ user_id: string; role: Role }>(
        `SELECT g.user_id,g.role FROM b2b_branch_grant g JOIN b2b_membership m ON m.organization_id=g.organization_id AND m.user_id=g.user_id AND m.active
        WHERE g.organization_id=$1 AND g.branch_id=$2 AND g.active AND g.user_id=ANY($3::text[])`,
        [c.org.id, c.branchId, [input.coachId, input.memberId]],
      );
      if (
        !rows.rows.some((r) => r.user_id === input.coachId && r.role === 'coach') ||
        !rows.rows.some((r) => r.user_id === input.memberId && r.role === 'member')
      )
        throw missing();
      await c.db.query(
        'INSERT INTO b2b_coach_assignment(organization_id,branch_id,coach_id,member_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [c.org.id, c.branchId, input.coachId, input.memberId],
      );
      await this.audit(c, 'coach.assign', input.memberId);
      return { ok: true };
    }
    const rows = await c.db.query<{ user_id: string; role: Role }>(
      'SELECT user_id,role FROM b2b_membership WHERE organization_id=$1 AND active AND user_id=ANY($2::text[])',
      [c.org.id, [input.coachId, input.memberId]],
    );
    if (
      !rows.rows.some((r) => r.user_id === input.coachId && r.role === 'coach') ||
      !rows.rows.some((r) => r.user_id === input.memberId && r.role === 'member')
    )
      throw missing();
    await c.db.query(
      'INSERT INTO b2b_coach_assignment(organization_id,coach_id,member_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [c.org.id, input.coachId, input.memberId],
    );
    await this.audit(c, 'coach.assign', input.memberId);
    return { ok: true };
  }
  async brand(c: Context, input: Brand) {
    this.admin(c);
    await this.validateLogo(c, input.logoUrl);
    await c.db.query('UPDATE b2b_organization SET brand=$2 WHERE id=$1', [c.org.id, input]);
    await c.db.query('UPDATE b2b_website SET revision=revision+1 WHERE organization_id=$1', [
      c.org.id,
    ]);
    await this.audit(c, 'brand.update', c.org.id);
    return organizationDTO({ ...c.org, brand: input });
  }
  async invite(c: Context, input: { email: string; name: string; role: Role }) {
    this.admin(c);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const id = randomUUID();
    await c.db.query(
      'INSERT INTO b2b_invitation(id,organization_id,email,name,role,token_hash,expires_at,created_by,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id,
        c.org.id,
        input.email,
        input.name,
        input.role,
        hashToken(token),
        expiresAt,
        c.actorId,
        input.role === 'admin' ? null : (c.branchId ?? null),
      ],
    );
    await this.audit(c, 'invitation.create', id);
    return {
      url: c.domain
        ? `${c.domain.canonicalOrigin}/app/invite#token=${encodeURIComponent(token)}`
        : `${this.config.origin}/app/invite?token=${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString(),
    };
  }
  async acceptInvitation(
    token: string,
    input?: { name: string; password: string },
    existingSession?: { userId: string; sessionId: string },
    domain?: DomainContext | null,
  ) {
    return this.transaction(async (db) => {
      const first = await db.query<{ organization_id: string }>(
        'SELECT organization_id FROM b2b_invitation WHERE token_hash=$1',
        [hashToken(token)],
      );
      if (!first.rows[0] || (domain && first.rows[0].organization_id !== domain.organizationId))
        throw new HttpError(400, 'INVALID_INVITATION', 'Invitación inválida o vencida.');
      const org = (
        await db.query<OrgRow>('SELECT * FROM b2b_organization WHERE id=$1 FOR UPDATE', [
          first.rows[0].organization_id,
        ])
      ).rows[0];
      if (domain) await requireActiveDomain(db, domain);
      if (existingSession)
        await this.requireSession(db, existingSession.userId, existingSession.sessionId);
      if (!organizationDTO(org).serviceActive)
        throw new HttpError(
          402,
          'GYM_SERVICE_INACTIVE',
          'El servicio del gimnasio está suspendido.',
        );
      const found = await db.query<{
        id: string;
        email: string;
        role: Role;
        branch_id: string | null;
      }>(
        'SELECT id,email,role,branch_id FROM b2b_invitation WHERE token_hash=$1 AND used_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE',
        [hashToken(token)],
      );
      const invitation = found.rows[0];
      if (!invitation)
        throw new HttpError(400, 'INVALID_INVITATION', 'Invitación inválida o vencida.');
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `b2b:email:${invitation.email}`,
      ]);
      const existing = (
        await db.query<{ id: string }>('SELECT id FROM b2b_auth_user WHERE email=$1', [
          invitation.email,
        ])
      ).rows[0];
      let userId: string;
      if (existing) {
        if (existingSession?.userId !== existing.id)
          throw new HttpError(
            409,
            'EXISTING_ACCOUNT',
            'Ya existe tu cuenta B2B. Iniciá sesión para aceptar sin cambiar tu contraseña.',
          );
        userId = existing.id;
      } else {
        if (!input || existingSession)
          throw new HttpError(
            400,
            'NEW_ACCOUNT_REQUIRED',
            'Completá la activación de la cuenta invitada.',
          );
        userId = (await createUser(db, this.auth, { ...input, email: invitation.email })).id;
      }
      // Invitations never silently promote an existing membership or reactivate it.
      if (
        (
          await db.query('SELECT 1 FROM b2b_membership WHERE organization_id=$1 AND user_id=$2', [
            org.id,
            userId,
          ])
        ).rowCount
      )
        throw new HttpError(
          409,
          'MEMBERSHIP_EXISTS',
          'Ya pertenecés a este gimnasio. Un administrador puede gestionar tu acceso.',
        );
      if (domain) await db.query("SELECT set_config('b2b.explicit_branch_scope','on',true)");
      if (
        invitation.branch_id &&
        !(
          await db.query(
            "SELECT 1 FROM b2b_branch WHERE organization_id=$1 AND id=$2 AND status='active'",
            [org.id, invitation.branch_id],
          )
        ).rowCount
      )
        throw missing();
      await db.query('INSERT INTO b2b_membership(organization_id,user_id,role) VALUES($1,$2,$3)', [
        org.id,
        userId,
        invitation.role,
      ]);
      if (domain && invitation.branch_id && invitation.role !== 'admin')
        await db.query(
          'INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role,active) VALUES($1,$2,$3,$4,true) ON CONFLICT DO NOTHING',
          [org.id, invitation.branch_id, userId, invitation.role],
        );
      await db.query('UPDATE b2b_invitation SET used_at=now() WHERE id=$1', [invitation.id]);
      return { ok: true };
    });
  }
  async validateAssets(c: Context, assets: Asset[]) {
    for (const asset of assets) await this.validateMediaUrl(c, asset.url, asset.kind, asset.id);
  }
  async validateLogo(c: Context, url: string) {
    if (url) await this.validateMediaUrl(c, url, 'image');
  }
  async validateMediaUrl(c: Context, url: string, kind: Asset['kind'], assetId?: string) {
    const origin = c.domain?.origin ?? this.config.origin;
    const parsed = new URL(url, origin);
    let normalizedPath: string;
    try {
      normalizedPath = new URL(decodeURIComponent(parsed.pathname), origin).pathname;
    } catch {
      throw new HttpError(400, 'INVALID_MEDIA_REFERENCE', 'La ruta del medio no es válida.');
    }
    if (parsed.origin !== origin) {
      if (/^\/api\/b2b\/media(?:\/|$)/.test(normalizedPath))
        throw new HttpError(400, 'INVALID_MEDIA_REFERENCE', 'Usá la URL local original del medio.');
      return;
    }
    let path: string;
    try {
      path = new URL(decodeURIComponent(parsed.pathname), this.config.origin).pathname;
    } catch {
      throw new HttpError(400, 'INVALID_MEDIA_REFERENCE', 'La ruta del medio no es válida.');
    }
    const media = /^\/api\/b2b\/media\/([a-zA-Z0-9_-]+)$/.exec(path);
    if (!media) {
      if (!/^\/(?:models|previews)\/[a-zA-Z0-9_./-]+$/.test(path))
        throw new HttpError(
          400,
          'INVALID_MEDIA_REFERENCE',
          'Seleccioná un medio cargado o un recurso de la biblioteca.',
        );
      return;
    }
    // Canonical URLs keep ownership checks and public-reference checks identical.
    if (url !== `/api/b2b/media/${media[1]}` || (assetId && assetId !== media[1]))
      throw new HttpError(
        400,
        'INVALID_MEDIA_REFERENCE',
        'Usá la URL e identificador originales del medio cargado.',
      );
    if (
      !(
        await c.db.query(
          'SELECT 1 FROM b2b_media WHERE id=$1 AND organization_id=$2 AND kind=$3 AND ($4::text IS NULL OR branch_id IS NULL OR branch_id=$4)',
          [media[1], c.org.id, kind, c.branchId ?? null],
        )
      ).rowCount
    )
      throw new HttpError(
        400,
        'INVALID_MEDIA_REFERENCE',
        'El medio no pertenece a este gimnasio o su tipo no coincide.',
      );
  }
  async media(c: Context, brandOnly = false) {
    this.staff(c);
    const rows = (
      await c.db.query<MediaRow>(
        'SELECT * FROM b2b_media WHERE organization_id=$1 AND ($2::text IS NULL OR branch_id IS NULL OR branch_id=$2) AND (NOT $3::boolean OR branch_id IS NULL) ORDER BY created_at DESC,id',
        [c.org.id, c.branchId ?? null, brandOnly],
      )
    ).rows;
    return {
      media: rows.map(mediaDTO),
      usage: {
        bytes: rows.reduce((sum, r) => sum + Number(r.bytes), 0),
        quotaBytes: (this.config.mediaQuotaMb ?? 256) * 1024 ** 2,
      },
    };
  }
  async uploadAllowance(c: Context, bytes: number) {
    this.staff(c);
    const usage = await c.db.query<{ bytes: string }>(
      'SELECT coalesce(sum(bytes),0) bytes FROM b2b_media WHERE organization_id=$1',
      [c.org.id],
    );
    if (Number(usage.rows[0].bytes) + bytes > (this.config.mediaQuotaMb ?? 256) * 1024 ** 2)
      throw new HttpError(
        413,
        'MEDIA_QUOTA',
        'El gimnasio alcanzó su espacio disponible para medios.',
      );
  }
  async saveMedia(
    c: Context,
    stored: StoredMedia,
    metadata: { kind: Asset['kind']; label: string; attribution: string },
  ): Promise<Media> {
    await this.uploadAllowance(c, stored.bytes);
    const row = (
      await c.db.query<MediaRow>(
        'INSERT INTO b2b_media(id,organization_id,created_by,kind,label,attribution,relative_path,mime,bytes,sha256,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
        [
          stored.id,
          c.org.id,
          c.actorId,
          metadata.kind,
          metadata.label,
          metadata.attribution,
          stored.relativePath,
          stored.mime,
          stored.bytes,
          stored.sha256,
          c.branchId ?? null,
        ],
      )
    ).rows[0];
    await this.audit(c, 'media.create', row.id);
    return mediaDTO(row);
  }
  async mediaAccess(
    id: string,
    identity?: { userId: string; sessionId: string },
    work: WorkContext = {},
  ): Promise<MediaRow> {
    const row = (await this.pool.query<MediaRow>('SELECT * FROM b2b_media WHERE id=$1', [id]))
      .rows[0];
    if (!row) throw missing();
    if (work.domain) {
      const domain = work.domain;
      if (row.organization_id !== domain.organizationId) throw missing();
      const url = `/api/b2b/media/${id}`;
      const publicContext = await this.whiteLabel.context(domain);
      if (referencesMedia(publicContext.theme, url)) return row;
      for (const branch of publicContext.branches) {
        try {
          if (
            referencesMedia(
              await this.publicSite(
                publicContext.organization.slug,
                undefined,
                domain,
                branch.slug,
              ),
              url,
            )
          )
            return row;
        } catch (error) {
          if (!(error instanceof HttpError) || error.status !== 404) throw error;
        }
      }
      if (!identity) throw missing();
      return this.transaction(async (db) => {
        const org = (
          await db.query<OrgRow>('SELECT * FROM b2b_organization WHERE id=$1 FOR SHARE', [
            domain.organizationId,
          ])
        ).rows[0];
        await this.requireSession(db, identity.userId, identity.sessionId);
        await requireBrandSession(db, identity.userId, identity.sessionId, domain);
        const membership = (
          await db.query<{ role: Role }>(
            'SELECT role FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 AND active',
            [domain.organizationId, identity.userId],
          )
        ).rows[0];
        if (membership?.role === 'admin') return row;
        const staff = (
          await db.query(
            `SELECT 1 FROM b2b_branch_grant g JOIN b2b_branch b ON b.organization_id=g.organization_id AND b.id=g.branch_id
          WHERE g.organization_id=$1 AND g.user_id=$2 AND g.role='coach' AND g.active AND b.status='active' AND ($3::text IS NULL OR g.branch_id=$3) LIMIT 1`,
            [domain.organizationId, identity.userId, row.branch_id],
          )
        ).rowCount;
        if (staff) return row;
        // Images fetched by the browser do not carry a selected branch header.
        // Derive all currently authorized branches in the server, then require
        // an actual visible reference rather than treating a shared ID as access.
        const grants = await db.query<{ branch_id: string }>(
          `SELECT DISTINCT g.branch_id FROM b2b_branch_grant g
           JOIN b2b_branch b ON b.organization_id=g.organization_id AND b.id=g.branch_id
           WHERE g.organization_id=$1 AND g.user_id=$2 AND g.active AND b.status='active'`,
          [domain.organizationId, identity.userId],
        );
        for (const { branch_id: branchId } of grants.rows) {
          const context: Context = {
            db,
            actorId: identity.userId,
            org,
            role: 'member',
            branchId,
            domain,
          };
          if (
            referencesMedia(await this.exercises(context), url) ||
            referencesMedia(await this.machines(context), url) ||
            referencesMedia(await this.units(context), url)
          )
            return row;
        }
        const snapshots = await db.query<{ snapshot: unknown }>(
          `SELECT v.snapshot FROM b2b_program_assignment a JOIN b2b_program_version v ON v.organization_id=a.organization_id AND v.program_id=a.program_id AND v.version=a.version
          WHERE a.organization_id=$1 AND a.member_id=$2 AND (EXISTS(SELECT 1 FROM b2b_execution e WHERE e.organization_id=a.organization_id AND e.assignment_id=a.id AND e.member_id=$2)
          OR (a.active AND EXISTS(SELECT 1 FROM b2b_branch_grant g JOIN b2b_branch b ON b.id=g.branch_id AND b.organization_id=g.organization_id WHERE g.organization_id=a.organization_id AND g.branch_id=a.branch_id AND g.user_id=$2 AND g.role='member' AND g.active AND b.status='active')))`,
          [domain.organizationId, identity.userId],
        );
        if (snapshots.rows.some((r) => referencesMedia(r.snapshot, url))) return row;
        throw missing();
      });
    }
    const org = (
      await this.pool.query<{ slug: string }>('SELECT slug FROM b2b_organization WHERE id=$1', [
        row.organization_id,
      ])
    ).rows[0];
    const url = `/api/b2b/media/${id}`;
    try {
      if (referencesMedia(await this.publicSite(org.slug), url)) return row;
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 404) throw error;
    }
    if (!identity) throw missing();
    try {
      return await this.organization(
        identity.userId,
        row.organization_id,
        identity.sessionId,
        false,
        async (c) => {
          if (c.role !== 'member') return row;
          if (
            referencesMedia(c.org.brand, url) ||
            referencesMedia(await this.exercises(c), url) ||
            referencesMedia(await this.machines(c), url) ||
            referencesMedia(await this.units(c), url) ||
            referencesMedia(await this.assignments(c), url)
          )
            return row;
          throw missing();
        },
      );
    } catch (error) {
      if (error instanceof HttpError && [401, 403].includes(error.status)) throw missing();
      throw error;
    }
  }
  // Keep the HTTP/service interface stable while domain modules own their rules.
  machines(...args: Parameters<CatalogModule['machines']>) {
    return this.catalog.machines(...args);
  }
  createMachine(...args: Parameters<CatalogModule['createMachine']>) {
    return this.catalog.createMachine(...args);
  }
  updateMachine(...args: Parameters<CatalogModule['updateMachine']>) {
    return this.catalog.updateMachine(...args);
  }
  transitionMachine(...args: Parameters<CatalogModule['transitionMachine']>) {
    return this.catalog.transitionMachine(...args);
  }
  exercises(...args: Parameters<CatalogModule['exercises']>) {
    return this.catalog.exercises(...args);
  }
  createExercise(...args: Parameters<CatalogModule['createExercise']>) {
    return this.catalog.createExercise(...args);
  }
  updateExercise(...args: Parameters<CatalogModule['updateExercise']>) {
    return this.catalog.updateExercise(...args);
  }
  reviewExercise(...args: Parameters<CatalogModule['reviewExercise']>) {
    return this.catalog.reviewExercise(...args);
  }
  publishExercise(...args: Parameters<CatalogModule['publishExercise']>) {
    return this.catalog.publishExercise(...args);
  }
  units(...args: Parameters<EquipmentModule['units']>) {
    return this.equipment.units(...args);
  }
  createUnit(...args: Parameters<EquipmentModule['createUnit']>) {
    return this.equipment.createUnit(...args);
  }
  updateUnit(...args: Parameters<EquipmentModule['updateUnit']>) {
    return this.equipment.updateUnit(...args);
  }
  batchUnits(...args: Parameters<EquipmentModule['batchUnits']>) {
    return this.equipment.batchUnits(...args);
  }
  activeModels(...args: Parameters<EquipmentModule['activeModels']>) {
    return this.equipment.activeModels(...args);
  }
  async website(c: Context): Promise<Website> {
    this.admin(c);
    if (c.branchId) {
      const r = (
        await c.db.query<WebsiteRow>(
          'SELECT draft,revision,published,published_revision,published_at FROM b2b_branch WHERE organization_id=$1 AND id=$2',
          [c.org.id, c.branchId],
        )
      ).rows[0];
      if (!r) throw missing();
      return websiteDTO(r);
    }
    const row = (
      await c.db.query<WebsiteRow>('SELECT * FROM b2b_website WHERE organization_id=$1', [c.org.id])
    ).rows[0];
    return row
      ? websiteDTO(row)
      : {
          draft: WebsiteInputSchema.parse({}),
          revision: 0,
          publishedRevision: null,
          publishedAt: null,
        };
  }
  async updateWebsite(c: Context, input: WebsiteInput, revision: number): Promise<Website> {
    this.admin(c);
    await this.validateWebsite(c, input);
    if (
      new Set(input.activities.map((v) => v.id)).size !== input.activities.length ||
      new Set(input.openingHours.map((v) => v.id)).size !== input.openingHours.length
    )
      throw new HttpError(
        400,
        'DUPLICATE_WEBSITE_ITEM',
        'Los identificadores de actividades y horarios deben ser distintos.',
      );
    if (c.branchId) {
      const r = (
        await c.db.query<WebsiteRow>(
          'UPDATE b2b_branch SET draft=$3,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$4 RETURNING *',
          [c.org.id, c.branchId, input, revision],
        )
      ).rows[0];
      if (!r) throw conflict();
      await this.audit(c, 'branch.website.update', c.branchId);
      return websiteDTO(r);
    }
    await c.db.query(
      'INSERT INTO b2b_website(organization_id,draft) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [c.org.id, WebsiteInputSchema.parse({})],
    );
    const found = await c.db.query<WebsiteRow>(
      'UPDATE b2b_website SET draft=$3,revision=revision+1 WHERE organization_id=$1 AND revision=$2 RETURNING *',
      [c.org.id, revision, input],
    );
    if (!found.rows[0]) throw conflict();
    await this.audit(c, 'website.update', c.org.id);
    return websiteDTO(found.rows[0]);
  }
  async publishWebsite(c: Context, revision: number, unpublish = false): Promise<Website> {
    this.admin(c);
    if (c.branchId) {
      const current = await this.website(c);
      if (current.revision !== revision) throw conflict();
      if (!unpublish && !current.draft.headline.trim())
        throw new HttpError(
          400,
          'WEBSITE_INCOMPLETE',
          'Completá el título del sitio antes de publicarlo.',
        );
      if (!unpublish) await this.validateWebsite(c, current.draft);
      const r = (
        await c.db.query<WebsiteRow>(
          `UPDATE b2b_branch SET published=$3,published_revision=$4,published_at=$5,public=$6,published_profile=CASE WHEN $6 THEN jsonb_build_object('id',id,'slug',slug,'name',name,'address',address,'contact',contact,'timezone',timezone) ELSE NULL END,revision=revision+1 WHERE organization_id=$1 AND id=$2 RETURNING *`,
          [
            c.org.id,
            c.branchId,
            unpublish ? null : current.draft,
            unpublish ? null : revision + 1,
            unpublish ? null : new Date(),
            !unpublish,
          ],
        )
      ).rows[0];
      await this.audit(
        c,
        unpublish ? 'branch.website.unpublish' : 'branch.website.publish',
        c.branchId,
      );
      return websiteDTO(r);
    }
    const row = (
      await c.db.query<WebsiteRow>('SELECT * FROM b2b_website WHERE organization_id=$1', [c.org.id])
    ).rows[0];
    if (!row || row.revision !== revision) throw conflict();
    if (!unpublish && !row.draft.headline.trim())
      throw new HttpError(
        400,
        'WEBSITE_INCOMPLETE',
        'Completá el título del sitio antes de publicarlo.',
      );
    const content = WebsiteInputSchema.parse(row.draft);
    if (!unpublish) {
      await this.validateWebsite(c, content);
      await this.validateLogo(c, c.org.brand.logoUrl);
    }
    const found = await c.db.query<WebsiteRow>(
      'UPDATE b2b_website SET published=$2,published_revision=$3,published_at=$4,revision=revision+1 WHERE organization_id=$1 RETURNING *',
      [
        c.org.id,
        unpublish ? null : { content, brand: c.org.brand },
        unpublish ? null : row.revision + 1,
        unpublish ? null : new Date(),
      ],
    );
    await this.audit(c, unpublish ? 'website.unpublish' : 'website.publish', c.org.id);
    return websiteDTO(found.rows[0]);
  }
  async validateThemeMedia(c: Context, theme: Theme) {
    // Brand identity is public independently of a branch; require brand-owned media.
    for (const url of [theme.brand.logoUrl, theme.heroImageUrl].filter(Boolean)) {
      await this.validateLogo({ ...c, branchId: undefined }, url);
      const match = /^\/api\/b2b\/media\/([a-zA-Z0-9_-]+)$/.exec(url);
      if (
        match &&
        (
          await c.db.query(
            'SELECT 1 FROM b2b_media WHERE id=$1 AND organization_id=$2 AND branch_id IS NOT NULL',
            [match[1], c.org.id],
          )
        ).rowCount
      )
        throw new HttpError(
          400,
          'BRAND_MEDIA_REQUIRED',
          'La identidad de marca requiere un medio compartido de marca.',
        );
    }
  }
  private async validateWebsite(c: Context, input: WebsiteInput) {
    if (input.floorPlan || input.spatialModel) await this.whiteLabel.requireModule(c, 'floorPlan');
    await this.validateAssets(c, [
      ...input.gallery,
      ...(input.floorPlan ? [input.floorPlan.image] : []),
      ...(input.spatialModel ? [input.spatialModel] : []),
    ]);
    const ids = input.floorPlan?.points.map((point) => point.unitId) ?? [];
    if (ids.length) {
      const units = await c.db.query<{ id: string }>(
        'SELECT id FROM b2b_unit WHERE organization_id=$1 AND id=ANY($2::text[]) AND NOT archived AND ($3::text IS NULL OR branch_id=$3)',
        [c.org.id, ids, c.branchId ?? null],
      );
      if (units.rows.length !== ids.length)
        throw new HttpError(
          400,
          'INVALID_FLOOR_PLAN',
          'El plano contiene equipos retirados o ajenos al gimnasio. Actualizá los puntos antes de publicar.',
        );
    }
  }
  async setupProgress(c: Context): Promise<SetupProgress> {
    this.staff(c);
    const website = (
      await c.db.query<WebsiteRow>('SELECT * FROM b2b_website WHERE organization_id=$1', [c.org.id])
    ).rows[0];
    const units = await this.units(c),
      exercises = await this.exercises(c);
    const checks: SetupProgress['checks'] = [
      {
        id: 'brand',
        label: 'Identidad y contacto',
        complete: Boolean(c.org.brand.name && c.org.brand.contact && c.org.brand.address),
      },
      { id: 'inventory', label: 'Equipos cargados', complete: units.some((u) => !u.archived) },
      {
        id: 'content',
        label: 'Ejercicios de equipos publicados',
        complete: exercises.some(
          (e) =>
            e.status === 'published' &&
            units.some((u) => !u.archived && supportsMachine(e, u.machineId)),
        ),
      },
      {
        id: 'activities',
        label: 'Actividades',
        complete: Boolean(website?.draft.activities.length),
      },
      { id: 'hours', label: 'Horarios', complete: Boolean(website?.draft.openingHours.length) },
      { id: 'gallery', label: 'Galería', complete: Boolean(website?.draft.gallery.length) },
      {
        id: 'website',
        label: 'Sitio publicado',
        complete: Boolean(
          website?.published &&
            website.published_revision === website.revision &&
            isDeepStrictEqual(website.published.brand, c.org.brand),
        ),
      },
    ];
    return {
      checks,
      completed: checks.filter((v) => v.complete).length,
      total: checks.length,
      websitePublished: Boolean(website?.published),
    };
  }
  programs(...args: Parameters<TrainingModule['programs']>) {
    return this.training.programs(...args);
  }
  validateProgram(...args: Parameters<TrainingModule['validateProgram']>) {
    return this.training.validateProgram(...args);
  }
  createProgram(...args: Parameters<TrainingModule['createProgram']>) {
    return this.training.createProgram(...args);
  }
  updateProgram(...args: Parameters<TrainingModule['updateProgram']>) {
    return this.training.updateProgram(...args);
  }
  publishProgram(...args: Parameters<TrainingModule['publishProgram']>) {
    return this.training.publishProgram(...args);
  }
  programVersion(...args: Parameters<TrainingModule['programVersion']>) {
    return this.training.programVersion(...args);
  }
  availability(...args: Parameters<TrainingModule['availability']>) {
    return this.training.availability(...args);
  }
  assignments(...args: Parameters<TrainingModule['assignments']>) {
    return this.training.assignments(...args);
  }
  assignProgram(...args: Parameters<TrainingModule['assignProgram']>) {
    return this.training.assignProgram(...args);
  }
  executions(...args: Parameters<TrainingModule['executions']>) {
    return this.training.executions(...args);
  }
  recordExecution(...args: Parameters<TrainingModule['recordExecution']>) {
    return this.training.recordExecution(...args);
  }
  report(...args: Parameters<TrainingModule['report']>) {
    return this.training.report(...args);
  }
  async publicSite(
    slug: string,
    unitId?: string,
    domain?: DomainContext | null,
    branchSlug?: string,
  ): Promise<PublicSite | PublicUnit> {
    return this.transaction(async (db) => {
      const org = (await db.query<OrgRow>('SELECT * FROM b2b_organization WHERE slug=$1', [slug]))
        .rows[0];
      if (!org || (domain && org.id !== domain.organizationId)) throw missing();
      if (domain) {
        if (!unitId && !branchSlug) {
          const modules = await readModules(db, org.id);
          const rootSite = (
            await db.query<WebsiteRow>('SELECT * FROM b2b_website WHERE organization_id=$1', [
              org.id,
            ])
          ).rows[0];
          if (!modules.website || !rootSite?.published) throw missing();
          const theme = (
            await db.query<{ published: Theme }>(
              'SELECT published FROM b2b_theme WHERE organization_id=$1',
              [org.id],
            )
          ).rows[0];
          const website = WebsiteInputSchema.parse(rootSite.published.content);
          // Legacy floor plans belong to Principal, not the brand landing page.
          website.floorPlan = null;
          website.spatialModel = null;
          return {
            organization: { id: org.id, slug: org.slug, brand: theme.published.brand },
            website,
            units: [],
            machines: [],
            exercises: [],
          };
        }
        let branchId: string | undefined;
        if (unitId)
          branchId = (
            await db.query<{ branch_id: string }>(
              'SELECT branch_id FROM b2b_unit WHERE organization_id=$1 AND id=$2',
              [org.id, unitId],
            )
          ).rows[0]?.branch_id;
        const branch = (
          await db.query<{ id: string; published: WebsiteInput }>(
            `SELECT id,published FROM b2b_branch WHERE organization_id=$1 AND status='active' AND public AND published IS NOT NULL
          AND (($2::text IS NOT NULL AND id=$2) OR ($2::text IS NULL AND published_profile->>'slug'=$3))`,
            [org.id, branchId ?? null, branchSlug ?? 'principal'],
          )
        ).rows[0];
        if (!branch) throw missing();
        const modules = await readModules(db, org.id, branch.id);
        if (!modules.website || (unitId && !modules.equipment)) throw missing();
        const theme = (
          await db.query<{ published: Theme }>(
            'SELECT published FROM b2b_theme WHERE organization_id=$1',
            [org.id],
          )
        ).rows[0];
        const organization = { id: org.id, slug: org.slug, brand: theme.published.brand };
        const { machines, exercises } = await this.catalog.publishedCatalog(db, org.id, branch.id);
        const units = modules.equipment
          ? await this.equipment.publicUnits(db, org, new Set(machines.map((m) => m.id)), branch.id)
          : [];
        if (unitId) {
          const unit = units.find((u) => u.id === unitId),
            machine = machines.find((m) => m.id === unit?.machineId);
          if (!unit || !machine) throw missing();
          return {
            organization,
            unit,
            machine,
            exercises: exercises.filter((e) => supportsMachine(e, machine.id)),
          };
        }
        const website = WebsiteInputSchema.parse(branch.published);
        if (!modules.floorPlan) {
          website.floorPlan = null;
          website.spatialModel = null;
        } else if (website.floorPlan)
          website.floorPlan.points = website.floorPlan.points.filter((p) =>
            units.some((u) => u.id === p.unitId),
          );
        return { organization, website, units, machines, exercises };
      }
      const site = (
        await db.query<WebsiteRow>('SELECT * FROM b2b_website WHERE organization_id=$1', [org.id])
      ).rows[0];
      if (!site?.published) throw missing();
      // Explicit current public references only. Drafts and historical snapshots are never public.
      const organization = { id: org.id, slug: org.slug, brand: site.published.brand };
      const { machines, exercises } = await this.catalog.publishedCatalog(db, org.id);
      const units = await this.equipment.publicUnits(
        db,
        org,
        new Set(machines.map((machine) => machine.id)),
      );
      if (!unitId) {
        const website = WebsiteInputSchema.parse(site.published.content);
        // Revoking a unit's publication removes its marker immediately, including its ID.
        if (website.floorPlan) {
          const publicIds = new Set(units.map((unit) => unit.id));
          website.floorPlan.points = website.floorPlan.points.filter((point) =>
            publicIds.has(point.unitId),
          );
        }
        return { organization, website, units, machines, exercises };
      }
      const unit = units.find((u) => u.id === unitId);
      if (!unit) throw missing();
      const machine = machines.find((m) => m.id === unit.machineId);
      if (!machine) throw missing();
      return {
        organization,
        unit,
        machine,
        exercises: exercises.filter((e) => supportsMachine(e, machine.id)),
      };
    });
  }
  async limit(key: string, max = 20) {
    const found = await this.pool.query<{ count: number }>(
      `INSERT INTO b2b_public_rate_limit(key,count,expires_at) VALUES($1,1,now()+interval '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN b2b_public_rate_limit.expires_at<=now() THEN 1 ELSE b2b_public_rate_limit.count+1 END,expires_at=CASE WHEN b2b_public_rate_limit.expires_at<=now() THEN now()+interval '1 minute' ELSE b2b_public_rate_limit.expires_at END RETURNING count`,
      [key],
    );
    if (found.rows[0].count > max)
      throw new HttpError(429, 'RATE_LIMITED', 'Demasiados intentos. Probá en un minuto.');
  }
}

export { seedBaseCatalog } from './catalog/seed.ts';
export { BrandInputSchema };
