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
export type Media = z.infer<typeof MediaSchema>;
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
export type Website = z.infer<typeof WebsiteSchema>;
export type SetupProgress = z.infer<typeof SetupProgressSchema>;
export const MediaUploadSchema = z.object({ kind: AssetSchema.shape.kind, label: AssetSchema.shape.label, attribution: AssetSchema.shape.attribution }).strict();
export const BrandInputSchema = z.object({
  name: z.string().trim().min(1).max(100), description: z.string().max(2000).default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#235c4b'),
  logoUrl: z.union([AssetSchema.shape.url, z.literal('')]).default(''),
  contact: z.string().max(200).default(''), address: z.string().max(300).default(''),
}).strict();
export type Brand = z.infer<typeof BrandInputSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type Membership = z.infer<typeof MembershipSchema>;
export type Me = z.infer<typeof MeSchema>;
export type Member = z.infer<typeof MemberSchema>;
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
export type Machine = z.infer<typeof MachineSchema>;
export const MachineUpdateSchema = MachineInputSchema.extend({ expectedRevision: z.number().int().nonnegative() });
export const UnitInputSchema = z.object({ machineId: IdSchema, label: z.string().trim().min(1).max(100), location: z.string().max(200).default(''), assets: z.array(AssetSchema).max(10).default([]), adjustments: z.string().max(3000).default(''), archived: z.boolean().default(false), public: z.boolean().default(true) }).strict();
export const UnitUpdateSchema = UnitInputSchema.extend({ expectedRevision: z.number().int().nonnegative() });
export type Unit = z.infer<typeof UnitSchema>;
export const UnitBatchSchema = z.object({ id: IdSchema, units: z.array(UnitInputSchema).min(1).max(20) }).strict();
export const ExerciseInputSchema = z.object({
  name: z.string().trim().min(1).max(150), description: z.string().max(3000).default(''),
  instructions: z.array(z.string().trim().min(1).max(1000)).min(1).max(30),
  equipment: z.string().max(150).default('none'), machineId: IdSchema.nullable().default(null),
  compatibleMachineIds: z.array(IdSchema).max(30).default([]), pattern: z.string().max(150).default(''), muscles: z.array(z.string().max(100)).max(30).default([]),
  animationId: IdSchema.nullable().default(null),
  assets: z.array(AssetSchema).max(10).default([]), baseExerciseId: IdSchema.nullable().default(null),
}).strict();
export type Exercise = z.infer<typeof ExerciseSchema>;
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
export type Program = z.infer<typeof ProgramSchema>;
export const ProgramUpdateSchema = z.object({ ...ProgramInputSchema.shape, expectedRevision: z.number().int().nonnegative() }).strict().refine(v => new Set(v.steps.map(s => s.id)).size === v.steps.length, 'Step IDs must be unique');
export type ProgramVersion = z.infer<typeof ProgramVersionSchema>;
export const ProgramAssignmentSchema = z.object({ memberId: IdSchema, programId: IdSchema, version: z.number().int().positive() }).strict();
export type StepAvailability = z.infer<typeof StepAvailabilitySchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
export const ExecutionSetSchema = z.object({ stepId: IdSchema, set: z.number().int().min(1).max(30), exerciseId: IdSchema, reps: z.number().int().min(0).max(1000), loadKg: z.number().min(0).max(1000).nullable().default(null), reason: z.string().max(1000).default('') }).strict();
export const ExecutionInputSchema = z.object({
  id: IdSchema, assignmentId: IdSchema, status: z.enum(['partial', 'completed']),
  sets: z.array(ExecutionSetSchema).min(1).max(3000), notes: z.string().max(2000).default(''),
  completedAt: z.iso.datetime({ offset: true }),
}).strict().refine(v => new Set(v.sets.map(s => `${s.stepId}:${s.set}`)).size === v.sets.length, 'Duplicate sets');
export type ExecutionInput = z.infer<typeof ExecutionInputSchema>;
export type Execution = z.infer<typeof ExecutionSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type PublicSite = z.infer<typeof PublicSiteSchema>;
export type PublicUnit = z.infer<typeof PublicUnitSchema>;

/** Wire schemas require the fields the server promises, including input defaults.
 * Types and nested responses share these schemas so invalid JSON never reaches a view. */
