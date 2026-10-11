import { z } from 'zod'
import { RevisionSchema, TimestampSchema } from './common.ts'
import { MediaSchema } from './media.ts'
import { MeSchema, MemberSchema, OrganizationSchema, UserSchema } from './organization.ts'
import { ExerciseSchema, MachineSchema, UnitSchema } from './catalog.ts'
import {
  AssignmentSchema,
  ExecutionSchema,
  ProgramSchema,
  ProgramVersionSchema,
  ReportSchema,
} from './training.ts'
import { SetupProgressSchema, WebsiteSchema } from './website.ts'
import { PublicSiteSchema, PublicUnitSchema } from './public.ts'
import {
  BranchSchema,
  BranchCatalogSchema,
  BranchGrantSchema,
  BrandContextSchema,
  ThemeSchema,
  ThemeVersionSchema,
  EffectiveModulesSchema,
  ModuleConfigurationSchema,
} from './white-label.ts'

/** Wire schemas require server-promised fields, including defaults from request parsing.
 * Decode responses before they reach a view; missing fields are protocol errors. */
export const B2BResponseSchemas = {
  availability: z.object({ availability: z.array(BranchCatalogSchema) }).strict(),
  context: BrandContextSchema,
  branches: z.object({ branches: z.array(BranchSchema) }).strict(),
  branch: z.object({ branch: BranchSchema }).strict(),
  branchGrants: z.object({ grants: z.array(BranchGrantSchema) }).strict(),
  theme: z.object({ theme: ThemeSchema }).strict(),
  themeVersions: z.object({ versions: z.array(ThemeVersionSchema) }).strict(),
  modules: z
    .object({
      modules: EffectiveModulesSchema,
      configuration: z.array(ModuleConfigurationSchema),
    })
    .strict(),
  me: MeSchema,
  publicSite: PublicSiteSchema,
  publicUnit: PublicUnitSchema,
  ok: z.object({ ok: z.literal(true) }).strict(),
  signIn: z.object({
    redirect: z.boolean(),
    token: z.string(),
    user: UserSchema,
    url: z.string().optional(),
  }),
  signOut: z.object({ success: z.literal(true) }),
  members: z.object({ members: z.array(MemberSchema) }).strict(),
  invitation: z.object({ url: z.url(), expiresAt: TimestampSchema }).strict(),
  organization: z.object({ organization: OrganizationSchema }).strict(),
  machines: z.object({ machines: z.array(MachineSchema) }).strict(),
  machine: z.object({ machine: MachineSchema }).strict(),
  units: z.object({ units: z.array(UnitSchema) }).strict(),
  unit: z.object({ unit: UnitSchema }).strict(),
  exercises: z.object({ exercises: z.array(ExerciseSchema) }).strict(),
  exercise: z.object({ exercise: ExerciseSchema }).strict(),
  programs: z.object({ programs: z.array(ProgramSchema) }).strict(),
  program: z.object({ program: ProgramSchema }).strict(),
  programVersion: z.object({ version: ProgramVersionSchema }).strict(),
  assignments: z.object({ assignments: z.array(AssignmentSchema) }).strict(),
  assignment: z.object({ assignment: AssignmentSchema }).strict(),
  executions: z.object({ executions: z.array(ExecutionSchema) }).strict(),
  execution: z.object({ execution: ExecutionSchema }).strict(),
  report: ReportSchema,
  website: z.object({ website: WebsiteSchema }).strict(),
  setupProgress: SetupProgressSchema,
  mediaList: z
    .object({
      media: z.array(MediaSchema),
      usage: z.object({ bytes: RevisionSchema, quotaBytes: RevisionSchema }).strict(),
    })
    .strict(),
  media: z.object({ media: MediaSchema }).strict(),
}

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
