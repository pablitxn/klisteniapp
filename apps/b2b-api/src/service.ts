import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import { exercises as baseExercises } from '@klisteniapp/catalog-base';
import {
  ExerciseInputSchema, MachineInputSchema, BrandInputSchema, WebsiteInputSchema,
  type Organization, type Membership, type Me, type Member, type Role, type Brand,
  type Exercise, type Machine, type Unit, type Program, type ProgramVersion, type Assignment, type Execution,
  type ExecutionInput, type Report, type PublicSite, type PublicUnit, type StepAvailability, type Asset, type Media, type Website, type WebsiteInput, type SetupProgress, type ContentStatus,
} from '@klisteniapp/b2b-contracts';
import type { z } from 'zod';
import type { Auth } from './auth.ts';
import type { Config } from './config.ts';
import { HttpError } from './errors.ts';
import type { StoredMedia } from './media.ts';

type OrgRow = { id: string; slug: string; brand: Brand; service_enabled: boolean; service_ends_at: Date | null };
type Context = { db: PoolClient; actorId: string; org: OrgRow; role: Role };
type ExerciseRow = { id: string; organization_id: string | null; data: z.infer<typeof ExerciseInputSchema>; status: ContentStatus; version: number; revision: number };
type MachineRow = { status: ContentStatus; id: string; organization_id: string | null; data: z.infer<typeof MachineInputSchema>; version: number; revision: number };
type ProgramRow = { id: string; data: Omit<Program, 'id' | 'publishedVersion' | 'revision'>; published_version: number | null; revision: number };
type UnitRow = { id: string; machine_id: string; label: string; location: string; assets: Unit['assets']; adjustments: string; revision: number; archived: boolean; public: boolean };
export type MediaRow = { id: string; organization_id: string; kind: Asset['kind']; label: string; attribution: string; relative_path: string; mime: string; bytes: string | number; sha256: string; created_at: Date };
const mediaDTO = (r: MediaRow): Media => ({ id: r.id, kind: r.kind, label: r.label, attribution: r.attribution, url: `/api/b2b/media/${r.id}`, mime: r.mime, bytes: Number(r.bytes), sha256: r.sha256, createdAt: r.created_at.toISOString() });
function referencesMedia(value: unknown, url: string): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => referencesMedia(item, url));
  const record = value as Record<string, unknown>;
  return record.url === url || record.logoUrl === url || Object.values(record).some(item => referencesMedia(item, url));
}
type WebsiteRow = { draft: WebsiteInput; revision: number; published: { content: WebsiteInput; brand: Brand } | null; published_revision: number | null; published_at: Date | null };
const websiteDTO = (r: WebsiteRow): Website => ({ draft: r.draft, revision: r.revision, publishedRevision: r.published_revision, publishedAt: r.published_at?.toISOString() ?? null });
const missing = () => new HttpError(404, 'NOT_FOUND', 'Recurso no disponible.');
const denied = () => new HttpError(403, 'FORBIDDEN', 'No tenés permiso para esta operación.');
const conflict = () => new HttpError(409, 'REVISION_CONFLICT', 'El contenido cambió. Actualizá antes de guardar.');
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const exerciseDTO = (r: ExerciseRow): Exercise => ({ ...r.data, id: r.id, scope: r.organization_id ? 'organization' : 'base', status: r.status, version: r.version, revision: r.revision });
const machineDTO = (r: MachineRow): Machine => ({ ...r.data, id: r.id, scope: r.organization_id ? 'organization' : 'base', version: r.version, revision: r.revision, status: r.status });
const programDTO = (r: ProgramRow): Program => ({ ...r.data, id: r.id, publishedVersion: r.published_version, revision: r.revision });
const unitDTO = (r: UnitRow, slug: string): Unit => ({ id: r.id, machineId: r.machine_id, label: r.label, location: r.location, assets: r.assets, adjustments: r.adjustments, publicPath: `/g/${slug}/units/${r.id}`, revision: r.revision, archived: r.archived, public: r.public });
const organizationDTO = (r: OrgRow): Organization => ({ id: r.id, slug: r.slug, brand: r.brand, serviceActive: r.service_enabled && (!r.service_ends_at || r.service_ends_at > new Date()), serviceEndsAt: r.service_ends_at?.toISOString() ?? null });

export async function createUser(db: PoolClient, auth: Auth, input: { email: string; name: string; password: string }) {
  const password = await (await auth.$context).password.hash(input.password);
  const id = randomUUID();
  await db.query(`INSERT INTO b2b_auth_user (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,true,now(),now())`, [id, input.name, input.email.toLowerCase()]);
  await db.query(`INSERT INTO b2b_auth_account (id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES ($1,$2,$2,'credential',$3,now(),now())`, [randomUUID(), id, password]);
  return { id, name: input.name, email: input.email.toLowerCase() };
}

