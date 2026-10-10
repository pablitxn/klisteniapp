import { z } from 'zod';

export const API_PREFIX = '/api/b2b';
export const IdSchema = z.string().min(1).max(160).regex(/^[a-zA-Z0-9_-]+$/);
export const RoleSchema = z.enum(['admin', 'coach', 'member']);
export type Role = z.infer<typeof RoleSchema>;
export const AssetSchema = z.object({
  id: IdSchema, kind: z.enum(['image', 'video', 'model3d']),
  url: z.string().max(2048).refine(value => /^https:\/\/[^\s]+$/.test(value) || /^\/(?!\/)[a-zA-Z0-9_./%-]+$/.test(value), 'Use HTTPS or a local asset path'),
  label: z.string().trim().min(1).max(200), attribution: z.string().max(1000).default(''),
}).strict();
export type Asset = z.infer<typeof AssetSchema>;
export type Media = Asset & { mime: string; bytes: number; sha256: string; createdAt: string };
export const ContentStatusSchema = z.enum(['draft', 'reviewed', 'published']);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export const WebsiteInputSchema = z.object({
  headline: z.string().trim().max(200).default(''), introduction: z.string().max(4000).default(''),
  activities: z.array(z.object({ id: IdSchema, name: z.string().trim().min(1).max(100), description: z.string().max(1000).default(''), schedule: z.string().max(300).default('') }).strict()).max(30).default([]),
  openingHours: z.array(z.object({ id: IdSchema, days: z.string().trim().min(1).max(100), hours: z.string().trim().min(1).max(150) }).strict()).max(21).default([]),
  gallery: z.array(AssetSchema).max(20).default([]),
}).strict();
export type WebsiteInput = z.infer<typeof WebsiteInputSchema>;
export const WebsiteUpdateSchema = WebsiteInputSchema.extend({ expectedRevision: z.number().int().nonnegative() });
export type Website = { draft: WebsiteInput; revision: number; publishedRevision: number | null; publishedAt: string | null };
export type SetupProgress = { completed: number; total: number; websitePublished: boolean; checks: Array<{ id: 'brand' | 'inventory' | 'content' | 'activities' | 'hours' | 'gallery' | 'website'; label: string; complete: boolean }> };
export const MediaUploadSchema = z.object({ kind: AssetSchema.shape.kind, label: AssetSchema.shape.label, attribution: AssetSchema.shape.attribution }).strict();
export const BrandInputSchema = z.object({
  name: z.string().trim().min(1).max(100), description: z.string().max(2000).default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#235c4b'),
  logoUrl: z.union([AssetSchema.shape.url, z.literal('')]).default(''),
  contact: z.string().max(200).default(''), address: z.string().max(300).default(''),
}).strict();
export type Brand = z.infer<typeof BrandInputSchema>;
export type Organization = { id: string; slug: string; brand: Brand; serviceActive: boolean; serviceEndsAt: string | null };
export type Membership = { organization: Organization; role: Role };
export type Me = { user: { id: string; name: string; email: string }; memberships: Membership[] };
export type Member = { userId: string; name: string; email: string; role: Role; active: boolean; coachIds: string[] };
export const InvitationInputSchema = z.object({ email: z.email().max(254).transform(v => v.toLowerCase()), name: z.string().trim().min(1).max(100), role: RoleSchema }).strict();
export const AcceptInvitationSchema = z.object({ token: z.string().min(32).max(200), name: z.string().trim().min(1).max(100), password: z.string().min(12).max(128) }).strict();
export const CoachAssignmentSchema = z.object({ coachId: IdSchema, memberId: IdSchema }).strict();
export const MembershipUpdateSchema = z.object({ role: RoleSchema.optional(), active: z.boolean().optional() }).strict().refine(v => v.role !== undefined || v.active !== undefined, 'Choose a change');