const TimestampSchema = z.iso.datetime({ offset: true });
const RevisionSchema = z.number().int().nonnegative();
const VersionSchema = z.number().int().positive();
const ResponseAssetSchema = AssetSchema.extend({ attribution: AssetSchema.shape.attribution.removeDefault() });
const ResponseBrandSchema = BrandInputSchema.extend({
  description: BrandInputSchema.shape.description.removeDefault(), color: BrandInputSchema.shape.color.removeDefault(),
  logoUrl: BrandInputSchema.shape.logoUrl.removeDefault(), contact: BrandInputSchema.shape.contact.removeDefault(), address: BrandInputSchema.shape.address.removeDefault(),
});
const ResponseWebsiteContentSchema = WebsiteInputSchema.extend({
  headline: WebsiteInputSchema.shape.headline.removeDefault(), introduction: WebsiteInputSchema.shape.introduction.removeDefault(),
  activities: z.array(z.object({ id: IdSchema, name: z.string(), description: z.string(), schedule: z.string() }).strict()),
  openingHours: WebsiteInputSchema.shape.openingHours.removeDefault(), gallery: z.array(ResponseAssetSchema),
});
export const MediaSchema = ResponseAssetSchema.extend({ mime: z.string().min(1), bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/), createdAt: TimestampSchema });
export const WebsiteSchema = z.object({ draft: ResponseWebsiteContentSchema, revision: RevisionSchema, publishedRevision: RevisionSchema.nullable(), publishedAt: TimestampSchema.nullable() }).strict();
export const SetupProgressSchema = z.object({ completed: RevisionSchema, total: RevisionSchema, websitePublished: z.boolean(), checks: z.array(z.object({ id: z.enum(['brand', 'inventory', 'content', 'activities', 'hours', 'gallery', 'website']), label: z.string(), complete: z.boolean() }).strict()) }).strict();
export const OrganizationSchema = z.object({ id: IdSchema, slug: z.string().min(1), brand: ResponseBrandSchema, serviceActive: z.boolean(), serviceEndsAt: TimestampSchema.nullable() }).strict();
export const MembershipSchema = z.object({ organization: OrganizationSchema, role: RoleSchema }).strict();
const UserSchema = z.object({ id: IdSchema, name: z.string(), email: z.email() });
export const MeSchema = z.object({ user: UserSchema, memberships: z.array(MembershipSchema) }).strict();
export const MemberSchema = z.object({ userId: IdSchema, name: z.string(), email: z.email(), role: RoleSchema, active: z.boolean(), coachIds: z.array(IdSchema) }).strict();
const ContentFields = { id: IdSchema, scope: z.enum(['base', 'organization']), status: ContentStatusSchema, version: RevisionSchema, revision: RevisionSchema };
export const MachineSchema = MachineInputSchema.extend({
  ...ContentFields, manufacturer: MachineInputSchema.shape.manufacturer.removeDefault(), model: MachineInputSchema.shape.model.removeDefault(),
  instructions: MachineInputSchema.shape.instructions.removeDefault(), assets: z.array(ResponseAssetSchema),
  derivedFromId: MachineInputSchema.shape.derivedFromId.removeDefault(), derivedFromVersion: MachineInputSchema.shape.derivedFromVersion.removeDefault(),
});
export const UnitSchema = UnitInputSchema.extend({
  id: IdSchema, publicPath: z.string().regex(/^\/g\/[a-z0-9-]+\/units\/[a-zA-Z0-9_-]+$/), revision: RevisionSchema,
  location: UnitInputSchema.shape.location.removeDefault(), assets: z.array(ResponseAssetSchema), adjustments: UnitInputSchema.shape.adjustments.removeDefault(),
  archived: UnitInputSchema.shape.archived.removeDefault(), public: UnitInputSchema.shape.public.removeDefault(),
});
export const ExerciseSchema = ExerciseInputSchema.extend({
  ...ContentFields, description: ExerciseInputSchema.shape.description.removeDefault(), equipment: ExerciseInputSchema.shape.equipment.removeDefault(),
  machineId: ExerciseInputSchema.shape.machineId.removeDefault(), compatibleMachineIds: ExerciseInputSchema.shape.compatibleMachineIds.removeDefault(),
  pattern: ExerciseInputSchema.shape.pattern.removeDefault(), muscles: ExerciseInputSchema.shape.muscles.removeDefault(),
  animationId: ExerciseInputSchema.shape.animationId.removeDefault(), assets: z.array(ResponseAssetSchema), baseExerciseId: ExerciseInputSchema.shape.baseExerciseId.removeDefault(),
});
const ResponseProgramStepSchema = ProgramStepSchema.extend({ loadKg: ProgramStepSchema.shape.loadKg.removeDefault(), restSeconds: ProgramStepSchema.shape.restSeconds.removeDefault(), alternatives: ProgramStepSchema.shape.alternatives.removeDefault(), notes: ProgramStepSchema.shape.notes.removeDefault() });
const ResponseProgramContentSchema = ProgramInputSchema.safeExtend({ description: ProgramInputSchema.shape.description.removeDefault(), steps: z.array(ResponseProgramStepSchema).min(1).max(100) });
export const ProgramSchema = ResponseProgramContentSchema.safeExtend({ id: IdSchema, publishedVersion: VersionSchema.nullable(), revision: RevisionSchema });
// Migrations 002/003 added lineage, revision and editorial status to machine rows,
// while existing published snapshots remained immutable. Decode only those missing
// historical fields; current catalog/public responses still require every field.
const HistoricalMachineSchema = MachineSchema.extend({
  derivedFromId: MachineSchema.shape.derivedFromId.default(null),
  derivedFromVersion: MachineSchema.shape.derivedFromVersion.default(null),
  revision: MachineSchema.shape.revision.default(0),
  status: MachineSchema.shape.status.default('published'),
});
export const ProgramVersionSchema = ResponseProgramContentSchema.safeExtend({ programId: IdSchema, version: VersionSchema, exercises: z.array(ExerciseSchema), machines: z.array(HistoricalMachineSchema), publishedAt: TimestampSchema });
export const StepAvailabilitySchema = z.object({ stepId: IdSchema, exercises: z.array(z.object({ exerciseId: IdSchema, status: z.enum(['available', 'unavailable', 'equipment-required']), equipment: z.string() }).strict()) }).strict();
export const AssignmentSchema = z.object({ id: IdSchema, memberId: IdSchema, memberName: z.string(), assignedBy: IdSchema, createdAt: TimestampSchema, program: ProgramVersionSchema, availability: z.array(StepAvailabilitySchema) }).strict();
export const ExecutionSchema = ExecutionInputSchema.safeExtend({
  notes: ExecutionInputSchema.shape.notes.removeDefault(),
  sets: z.array(ExecutionSetSchema.extend({ loadKg: ExecutionSetSchema.shape.loadKg.removeDefault(), reason: ExecutionSetSchema.shape.reason.removeDefault() })).min(1).max(3000),
  memberId: IdSchema, memberName: z.string(), createdAt: TimestampSchema, program: ProgramVersionSchema,
});
export const ReportSchema = z.object({ members: z.array(z.object({ userId: IdSchema, name: z.string(), assignments: RevisionSchema, completed: RevisionSchema, partial: RevisionSchema, lastActivityAt: TimestampSchema.nullable() }).strict()), executions: z.array(ExecutionSchema) }).strict();
const PublicOrganizationSchema = OrganizationSchema.pick({ id: true, slug: true, brand: true });
export const PublicSiteSchema = z.object({ organization: PublicOrganizationSchema, website: ResponseWebsiteContentSchema, units: z.array(UnitSchema), machines: z.array(MachineSchema), exercises: z.array(ExerciseSchema) }).strict();
export const PublicUnitSchema = z.object({ organization: PublicOrganizationSchema, unit: UnitSchema, machine: MachineSchema, exercises: z.array(ExerciseSchema) }).strict();
export const B2BResponseSchemas = {
  me: MeSchema, publicSite: PublicSiteSchema, publicUnit: PublicUnitSchema,
  ok: z.object({ ok: z.literal(true) }).strict(),
  signIn: z.object({ redirect: z.boolean(), token: z.string(), user: UserSchema, url: z.string().optional() }),
  signOut: z.object({ success: z.literal(true) }),
  members: z.object({ members: z.array(MemberSchema) }).strict(),
  invitation: z.object({ url: z.url(), expiresAt: TimestampSchema }).strict(),
  organization: z.object({ organization: OrganizationSchema }).strict(),
  machines: z.object({ machines: z.array(MachineSchema) }).strict(), machine: z.object({ machine: MachineSchema }).strict(),
  units: z.object({ units: z.array(UnitSchema) }).strict(), unit: z.object({ unit: UnitSchema }).strict(),
  exercises: z.object({ exercises: z.array(ExerciseSchema) }).strict(), exercise: z.object({ exercise: ExerciseSchema }).strict(),
  programs: z.object({ programs: z.array(ProgramSchema) }).strict(), program: z.object({ program: ProgramSchema }).strict(),
  programVersion: z.object({ version: ProgramVersionSchema }).strict(),
  assignments: z.object({ assignments: z.array(AssignmentSchema) }).strict(), assignment: z.object({ assignment: AssignmentSchema }).strict(),
  executions: z.object({ executions: z.array(ExecutionSchema) }).strict(), execution: z.object({ execution: ExecutionSchema }).strict(),
  report: ReportSchema, website: z.object({ website: WebsiteSchema }).strict(), setupProgress: SetupProgressSchema,
  mediaList: z.object({ media: z.array(MediaSchema), usage: z.object({ bytes: RevisionSchema, quotaBytes: RevisionSchema }).strict() }).strict(),
  media: z.object({ media: MediaSchema }).strict(),
};
export type B2BInputs = {
  signIn: { email: string; password: string };
  invitation: z.input<typeof InvitationInputSchema>; acceptInvitation: z.input<typeof AcceptInvitationSchema>;
  membership: z.input<typeof MembershipUpdateSchema>; coachAssignment: z.input<typeof CoachAssignmentSchema>;
  brand: z.input<typeof BrandInputSchema>; machine: z.input<typeof MachineInputSchema>; machineUpdate: z.input<typeof MachineUpdateSchema>;
  unit: z.input<typeof UnitInputSchema>; unitUpdate: z.input<typeof UnitUpdateSchema>; unitBatch: z.input<typeof UnitBatchSchema>;
  exercise: z.input<typeof ExerciseInputSchema>; exerciseUpdate: z.input<typeof ExerciseUpdateSchema>;
  program: z.input<typeof ProgramInputSchema>; programUpdate: z.input<typeof ProgramUpdateSchema>;
  revision: z.input<typeof PublishSchema>; assignment: z.input<typeof ProgramAssignmentSchema>; execution: z.input<typeof ExecutionInputSchema>;
  website: z.input<typeof WebsiteUpdateSchema>; media: z.input<typeof MediaUploadSchema>;
};

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