export class B2BService {
  pool: Pool; auth: Auth; config: Config;
  constructor(pool: Pool, auth: Auth, config: Config) { this.pool = pool; this.auth = auth; this.config = config; }
  async transaction<T>(operation: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try { await db.query('BEGIN'); const result = await operation(db); await db.query('COMMIT'); return result; }
    catch (error) { await db.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { db.release(); }
  }
  async requireSession(db: PoolClient, actorId: string, sessionId: string) {
    const current = await db.query('SELECT id FROM b2b_auth_session WHERE id=$1 AND "userId"=$2 AND "expiresAt">now() FOR SHARE', [sessionId, actorId]);
    if (!current.rowCount) throw new HttpError(401, 'UNAUTHENTICATED', 'Tu sesión finalizó. Iniciá sesión para continuar.');
  }
  async organization<T>(actorId: string, orgId: string, sessionId: string, write: boolean, operation: (context: Context) => Promise<T>): Promise<T> {
    return this.transaction(async db => {
      // Every B2B mutation takes this lock before checking membership/contract.
      // Revocation and writes cannot race past one another across API instances.
      const found = await db.query<OrgRow>(`SELECT * FROM b2b_organization WHERE id=$1 ${write ? 'FOR UPDATE' : 'FOR SHARE'}`, [orgId]);
      const org = found.rows[0]; if (!org) throw missing();
      // Session deletion (logout/reset) and protected transactions are ordered:
      // a queued request cannot outlive a session revoked while it waited.
      await this.requireSession(db, actorId, sessionId);
      const membership = await db.query<{ role: Role }>('SELECT role FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 AND active', [orgId, actorId]);
      if (!membership.rows[0]) throw denied();
      if (write && !organizationDTO(org).serviceActive) throw new HttpError(402, 'GYM_SERVICE_INACTIVE', 'El servicio del gimnasio está suspendido. Tus datos guardados siguen disponibles.');
      return operation({ db, actorId, org, role: membership.rows[0].role });
    });
  }
  staff(c: Context) { if (c.role === 'member') throw denied(); }
  admin(c: Context) { if (c.role !== 'admin') throw denied(); }
  async audit(c: Context, action: string, resourceId: string) { await c.db.query('INSERT INTO b2b_audit(organization_id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)', [c.org.id, c.actorId, action, resourceId]); }
  async memberAccess(c: Context, memberId: string): Promise<void> {
    const member = await c.db.query('SELECT role FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 AND active', [c.org.id, memberId]);
    if (member.rows[0]?.role !== 'member') throw missing();
    if (c.role === 'admin' || (c.role === 'member' && c.actorId === memberId)) return;
    if (c.role === 'coach' && (await c.db.query('SELECT 1 FROM b2b_coach_assignment WHERE organization_id=$1 AND coach_id=$2 AND member_id=$3', [c.org.id, c.actorId, memberId])).rowCount) return;
    throw denied();
  }
  async me(user: Me['user']): Promise<Me> {
    const found = await this.pool.query<OrgRow & { role: Role }>('SELECT o.*,m.role FROM b2b_membership m JOIN b2b_organization o ON o.id=m.organization_id WHERE m.user_id=$1 AND m.active ORDER BY o.slug', [user.id]);
    return { user, memberships: found.rows.map((r): Membership => ({ organization: organizationDTO(r), role: r.role })) };
  }
  async members(c: Context): Promise<Member[]> {
    const found = await c.db.query<{ user_id: string; name: string; email: string; role: Role; active: boolean; coach_ids: string[] }>(`SELECT m.user_id,u.name,u.email,m.role,m.active,
      ARRAY(SELECT coach_id FROM b2b_coach_assignment a WHERE a.organization_id=m.organization_id AND a.member_id=m.user_id) coach_ids
      FROM b2b_membership m JOIN b2b_auth_user u ON u.id=m.user_id WHERE m.organization_id=$1
      AND ($3='admin' OR m.user_id=$2 OR ($3='coach' AND m.active AND EXISTS(SELECT 1 FROM b2b_coach_assignment a WHERE a.organization_id=m.organization_id AND a.member_id=m.user_id AND a.coach_id=$2))) ORDER BY u.name`, [c.org.id, c.actorId, c.role]);
    return found.rows.map(r => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, active: r.active, coachIds: r.coach_ids }));
  }
  async updateMembership(c: Context, userId: string, input: { role?: Role; active?: boolean }) {
    this.admin(c);
    const found = await c.db.query<{ role: Role; active: boolean }>('SELECT role,active FROM b2b_membership WHERE organization_id=$1 AND user_id=$2', [c.org.id, userId]);
    const previous = found.rows[0]; if (!previous) throw missing();
    const role = input.role ?? previous.role, active = input.active ?? previous.active;
    if (previous.role === 'admin' && previous.active && (role !== 'admin' || !active)) {
      const count = await c.db.query("SELECT 1 FROM b2b_membership WHERE organization_id=$1 AND role='admin' AND active", [c.org.id]);
      if (count.rowCount === 1) throw new HttpError(409, 'LAST_ADMIN', 'El gimnasio debe conservar un administrador activo.');
    }
    await c.db.query('UPDATE b2b_membership SET role=$3,active=$4 WHERE organization_id=$1 AND user_id=$2', [c.org.id, userId, role, active]);
    if (role !== previous.role || !active) await c.db.query('DELETE FROM b2b_coach_assignment WHERE organization_id=$1 AND (coach_id=$2 OR member_id=$2)', [c.org.id, userId]);
    await this.audit(c, 'membership.update', userId); return { ok: true };
  }
  async assignCoach(c: Context, input: { coachId: string; memberId: string }) {
    this.admin(c);
    const rows = await c.db.query<{ user_id: string; role: Role }>('SELECT user_id,role FROM b2b_membership WHERE organization_id=$1 AND active AND user_id=ANY($2::text[])', [c.org.id, [input.coachId, input.memberId]]);
    if (!rows.rows.some(r => r.user_id === input.coachId && r.role === 'coach') || !rows.rows.some(r => r.user_id === input.memberId && r.role === 'member')) throw missing();
    await c.db.query('INSERT INTO b2b_coach_assignment(organization_id,coach_id,member_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [c.org.id, input.coachId, input.memberId]);
    await this.audit(c, 'coach.assign', input.memberId); return { ok: true };
  }
  async brand(c: Context, input: Brand) { this.admin(c); await this.validateLogo(c, input.logoUrl); await c.db.query('UPDATE b2b_organization SET brand=$2 WHERE id=$1', [c.org.id, input]); await c.db.query('UPDATE b2b_website SET revision=revision+1 WHERE organization_id=$1', [c.org.id]); await this.audit(c, 'brand.update', c.org.id); return organizationDTO({ ...c.org, brand: input }); }
  async invite(c: Context, input: { email: string; name: string; role: Role }) {
    this.admin(c); const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 7 * 86400000); const id = randomUUID();
    await c.db.query('INSERT INTO b2b_invitation(id,organization_id,email,name,role,token_hash,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, c.org.id, input.email, input.name, input.role, hashToken(token), expiresAt, c.actorId]);
    await this.audit(c, 'invitation.create', id); return { url: `${this.config.origin}/app/invite?token=${encodeURIComponent(token)}`, expiresAt: expiresAt.toISOString() };
  }
  async acceptInvitation(token: string, input?: { name: string; password: string }, existingSession?: { userId: string; sessionId: string }) {
    return this.transaction(async db => {
      const first = await db.query<{ organization_id: string }>('SELECT organization_id FROM b2b_invitation WHERE token_hash=$1', [hashToken(token)]);
      if (!first.rows[0]) throw new HttpError(400, 'INVALID_INVITATION', 'Invitación inválida o vencida.');
      const org = (await db.query<OrgRow>('SELECT * FROM b2b_organization WHERE id=$1 FOR UPDATE', [first.rows[0].organization_id])).rows[0];
      if (existingSession) await this.requireSession(db, existingSession.userId, existingSession.sessionId);
      if (!organizationDTO(org).serviceActive) throw new HttpError(402, 'GYM_SERVICE_INACTIVE', 'El servicio del gimnasio está suspendido.');
      const found = await db.query<{ id: string; email: string; role: Role }>('SELECT id,email,role FROM b2b_invitation WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE', [hashToken(token)]);
      const invitation = found.rows[0]; if (!invitation) throw new HttpError(400, 'INVALID_INVITATION', 'Invitación inválida o vencida.');
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`b2b:email:${invitation.email}`]);
      const existing = (await db.query<{ id: string }>('SELECT id FROM b2b_auth_user WHERE email=$1', [invitation.email])).rows[0];
      let userId: string;
      if (existing) {
        if (existingSession?.userId !== existing.id) throw new HttpError(409, 'EXISTING_ACCOUNT', 'Ya existe tu cuenta B2B. Iniciá sesión para aceptar sin cambiar tu contraseña.');
        userId = existing.id;
      } else {
        if (!input || existingSession) throw new HttpError(400, 'NEW_ACCOUNT_REQUIRED', 'Completá la activación de la cuenta invitada.');
        userId = (await createUser(db, this.auth, { ...input, email: invitation.email })).id;
      }
      // Invitations never silently promote an existing membership or reactivate it.
      if ((await db.query('SELECT 1 FROM b2b_membership WHERE organization_id=$1 AND user_id=$2', [org.id, userId])).rowCount) throw new HttpError(409, 'MEMBERSHIP_EXISTS', 'Ya pertenecés a este gimnasio. Un administrador puede gestionar tu acceso.');
      await db.query('INSERT INTO b2b_membership(organization_id,user_id,role) VALUES($1,$2,$3)', [org.id, userId, invitation.role]);
      await db.query('UPDATE b2b_invitation SET used_at=now() WHERE id=$1', [invitation.id]); return { ok: true };
    });
  }
  async validateAssets(c: Context, assets: Asset[]) {
    for (const asset of assets) await this.validateMediaUrl(c, asset.url, asset.kind, asset.id);
  }
  async validateLogo(c: Context, url: string) { if (url) await this.validateMediaUrl(c, url, 'image'); }
  async validateMediaUrl(c: Context, url: string, kind: Asset['kind'], assetId?: string) {
    const parsed = new URL(url, this.config.origin);
    if (parsed.origin !== this.config.origin) return;
    let path: string; try { path = new URL(decodeURIComponent(parsed.pathname), this.config.origin).pathname; } catch { throw new HttpError(400, 'INVALID_MEDIA_REFERENCE', 'La ruta del medio no es válida.'); }
    const media = /^\/api\/b2b\/media\/([a-zA-Z0-9_-]+)$/.exec(path);
    if (!media) {
      if (!/^\/(?:models|previews)\/[a-zA-Z0-9_./-]+$/.test(path)) throw new HttpError(400, 'INVALID_MEDIA_REFERENCE', 'Seleccioná un medio cargado o un recurso de la biblioteca.');
      return;
    }
    // Canonical URLs keep ownership checks and public-reference checks identical.
    if (url !== `/api/b2b/media/${media[1]}` || (assetId && assetId !== media[1])) throw new HttpError(400, 'INVALID_MEDIA_REFERENCE', 'Usá la URL e identificador originales del medio cargado.');
    if (!(await c.db.query('SELECT 1 FROM b2b_media WHERE id=$1 AND organization_id=$2 AND kind=$3', [media[1], c.org.id, kind])).rowCount) throw new HttpError(400, 'INVALID_MEDIA_REFERENCE', 'El medio no pertenece a este gimnasio o su tipo no coincide.');
  }
  async media(c: Context) {
    this.staff(c); const rows = (await c.db.query<MediaRow>('SELECT * FROM b2b_media WHERE organization_id=$1 ORDER BY created_at DESC,id', [c.org.id])).rows;
    return { media: rows.map(mediaDTO), usage: { bytes: rows.reduce((sum, r) => sum + Number(r.bytes), 0), quotaBytes: (this.config.mediaQuotaMb ?? 256) * 1024 ** 2 } };
  }
  async uploadAllowance(c: Context, bytes: number) {
    this.staff(c); const usage = await this.media(c);
    if (usage.usage.bytes + bytes > usage.usage.quotaBytes) throw new HttpError(413, 'MEDIA_QUOTA', 'El gimnasio alcanzó su espacio disponible para medios.');
  }
  async saveMedia(c: Context, stored: StoredMedia, metadata: { kind: Asset['kind']; label: string; attribution: string }): Promise<Media> {
    await this.uploadAllowance(c, stored.bytes);
    const row = (await c.db.query<MediaRow>('INSERT INTO b2b_media(id,organization_id,created_by,kind,label,attribution,relative_path,mime,bytes,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [stored.id, c.org.id, c.actorId, metadata.kind, metadata.label, metadata.attribution, stored.relativePath, stored.mime, stored.bytes, stored.sha256])).rows[0];
    await this.audit(c, 'media.create', row.id); return mediaDTO(row);
  }
  async mediaAccess(id: string, identity?: { userId: string; sessionId: string }): Promise<MediaRow> {
    const row = (await this.pool.query<MediaRow>('SELECT * FROM b2b_media WHERE id=$1', [id])).rows[0]; if (!row) throw missing();
    const org = (await this.pool.query<{ slug: string }>('SELECT slug FROM b2b_organization WHERE id=$1', [row.organization_id])).rows[0];
    const url = `/api/b2b/media/${id}`;
    try { if (referencesMedia(await this.publicSite(org.slug), url)) return row; } catch (error) { if (!(error instanceof HttpError) || error.status !== 404) throw error; }
    if (!identity) throw missing();
    try {
      return await this.organization(identity.userId, row.organization_id, identity.sessionId, false, async c => {
        if (c.role !== 'member') return row;
        if (referencesMedia(c.org.brand, url) || referencesMedia(await this.exercises(c), url) || referencesMedia(await this.machines(c), url) || referencesMedia(await this.units(c), url) || referencesMedia(await this.assignments(c), url)) return row;
        throw missing();
      });
    } catch (error) { if (error instanceof HttpError && [401, 403].includes(error.status)) throw missing(); throw error; }
  }
  async machines(c: Context): Promise<Machine[]> { return (await c.db.query<MachineRow>('SELECT * FROM b2b_machine WHERE (organization_id IS NULL OR organization_id=$1) AND ($2<>$$member$$ OR status=$$published$$) ORDER BY id', [c.org.id, c.role])).rows.map(machineDTO); }
  async createMachine(c: Context, input: z.infer<typeof MachineInputSchema>): Promise<Machine> {
    this.admin(c); await this.validateAssets(c, input.assets); await this.validateMachineSource(c, input); const id = randomUUID(); const found = await c.db.query<MachineRow>('INSERT INTO b2b_machine(id,organization_id,data) VALUES($1,$2,$3) RETURNING *', [id, c.org.id, input]); await this.audit(c, 'machine.create', id); return machineDTO(found.rows[0]);
  }
  async validateMachineSource(c: Context, input: z.infer<typeof MachineInputSchema>) {
    if (Boolean(input.derivedFromId) !== Boolean(input.derivedFromVersion)) throw new HttpError(400, 'INVALID_MODEL_SOURCE', 'La adaptación requiere modelo y versión de origen.');
    if (input.derivedFromId && !(await c.db.query('SELECT 1 FROM b2b_machine WHERE id=$1 AND version=$2 AND (organization_id IS NULL OR organization_id=$3)', [input.derivedFromId, input.derivedFromVersion, c.org.id])).rowCount) throw new HttpError(409, 'MODEL_SOURCE_CHANGED', 'El modelo de origen no está disponible en esa versión.');
  }
  async updateMachine(c: Context, id: string, input: z.infer<typeof MachineInputSchema>, revision: number): Promise<Machine> {
    this.admin(c); await this.validateAssets(c, input.assets);
    const previous = (await c.db.query<MachineRow>('SELECT * FROM b2b_machine WHERE organization_id=$1 AND id=$2', [c.org.id, id])).rows[0];
    if (!previous || previous.revision !== revision) throw conflict();
    if (input.derivedFromId !== previous.data.derivedFromId || input.derivedFromVersion !== previous.data.derivedFromVersion) throw new HttpError(400, 'IMMUTABLE_MODEL_SOURCE', 'Conservá la referencia de origen de esta adaptación.');
    const found = await c.db.query<MachineRow>("UPDATE b2b_machine SET data=$3,status='draft',version=version+1,revision=revision+1 WHERE organization_id=$1 AND id=$2 RETURNING *", [c.org.id, id, input]);
    await this.audit(c, 'machine.update', id); return machineDTO(found.rows[0]);
  }
  async validateMachine(c: Context, id: string) { if (!(await c.db.query('SELECT 1 FROM b2b_machine WHERE id=$1 AND (organization_id IS NULL OR organization_id=$2)', [id, c.org.id])).rowCount) throw missing(); }
  async units(c: Context): Promise<Unit[]> { return (await c.db.query<UnitRow>("SELECT * FROM b2b_unit WHERE organization_id=$1 AND ($2 <> 'member' OR (NOT archived AND EXISTS(SELECT 1 FROM b2b_machine m WHERE m.id=machine_id AND m.status='published'))) ORDER BY label", [c.org.id, c.role])).rows.map(r => unitDTO(r, c.org.slug)); }
  async createUnit(c: Context, input: Omit<Unit, 'id' | 'publicPath' | 'revision'>): Promise<Unit> {
    this.admin(c); await this.validateAssets(c, input.assets); await this.validateMachine(c, input.machineId); const id = randomUUID();
    const found = await c.db.query<UnitRow>('INSERT INTO b2b_unit(id,organization_id,machine_id,label,location,assets,adjustments,archived,public) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [id, c.org.id, input.machineId, input.label, input.location, JSON.stringify(input.assets), input.adjustments, input.archived, input.public]);
    await this.audit(c, 'unit.create', id); return unitDTO(found.rows[0], c.org.slug);
  }
  async updateUnit(c: Context, id: string, input: Omit<Unit, 'id' | 'publicPath' | 'revision'>, revision: number): Promise<Unit> {
    this.admin(c); await this.validateAssets(c, input.assets); await this.validateMachine(c, input.machineId);
    const found = await c.db.query<UnitRow>('UPDATE b2b_unit SET machine_id=$3,label=$4,location=$5,assets=$6,adjustments=$7,archived=$8,public=$9,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$10 RETURNING *', [c.org.id, id, input.machineId, input.label, input.location, JSON.stringify(input.assets), input.adjustments, input.archived, input.public, revision]);
    if (!found.rows[0]) throw conflict(); await this.audit(c, 'unit.update', id); return unitDTO(found.rows[0], c.org.slug);
  }
  async exercises(c: Context): Promise<Exercise[]> {
    return (await c.db.query<ExerciseRow>("SELECT * FROM b2b_exercise WHERE (organization_id IS NULL OR organization_id=$1) AND ($2 <> 'member' OR status='published') ORDER BY id", [c.org.id, c.role])).rows.map(exerciseDTO);
  }
  async validateExercise(c: Context, input: z.infer<typeof ExerciseInputSchema>) {
    await this.validateAssets(c, input.assets);
    for (const id of new Set([...(input.machineId ? [input.machineId] : []), ...input.compatibleMachineIds])) await this.validateMachine(c, id);
    if (input.baseExerciseId && !(await c.db.query("SELECT 1 FROM b2b_exercise WHERE id=$1 AND organization_id IS NULL", [input.baseExerciseId])).rowCount) throw missing();
    if (input.animationId && !baseExercises.some(e => e.id === input.animationId)) throw new HttpError(400, 'INVALID_ANIMATION', 'La animación no pertenece a la biblioteca.');
  }
  async createExercise(c: Context, input: z.infer<typeof ExerciseInputSchema>): Promise<Exercise> {
    this.staff(c); await this.validateExercise(c, input); const id = randomUUID();
    const found = await c.db.query<ExerciseRow>("INSERT INTO b2b_exercise(id,organization_id,data,status) VALUES($1,$2,$3,'draft') RETURNING *", [id, c.org.id, input]); await this.audit(c, 'exercise.create', id); return exerciseDTO(found.rows[0]);
  }
  async updateExercise(c: Context, id: string, input: z.infer<typeof ExerciseInputSchema>, revision: number): Promise<Exercise> {
    this.staff(c); await this.validateExercise(c, input);
    const found = await c.db.query<ExerciseRow>("UPDATE b2b_exercise SET data=$3,status='draft',revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$4 RETURNING *", [c.org.id, id, input, revision]);
    if (!found.rows[0]) throw conflict(); await this.audit(c, 'exercise.update', id); return exerciseDTO(found.rows[0]);
  }
  async publishExercise(c: Context, id: string, revision: number): Promise<Exercise> {
    this.staff(c);
    const found = await c.db.query<ExerciseRow>("UPDATE b2b_exercise SET status='published',version=version+1,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status='reviewed' RETURNING *", [c.org.id, id, revision]);
    if (!found.rows[0]) throw conflict(); await this.audit(c, 'exercise.publish', id); return exerciseDTO(found.rows[0]);
  }
  async reviewExercise(c: Context, id: string, revision: number): Promise<Exercise> {
    this.staff(c);
    const found = await c.db.query<ExerciseRow>("UPDATE b2b_exercise SET status='reviewed',revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status='draft' RETURNING *", [c.org.id, id, revision]);
    if (!found.rows[0]) throw conflict(); await this.audit(c, 'exercise.review', id); return exerciseDTO(found.rows[0]);
  }
  async transitionMachine(c: Context, id: string, revision: number, publish: boolean): Promise<Machine> {
    this.admin(c);
    const found = await c.db.query<MachineRow>("UPDATE b2b_machine SET status=$4,revision=revision+1,version=version+$5 WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status=$6 RETURNING *", [c.org.id, id, revision, publish ? 'published' : 'reviewed', 0, publish ? 'reviewed' : 'draft']);
    if (!found.rows[0]) throw conflict(); await this.audit(c, publish ? 'machine.publish' : 'machine.review', id); return machineDTO(found.rows[0]);
  }
  async batchUnits(c: Context, input: { id: string; units: Omit<Unit, 'id' | 'publicPath' | 'revision'>[] }) {
    this.admin(c);
    const previous = (await c.db.query<{ input: unknown; result: Unit[] }>('SELECT input,result FROM b2b_unit_batch WHERE organization_id=$1 AND id=$2', [c.org.id, input.id])).rows[0];
    if (previous) { if (!isDeepStrictEqual(previous.input, input)) throw new HttpError(409, 'BATCH_CONFLICT', 'Este lote ya se guardó con otro contenido.'); return previous.result; }
    const units: Unit[] = []; for (const item of input.units) units.push(await this.createUnit(c, item));
    await c.db.query('INSERT INTO b2b_unit_batch(organization_id,id,input,result) VALUES($1,$2,$3,$4)', [c.org.id, input.id, input, JSON.stringify(units)]);
    return units;
  }
  async website(c: Context): Promise<Website> {
    this.admin(c);
    const row = (await c.db.query<WebsiteRow>('SELECT * FROM b2b_website WHERE organization_id=$1', [c.org.id])).rows[0];
    return row ? websiteDTO(row) : { draft: WebsiteInputSchema.parse({}), revision: 0, publishedRevision: null, publishedAt: null };
  }
  async updateWebsite(c: Context, input: WebsiteInput, revision: number): Promise<Website> {
    this.admin(c); await this.validateAssets(c, input.gallery);
    if (new Set(input.activities.map(v => v.id)).size !== input.activities.length || new Set(input.openingHours.map(v => v.id)).size !== input.openingHours.length) throw new HttpError(400, 'DUPLICATE_WEBSITE_ITEM', 'Los identificadores de actividades y horarios deben ser distintos.');
    await c.db.query('INSERT INTO b2b_website(organization_id,draft) VALUES($1,$2) ON CONFLICT DO NOTHING', [c.org.id, WebsiteInputSchema.parse({})]);
    const found = await c.db.query<WebsiteRow>('UPDATE b2b_website SET draft=$3,revision=revision+1 WHERE organization_id=$1 AND revision=$2 RETURNING *', [c.org.id, revision, input]);
    if (!found.rows[0]) throw conflict(); await this.audit(c, 'website.update', c.org.id); return websiteDTO(found.rows[0]);
  }
  async publishWebsite(c: Context, revision: number, unpublish = false): Promise<Website> {
    this.admin(c); const row = (await c.db.query<WebsiteRow>('SELECT * FROM b2b_website WHERE organization_id=$1', [c.org.id])).rows[0];
    if (!row || row.revision !== revision) throw conflict();
    if (!unpublish && !row.draft.headline.trim()) throw new HttpError(400, 'WEBSITE_INCOMPLETE', 'Completá el título del sitio antes de publicarlo.');
    await this.validateAssets(c, row.draft.gallery); await this.validateLogo(c, c.org.brand.logoUrl);
    const found = await c.db.query<WebsiteRow>('UPDATE b2b_website SET published=$2,published_revision=$3,published_at=$4,revision=revision+1 WHERE organization_id=$1 RETURNING *', [c.org.id, unpublish ? null : { content: row.draft, brand: c.org.brand }, unpublish ? null : row.revision + 1, unpublish ? null : new Date()]);
    await this.audit(c, unpublish ? 'website.unpublish' : 'website.publish', c.org.id); return websiteDTO(found.rows[0]);
  }
  async setupProgress(c: Context): Promise<SetupProgress> {
    this.staff(c);
    const website = (await c.db.query<WebsiteRow>('SELECT * FROM b2b_website WHERE organization_id=$1', [c.org.id])).rows[0];
    const units = await this.units(c), exercises = await this.exercises(c);
    const checks: SetupProgress['checks'] = [
      { id: 'brand', label: 'Identidad y contacto', complete: Boolean(c.org.brand.name && c.org.brand.contact && c.org.brand.address) },
      { id: 'inventory', label: 'Equipos cargados', complete: units.some(u => !u.archived) },
      { id: 'content', label: 'Ejercicios de equipos publicados', complete: exercises.some(e => e.status === 'published' && units.some(u => !u.archived && (e.machineId === u.machineId || e.compatibleMachineIds.includes(u.machineId)))) },
      { id: 'activities', label: 'Actividades', complete: Boolean(website?.draft.activities.length) },
      { id: 'hours', label: 'Horarios', complete: Boolean(website?.draft.openingHours.length) },
      { id: 'gallery', label: 'Galería', complete: Boolean(website?.draft.gallery.length) },
      { id: 'website', label: 'Sitio publicado', complete: Boolean(website?.published && website.published_revision === website.revision && isDeepStrictEqual(website.published.brand, c.org.brand)) },
    ];
    return { checks, completed: checks.filter(v => v.complete).length, total: checks.length, websitePublished: Boolean(website?.published) };
  }
  async programs(c: Context): Promise<Program[]> { this.staff(c); return (await c.db.query<ProgramRow>('SELECT * FROM b2b_program WHERE organization_id=$1 ORDER BY id', [c.org.id])).rows.map(programDTO); }
  async validateProgram(c: Context, input: ProgramRow['data'], published: boolean): Promise<Exercise[]> {
    const ids = [...new Set(input.steps.flatMap(s => [s.exerciseId, ...s.alternatives]))];
    const found = await c.db.query<ExerciseRow>("SELECT * FROM b2b_exercise WHERE id=ANY($1::text[]) AND (organization_id IS NULL OR organization_id=$2) AND (NOT $3::boolean OR status='published')", [ids, c.org.id, published]);
    if (found.rowCount !== ids.length) throw new HttpError(400, 'EXERCISE_UNAVAILABLE', 'La rutina contiene ejercicios no disponibles o sin publicar.');
    for (const step of input.steps) if (new Set(step.alternatives).size !== step.alternatives.length || step.alternatives.includes(step.exerciseId)) throw new HttpError(400, 'INVALID_ALTERNATIVE', 'Las alternativas deben ser distintas del ejercicio principal y entre sí.');
    return found.rows.map(exerciseDTO);
  }
  async createProgram(c: Context, input: ProgramRow['data']): Promise<Program> {
    this.staff(c); await this.validateProgram(c, input, false); const id = randomUUID();
    const found = await c.db.query<ProgramRow>('INSERT INTO b2b_program(id,organization_id,data) VALUES($1,$2,$3) RETURNING *', [id, c.org.id, input]); await this.audit(c, 'program.create', id); return programDTO(found.rows[0]);
  }
  async updateProgram(c: Context, id: string, input: ProgramRow['data'], revision: number): Promise<Program> {
    this.staff(c); await this.validateProgram(c, input, false);
    const found = await c.db.query<ProgramRow>('UPDATE b2b_program SET data=$3,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$4 RETURNING *', [c.org.id, id, input, revision]);
    if (!found.rows[0]) throw conflict(); await this.audit(c, 'program.update', id); return programDTO(found.rows[0]);
  }
  async publishProgram(c: Context, id: string, revision: number): Promise<ProgramVersion> {
    this.staff(c); const row = (await c.db.query<ProgramRow>('SELECT * FROM b2b_program WHERE organization_id=$1 AND id=$2', [c.org.id, id])).rows[0];
    if (!row) throw missing(); if (row.revision !== revision) throw conflict();
    const exercises = await this.validateProgram(c, row.data, true); const version = (row.published_version ?? 0) + 1;
    const machineIds = [...new Set(exercises.flatMap(e => [...(e.machineId ? [e.machineId] : []), ...e.compatibleMachineIds]))];
    const machines = (await c.db.query<MachineRow>("SELECT * FROM b2b_machine WHERE id=ANY($1::text[]) AND (organization_id IS NULL OR organization_id=$2) AND status='published'", [machineIds, c.org.id])).rows.map(machineDTO);
    if (machines.length !== machineIds.length) throw new HttpError(409, 'MODEL_UNPUBLISHED', 'Revisá y publicá los modelos de la rutina.');
    const snapshot: ProgramVersion = { ...row.data, programId: id, version, exercises, machines, publishedAt: new Date().toISOString() };
    await c.db.query('INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot) VALUES($1,$2,$3,$4)', [c.org.id, id, version, snapshot]);
    await c.db.query('UPDATE b2b_program SET published_version=$3,revision=revision+1 WHERE organization_id=$1 AND id=$2', [c.org.id, id, version]);
    await this.audit(c, 'program.publish', id); return snapshot;
  }
  async programVersion(c: Context, id: string, version: number): Promise<ProgramVersion> {
    this.staff(c); const row = (await c.db.query<{ snapshot: ProgramVersion }>('SELECT snapshot FROM b2b_program_version WHERE organization_id=$1 AND program_id=$2 AND version=$3', [c.org.id, id, version])).rows[0];
    if (!row) throw missing(); return row.snapshot;
  }
  availability(snapshot: ProgramVersion, activeModels: Set<string>): StepAvailability[] {
    return snapshot.steps.map(step => ({ stepId: step.id, exercises: [step.exerciseId, ...step.alternatives].map(exerciseId => {
      const exercise = snapshot.exercises.find(e => e.id === exerciseId);
      if (!exercise) return { exerciseId, status: 'unavailable' as const, equipment: '' };
      const models = [...(exercise.machineId ? [exercise.machineId] : []), ...exercise.compatibleMachineIds];
      const status = models.length ? models.some(id => activeModels.has(id)) ? 'available' as const : 'unavailable' as const : exercise.equipment && exercise.equipment !== 'none' ? 'equipment-required' as const : 'available' as const;
      return { exerciseId, status, equipment: exercise.equipment };
    }) }));
  }
  async activeModels(c: Context): Promise<Set<string>> { return new Set((await c.db.query<{ machine_id: string }>('SELECT DISTINCT machine_id FROM b2b_unit WHERE organization_id=$1 AND NOT archived', [c.org.id])).rows.map(r => r.machine_id)); }
  async assignments(c: Context, memberId?: string): Promise<Assignment[]> {
    if (memberId) await this.memberAccess(c, memberId);
    const found = await c.db.query<{ id: string; member_id: string; name: string; assigned_by: string; created_at: Date; snapshot: ProgramVersion }>(`SELECT a.*,u.name,v.snapshot FROM b2b_program_assignment a JOIN b2b_auth_user u ON u.id=a.member_id JOIN b2b_program_version v ON v.organization_id=a.organization_id AND v.program_id=a.program_id AND v.version=a.version
      WHERE a.organization_id=$1 AND ($4::text IS NULL OR a.member_id=$4) AND ($3='admin' OR ($3='member' AND a.member_id=$2) OR ($3='coach' AND EXISTS(SELECT 1 FROM b2b_coach_assignment ca WHERE ca.organization_id=a.organization_id AND ca.member_id=a.member_id AND ca.coach_id=$2))) ORDER BY a.created_at DESC,a.id`, [c.org.id, c.actorId, c.role, memberId ?? null]);
    const models = await this.activeModels(c);
    return found.rows.map(r => ({ id: r.id, memberId: r.member_id, memberName: r.name, assignedBy: r.assigned_by, createdAt: r.created_at.toISOString(), program: r.snapshot, availability: this.availability(r.snapshot, models) }));
  }
  async assignProgram(c: Context, input: { memberId: string; programId: string; version: number }): Promise<Assignment> {
    this.staff(c); await this.memberAccess(c, input.memberId);
    const snapshot = (await c.db.query<{ snapshot: ProgramVersion }>('SELECT snapshot FROM b2b_program_version WHERE organization_id=$1 AND program_id=$2 AND version=$3', [c.org.id, input.programId, input.version])).rows[0]?.snapshot;
    if (!snapshot) throw missing();
    const unavailable = this.availability(snapshot, await this.activeModels(c)).find(step => step.exercises.every(e => e.status === 'unavailable'));
    if (unavailable) {
      const step = snapshot.steps.find(s => s.id === unavailable.stepId)!; const name = snapshot.exercises.find(e => e.id === step.exerciseId)?.name ?? step.id;
      throw new HttpError(409, 'EQUIPMENT_UNAVAILABLE', `No hay un equipo activo para “${name}” ni para sus alternativas permitidas. Revisá el inventario o publicá otra versión.`);
    }
    const id = randomUUID(); await c.db.query('INSERT INTO b2b_program_assignment(id,organization_id,member_id,program_id,version,assigned_by) VALUES($1,$2,$3,$4,$5,$6)', [id, c.org.id, input.memberId, input.programId, input.version, c.actorId]);
    await this.audit(c, 'program.assign', id); return (await this.assignments(c, input.memberId)).find(a => a.id === id)!;
  }
  async executions(c: Context, memberId?: string): Promise<Execution[]> {
    if (memberId) await this.memberAccess(c, memberId);
    const found = await c.db.query<{ data: ExecutionInput; member_id: string; name: string; created_at: Date; snapshot: ProgramVersion }>(`SELECT e.*,u.name,v.snapshot FROM b2b_execution e JOIN b2b_auth_user u ON u.id=e.member_id JOIN b2b_program_assignment a ON a.organization_id=e.organization_id AND a.id=e.assignment_id JOIN b2b_program_version v ON v.organization_id=a.organization_id AND v.program_id=a.program_id AND v.version=a.version
      WHERE e.organization_id=$1 AND ($4::text IS NULL OR e.member_id=$4) AND ($3='admin' OR ($3='member' AND e.member_id=$2) OR ($3='coach' AND EXISTS(SELECT 1 FROM b2b_coach_assignment ca WHERE ca.organization_id=e.organization_id AND ca.member_id=e.member_id AND ca.coach_id=$2))) ORDER BY e.created_at DESC,e.id`, [c.org.id, c.actorId, c.role, memberId ?? null]);
    return found.rows.map(r => ({ ...r.data, memberId: r.member_id, memberName: r.name, createdAt: r.created_at.toISOString(), program: r.snapshot }));
  }
  async recordExecution(c: Context, input: ExecutionInput): Promise<Execution> {
    if (c.role !== 'member') throw denied();
    const assignment = (await this.assignments(c)).find(a => a.id === input.assignmentId); if (!assignment) throw missing();
    if (new Date(input.completedAt).getTime() > Date.now() + 5 * 60000) throw new HttpError(400, 'FUTURE_EXECUTION', 'La actividad no puede estar en el futuro.');
    const steps = new Map(assignment.program.steps.map(s => [s.id, s]));
    for (const set of input.sets) {
      const step = steps.get(set.stepId);
      if (!step || set.set > step.sets) throw new HttpError(400, 'INVALID_SET', 'La serie no pertenece a la rutina asignada.');
      if (set.exerciseId !== step.exerciseId && (!step.alternatives.includes(set.exerciseId) || !set.reason.trim())) throw new HttpError(400, 'INVALID_SUBSTITUTION', 'La sustitución debe estar permitida y explicar el motivo.');
    }
    if (input.status === 'completed' && assignment.program.steps.some(step => Array.from({ length: step.sets }, (_, i) => i + 1).some(number => !input.sets.some(s => s.stepId === step.id && s.set === number && s.reps > 0)))) throw new HttpError(400, 'INCOMPLETE_EXECUTION', 'Completá todas las series o guardá la sesión como parcial.');
    const prior = await c.db.query<{ member_id: string; data: ExecutionInput }>('SELECT member_id,data FROM b2b_execution WHERE organization_id=$1 AND id=$2', [c.org.id, input.id]);
    if (prior.rows[0]) {
      if (prior.rows[0].member_id !== c.actorId || !isDeepStrictEqual(prior.rows[0].data, input)) throw new HttpError(409, 'EXECUTION_CONFLICT', 'Ese identificador ya pertenece a otro registro.');
    } else {
      const unavailableSet = input.sets.find(set => assignment.availability.find(step => step.stepId === set.stepId)?.exercises.find(e => e.exerciseId === set.exerciseId)?.status === 'unavailable');
      if (unavailableSet) {
        const name = assignment.program.exercises.find(e => e.id === unavailableSet.exerciseId)?.name ?? unavailableSet.exerciseId;
        throw new HttpError(409, 'EQUIPMENT_UNAVAILABLE', `El equipo para “${name}” ya no está activo. Elegí una alternativa permitida o consultá a tu instructor.`);
      }
      await c.db.query('INSERT INTO b2b_execution(organization_id,id,member_id,assignment_id,data) VALUES($1,$2,$3,$4,$5)', [c.org.id, input.id, c.actorId, input.assignmentId, input]); await this.audit(c, 'execution.create', input.id);
    }
    return (await this.executions(c)).find(e => e.id === input.id)!;
  }
  async report(c: Context): Promise<Report> {
    this.staff(c); const members = (await this.members(c)).filter(m => m.role === 'member' && m.active); const assignments = await this.assignments(c); const executions = await this.executions(c);
    return { members: members.map(m => { const logs = executions.filter(e => e.memberId === m.userId); return { userId: m.userId, name: m.name, assignments: assignments.filter(a => a.memberId === m.userId).length, completed: logs.filter(e => e.status === 'completed').length, partial: logs.filter(e => e.status === 'partial').length, lastActivityAt: logs.map(e => e.completedAt).sort().at(-1) ?? null }; }), executions };
  }
  async publicSite(slug: string, unitId?: string): Promise<PublicSite | PublicUnit> {
    return this.transaction(async db => {
      const org = (await db.query<OrgRow>('SELECT * FROM b2b_organization WHERE slug=$1', [slug])).rows[0]; if (!org) throw missing();
      const site = (await db.query<WebsiteRow>('SELECT * FROM b2b_website WHERE organization_id=$1', [org.id])).rows[0]; if (!site?.published) throw missing();
      // Explicit current public references only. Drafts and historical snapshots are never public.
      const organization = { id: org.id, slug: org.slug, brand: site.published.brand };
      const machines = (await db.query<MachineRow>("SELECT * FROM b2b_machine WHERE (organization_id IS NULL OR organization_id=$1) AND status='published'", [org.id])).rows.map(machineDTO);
      const units = (await db.query<UnitRow>('SELECT * FROM b2b_unit WHERE organization_id=$1 AND public AND NOT archived', [org.id])).rows.filter(r => machines.some(m => m.id === r.machine_id)).map(r => unitDTO(r, org.slug));
      const exercises = (await db.query<ExerciseRow>("SELECT * FROM b2b_exercise WHERE (organization_id IS NULL OR organization_id=$1) AND status='published'", [org.id])).rows.map(exerciseDTO).filter(e => [...(e.machineId ? [e.machineId] : []), ...e.compatibleMachineIds].every(id => machines.some(m => m.id === id)));
      if (!unitId) return { organization, website: site.published.content, units, machines, exercises };
      const unit = units.find(u => u.id === unitId); if (!unit) throw missing(); const machine = machines.find(m => m.id === unit.machineId); if (!machine) throw missing();
      return { organization, unit, machine, exercises: exercises.filter(e => e.machineId === machine.id || e.compatibleMachineIds.includes(machine.id)) };
    });
  }
  async limit(key: string, max = 20) {
    const found = await this.pool.query<{ count: number }>(`INSERT INTO b2b_public_rate_limit(key,count,expires_at) VALUES($1,1,now()+interval '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN b2b_public_rate_limit.expires_at<=now() THEN 1 ELSE b2b_public_rate_limit.count+1 END,expires_at=CASE WHEN b2b_public_rate_limit.expires_at<=now() THEN now()+interval '1 minute' ELSE b2b_public_rate_limit.expires_at END RETURNING count`, [key]);
    if (found.rows[0].count > max) throw new HttpError(429, 'RATE_LIMITED', 'Demasiados intentos. Probá en un minuto.');
  }
}

/** Immutable initial snapshots: shared package data are copied, never read from B2C. */
export async function seedBaseCatalog(db: PoolClient) {
  for (const base of baseExercises) {
    const data = ExerciseInputSchema.parse({ name: base.name, description: base.description, instructions: [...base.setup, ...base.steps, ...base.cues], equipment: base.equipment, muscles: base.primaryMuscles, pattern: base.pattern, animationId: base.id, assets: [{ id: `base-${base.id}-poster-v1`, kind: 'image', label: base.name, url: `/previews/${base.id}-poster.webp`, attribution: 'Klisteni exercise preview; see /models/NOTICE.md for anatomical model attribution.' }] });
    await db.query("INSERT INTO b2b_exercise(id,data,status,version) VALUES($1,$2,'published',1) ON CONFLICT(id) DO NOTHING", [base.id, data]);
  }
  const models = [
    { id: 'base-cable-station-v1', name: 'Estación de poleas', type: 'cable', manufacturer: 'Genérico', model: 'Biblioteca v1', instructions: 'Ajustá el anclaje y seleccioná la carga con la máquina detenida.' },
    { id: 'base-chest-press-v1', name: 'Press de pecho guiado', type: 'chest-press', manufacturer: 'Genérico', model: 'Biblioteca v1', instructions: 'Identificá los ajustes y topes de seguridad con un instructor antes de usar el equipo.' },
    { id: 'base-leg-press-v1', name: 'Prensa de piernas', type: 'leg-press', manufacturer: 'Genérico', model: 'Biblioteca v1', instructions: 'Ajustá el respaldo y los topes según las indicaciones del instructor.' },
  ];
  for (const { id, ...data } of models) await db.query("INSERT INTO b2b_machine(id,data,status) VALUES($1,$2,'published') ON CONFLICT(id) DO NOTHING", [id, MachineInputSchema.parse(data)]);
  // Editorial templates require local human review; no unsupported animation or model is invented.
  const templates = [
    { id: 'template-cable-row-v1', name: 'Remo en polea sentado', machineId: 'base-cable-station-v1', pattern: 'Tracción horizontal', muscles: ['lats', 'biceps'], instructions: ['Revisá con el instructor la altura del anclaje, el agarre y la posición del asiento.', 'Con el tronco estable, acercá el agarre al torso en un recorrido cómodo.', 'Regresá con control sin soltar la carga.'] },
    { id: 'template-cable-pulldown-v1', name: 'Jalón en polea', machineId: 'base-cable-station-v1', pattern: 'Tracción vertical', muscles: ['lats', 'biceps'], instructions: ['Comprobá con el instructor que la estación y el agarre admitan el movimiento.', 'Llevá el agarre hacia la zona superior del torso sin balancearte.', 'Volvé con control siguiendo el recorrido indicado por el instructor.'] },
    { id: 'template-cable-curl-v1', name: 'Curl en polea', machineId: 'base-cable-station-v1', pattern: 'Flexión de codo', muscles: ['biceps'], instructions: ['Ajustá el anclaje bajo y el agarre con la máquina detenida.', 'Flexioná los codos manteniendo el tronco estable.', 'Descendé con control hasta la posición acordada con tu instructor.'] },
    { id: 'template-leg-press-v1', name: 'Prensa de piernas', machineId: 'base-leg-press-v1', pattern: 'Empuje de piernas', muscles: ['quadriceps', 'glutes'], instructions: ['Revisá asiento, topes y posición de los pies con el instructor.', 'Empujá la plataforma sin perder el apoyo del tronco.', 'Regresá con control dentro del recorrido indicado para vos.'] },
    { id: 'template-leg-press-calf-v1', name: 'Elevación de talones en prensa', machineId: 'base-leg-press-v1', pattern: 'Flexión plantar', muscles: ['calves'], instructions: ['Confirmá con el instructor que el modelo permita este uso y cómo asegurar los topes.', 'Realizá la elevación de talones manteniendo un apoyo estable.', 'Descendé lentamente dentro del recorrido autorizado.'] },
    { id: 'template-chest-press-v1', name: 'Press de pecho guiado', machineId: 'base-chest-press-v1', pattern: 'Empuje horizontal', muscles: ['pectorals', 'triceps'], instructions: ['Ajustá asiento y agarres según tu cuerpo con asistencia del instructor.', 'Empujá manteniendo el tronco apoyado y las muñecas alineadas.', 'Volvé sin golpes al recorrido inicial indicado.'] },
  ];
  for (const { id, ...template } of templates) {
    const data = ExerciseInputSchema.parse({ ...template, description: 'Plantilla editorial de referencia: adaptar al equipo real y revisar antes de publicar.', equipment: 'machine', compatibleMachineIds: [template.machineId] });
    await db.query("INSERT INTO b2b_exercise(id,data,status,version) VALUES($1,$2,'draft',1) ON CONFLICT(id) DO NOTHING", [id, data]);
  }
}
export { BrandInputSchema };