export const MachineInputSchema = z.object({
  name: z.string().trim().min(1).max(150), type: z.string().trim().min(1).max(100),
  manufacturer: z.string().max(100).default(''), model: z.string().max(100).default(''),
  instructions: z.string().max(5000).default(''), assets: z.array(AssetSchema).max(10).default([]),
  derivedFromId: IdSchema.nullable().default(null), derivedFromVersion: z.number().int().positive().nullable().default(null),
}).strict();
export type Machine = z.infer<typeof MachineInputSchema> & { id: string; scope: 'base' | 'organization'; version: number; revision: number; status: ContentStatus };
export const MachineUpdateSchema = MachineInputSchema.extend({ expectedRevision: z.number().int().nonnegative() });
export const UnitInputSchema = z.object({ machineId: IdSchema, label: z.string().trim().min(1).max(100), location: z.string().max(200).default(''), assets: z.array(AssetSchema).max(10).default([]), adjustments: z.string().max(3000).default(''), archived: z.boolean().default(false), public: z.boolean().default(true) }).strict();
export const UnitUpdateSchema = UnitInputSchema.extend({ expectedRevision: z.number().int().nonnegative() });
export type Unit = z.infer<typeof UnitInputSchema> & { id: string; publicPath: string; revision: number };
export const UnitBatchSchema = z.object({ id: IdSchema, units: z.array(UnitInputSchema).min(1).max(20) }).strict();
export const ExerciseInputSchema = z.object({
  name: z.string().trim().min(1).max(150), description: z.string().max(3000).default(''),
  instructions: z.array(z.string().trim().min(1).max(1000)).min(1).max(30),
  equipment: z.string().max(150).default('none'), machineId: IdSchema.nullable().default(null),
  compatibleMachineIds: z.array(IdSchema).max(30).default([]), pattern: z.string().max(150).default(''), muscles: z.array(z.string().max(100)).max(30).default([]),
  animationId: IdSchema.nullable().default(null),
  assets: z.array(AssetSchema).max(10).default([]), baseExerciseId: IdSchema.nullable().default(null),
}).strict();
export type Exercise = z.infer<typeof ExerciseInputSchema> & { id: string; scope: 'base' | 'organization'; status: ContentStatus; version: number; revision: number };
export const ExerciseUpdateSchema = ExerciseInputSchema.extend({ expectedRevision: z.number().int().nonnegative() });
export const PublishSchema = z.object({ expectedRevision: z.number().int().nonnegative() }).strict();
export const ProgramStepSchema = z.object({
  id: IdSchema, exerciseId: IdSchema, sets: z.number().int().min(1).max(30),
  reps: z.number().int().min(1).max(1000), loadKg: z.number().min(0).max(1000).nullable().default(null),
  restSeconds: z.number().int().min(0).max(3600).default(60),
  alternatives: z.array(IdSchema).max(10).default([]), notes: z.string().max(1000).default(''),
}).strict();
export type ProgramStep = z.infer<typeof ProgramStepSchema>;
export const ProgramInputSchema = z.object({ name: z.string().trim().min(1).max(150), description: z.string().max(2000).default(''), steps: z.array(ProgramStepSchema).min(1).max(100) }).strict().refine(v => new Set(v.steps.map(s => s.id)).size === v.steps.length, 'Step IDs must be unique');
export type Program = z.infer<typeof ProgramInputSchema> & { id: string; publishedVersion: number | null; revision: number };
export const ProgramUpdateSchema = z.object({ ...ProgramInputSchema.shape, expectedRevision: z.number().int().nonnegative() }).strict().refine(v => new Set(v.steps.map(s => s.id)).size === v.steps.length, 'Step IDs must be unique');
export type ProgramVersion = z.infer<typeof ProgramInputSchema> & { programId: string; version: number; exercises: Exercise[]; machines: Machine[]; publishedAt: string };
export const ProgramAssignmentSchema = z.object({ memberId: IdSchema, programId: IdSchema, version: z.number().int().positive() }).strict();
export type StepAvailability = { stepId: string; exercises: Array<{ exerciseId: string; status: 'available' | 'unavailable' | 'equipment-required'; equipment: string }> };
export type Assignment = { id: string; memberId: string; memberName: string; assignedBy: string; createdAt: string; program: ProgramVersion; availability: StepAvailability[] };
export const ExecutionSetSchema = z.object({ stepId: IdSchema, set: z.number().int().min(1).max(30), exerciseId: IdSchema, reps: z.number().int().min(0).max(1000), loadKg: z.number().min(0).max(1000).nullable().default(null), reason: z.string().max(1000).default('') }).strict();
export const ExecutionInputSchema = z.object({
  id: IdSchema, assignmentId: IdSchema, status: z.enum(['partial', 'completed']),
  sets: z.array(ExecutionSetSchema).min(1).max(3000), notes: z.string().max(2000).default(''),
  completedAt: z.iso.datetime({ offset: true }),
}).strict().refine(v => new Set(v.sets.map(s => `${s.stepId}:${s.set}`)).size === v.sets.length, 'Duplicate sets');
export type ExecutionInput = z.infer<typeof ExecutionInputSchema>;
export type Execution = ExecutionInput & { memberId: string; memberName: string; createdAt: string; program: ProgramVersion };
export type Report = { members: Array<{ userId: string; name: string; assignments: number; completed: number; partial: number; lastActivityAt: string | null }>; executions: Execution[] };
export type PublicSite = { organization: Pick<Organization, 'id' | 'slug' | 'brand'>; website: WebsiteInput; units: Unit[]; machines: Machine[]; exercises: Exercise[] };
export type PublicUnit = { organization: Pick<Organization, 'id' | 'slug' | 'brand'>; unit: Unit; machine: Machine; exercises: Exercise[] };

/** Route contract: all responses are JSON; failures {error:string,code:string}.
 * Auth: POST /auth/sign-in/email {email,password}, POST /auth/sign-out {}, GET /auth/get-session (Better Auth payload).
 * GET /me -> Me (401 logged out).
 * POST /invitations/accept -> {ok:true}; input AcceptInvitationSchema (then explicitly log in).
 * POST /invitations/join {token} -> {ok:true}; existing authenticated B2B user accepts invitation matching their email, without resetting credentials.
 * GET /public/:slug -> PublicSite; GET /public/:slug/units/:id -> PublicUnit (no sessions, people or progress).
 * Organization routes below use /orgs/:orgId; writes require active service contract and member role checks.
 * GET /members -> {members:Member[]} (admin all, coach assigned members + self, member self).
 * POST /invitations -> {url:string,expiresAt:string}; input InvitationInputSchema, admin only.
 * POST /coach-assignments -> {ok:true}; input CoachAssignmentSchema, admin only.
 * PATCH /members/:userId -> {ok:true}; input MembershipUpdateSchema, admin only, last active admin protected; revocations immediate.
 * PUT /brand -> {organization:Organization}; input BrandInputSchema, admin only.
 * GET /machines -> {machines:Machine[]}; POST /machines -> {machine:Machine}; mutations admin only; members see published models.
 * PUT /machines/:id MachineUpdateSchema -> {machine:Machine}; admin, own org only, invalidates review. To adapt a base model POST a new model with derivedFromId/derivedFromVersion.
 * GET /units -> {units:Unit[]}; POST /units -> {unit:Unit}; mutations admin only.
 * PUT /units/:id UnitUpdateSchema -> {unit:Unit}; admin, own org. Archived units disappear from member/public views; public=false removes QR/public listing.
 * GET /exercises -> {exercises:Exercise[]}; member published only, admin/coach includes drafts.
 * POST /exercises -> {exercise:Exercise}; PUT /exercises/:id ExerciseUpdateSchema -> {exercise:Exercise}; admin/coach, own org only.
 * POST /exercises/:id/publish PublishSchema -> {exercise:Exercise}; immutable assigned program snapshots retain old versions.
 * GET /programs -> {programs:Program[]}; POST /programs -> {program:Program}; PUT /programs/:id ProgramUpdateSchema -> {program:Program}; admin/coach.
 * POST /programs/:id/publish PublishSchema -> {version:ProgramVersion}; published exercises and alternatives required.
 * GET /programs/:id/versions/:version -> {version:ProgramVersion}; staff, exact immutable published content for assignment review.
 * GET /assignments[?memberId=...] -> {assignments:Assignment[]}; roles scoped; POST /assignments -> {assignment:Assignment}, admin/assigned coach.
 * Assignment.availability reflects CURRENT physical units separately from the historical program snapshot; equipment-required is a textual requirement without an inventory claim.
 * GET /executions[?memberId=...] -> {executions:Execution[]}; roles scoped; POST /executions -> {execution:Execution}, own member only, idempotent exact retries.
 * GET /reports -> Report; admin/coach, only their permitted members.
 * GET /website -> {website:Website}; PUT /website WebsiteUpdateSchema; POST /website/publish or /website/unpublish PublishSchema -> {website:Website}; admin only. Public site reads published snapshot.
 * GET /setup-progress -> SetupProgress; staff. Derived from actual brand, inventory, published content and website.
 * POST /units/batch UnitBatchSchema -> {units:Unit[]}; atomic, exact retry by id preserves IDs; different content with same id returns409.
 * POST /machines/:id/review or /exercises/:id/review PublishSchema -> {machine:Machine}|{exercise:Exercise}; model admin, exercise admin/coach. Publish requires reviewed state; editing invalidates review.
 * POST /machines/:id/publish PublishSchema -> {machine:Machine}; admin only. Base library is immutable/published.
 * GET /media -> {media:Media[],usage:{bytes:number,quotaBytes:number}}; staff only. POST /media?kind=image|video|model3d&label=...&attribution=... RAW bytes with correct Content-Type, origin/account headers -> {media:Media}, staff only.
 * Media URL GET/HEAD /api/b2b/media/:id supports ranges. Public only while referenced by currently published public content; private access requires current membership and visibility (including own historical assignment).
 */
