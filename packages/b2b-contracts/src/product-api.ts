import {
  ProductMemberSchema,
  UpdateProductMemberSchema,
  InviteProductMemberSchema,
  ProductInvitationSchema,
} from './product-access.ts'
import { z } from 'zod'
import {
  LegacySupplementPreviewSchema,
  AdoptLegacySupplementSchema,
  SessionBindingSchema,
} from './product-legacy-adoption.ts'
import { LegacySupplementSchema } from './product-compatibility.ts'
import { IdSchema, RevisionSchema, TimestampSchema } from './common.ts'
import { ExerciseSchema } from './catalog.ts'
import {
  AuditChangeSchema,
  MemberScopeSchema,
  ProductScopeSchema,
  OperationSchema,
  OperationReceiptSchema,
  ProductAccessSchema,
  ProductCapabilitiesSchema,
} from './product-common.ts'
import {
  RoutineDraftContentSchema,
  RoutineDraftV2Schema,
  RoutineVersionV2Schema,
  ReviewedRelationSchema,
  RoutineReferenceSchema,
} from './product-prescription.ts'
import {
  ApplyPeriodSchema,
  EnrollmentSchema,
  GoalProgramContentSchema,
  GoalProgramDraftContentSchema,
  GoalProgramSchema,
  OccurrenceSchema,
  PeriodPreviewSchema,
  RoutineContinuitySchema,
  WeekSchema,
  WeekSummarySchema,
} from './product-planning.ts'
import { SaveSessionSchema, SessionReceiptSchema } from './product-sessions.ts'
import {
  ConsentedHealthSchema,
  GrantHealthConsentSchema,
  HealthConsentSchema,
  HealthImportPreviewSchema,
  HealthImportRequestSchema,
  NormalizedHealthSchema,
  OwnHealthSchema,
} from './product-health.ts'
import {
  B2CInvitationSchema,
  PersonalExportSchema,
  SessionRecordSchema,
  StoredRoutineSchema,
} from './product-compatibility.ts'

const empty = z.object({}).strict()
const id = z.object({ id: IdSchema }).strict()
const member = z.object({ memberId: IdSchema }).strict()
const operation = OperationSchema.extend({ id: IdSchema }).strict()
function endpoint<I extends z.ZodType, O extends z.ZodType>(
  method: 'GET' | 'POST',
  path: string,
  input: I,
  output: O,
  scope: 'organization' | 'self' = 'organization',
) {
  return {
    method,
    path: scope === 'self' ? `/self${path}` : `/product/v2${path}`,
    scope,
    input,
    output,
  } as const
}
/** Named static seams. WP00 installs no business routes; ACCESS registers these
 * only after a complete authorized service exists. Tenant comes from context. */
export const ProductEndpoints = {
  capabilities: endpoint('GET', '/capabilities', empty, ProductCapabilitiesSchema),
  access: endpoint('GET', '/access', empty, ProductAccessSchema),
  people: endpoint('GET', '/people', empty, z.array(ProductMemberSchema)),
  invitationBranches: endpoint(
    'GET',
    '/invitation-branches',
    empty,
    z
      .array(
        z
          .object({
            organizationId: IdSchema,
            branchId: IdSchema,
            name: z.string().min(1).max(100),
            status: z.enum(['active', 'archived']),
          })
          .strict(),
      )
      .refine(
        (rows) => new Set(rows.map((row) => row.branchId)).size === rows.length,
        'Branch IDs must be unique',
      ),
  ),
  updateMember: endpoint(
    'POST',
    '/people/:memberId',
    UpdateProductMemberSchema,
    ProductMemberSchema,
  ),
  inviteMember: endpoint(
    'POST',
    '/invitations/:id',
    InviteProductMemberSchema,
    ProductInvitationSchema,
  ),
  audit: endpoint('GET', '/audit/:id', id, z.array(AuditChangeSchema)),
  workoutEquipment: endpoint(
    'GET',
    '/workout-equipment',
    empty,
    z.object({ activeMachineIds: z.array(IdSchema) }).strict(),
  ),
  routineSupplement: endpoint(
    'GET',
    '/routines/:id/versions/:version/supplement',
    id.extend({ version: z.number().int().positive() }),
    RoutineVersionV2Schema.nullable(),
  ),
  legacySupplementPreview: endpoint(
    'GET',
    '/legacy-assignments/:id/supplement-preview',
    id,
    LegacySupplementPreviewSchema,
  ),
  adoptLegacySupplement: endpoint(
    'POST',
    '/legacy-assignments/:id/supplement',
    AdoptLegacySupplementSchema,
    LegacySupplementSchema,
  ),
  sessionBinding: endpoint('GET', '/sessions/:id/binding', id, SessionBindingSchema),
  legacyAssignments: endpoint(
    'GET',
    '/members/:memberId/legacy-assignments',
    member,
    z.array(
      z
        .object({
          schemaVersion: z.literal(2),
          id: IdSchema,
          scope: MemberScopeSchema,
          active: z.boolean(),
          assignedBy: IdSchema,
          createdAt: TimestampSchema,
          routine: RoutineReferenceSchema,
          name: z.string(),
          archivedAt: TimestampSchema.nullable(),
        })
        .strict(),
    ),
  ),
  enrollmentRevision: endpoint(
    'GET',
    '/enrollments/:id/revisions/:revision',
    id.extend({ revision: RevisionSchema }),
    z
      .object({ enrollment: EnrollmentSchema, actorId: IdSchema, recordedAt: TimestampSchema })
      .strict(),
  ),
  occurrence: endpoint(
    'GET',
    '/occurrences/:id',
    id,
    z.object({ occurrence: OccurrenceSchema, enrollment: EnrollmentSchema }).strict(),
  ),
  historySubjects: endpoint(
    'GET',
    '/history-subjects',
    empty,
    z
      .object({
        schemaVersion: z.literal(2),
        scope: ProductScopeSchema,
        members: z.array(
          z.object({ userId: IdSchema, name: z.string(), active: z.boolean() }).strict(),
        ),
      })
      .strict(),
  ),
  catalogExercises: endpoint('GET', '/catalog/exercises', empty, z.array(ExerciseSchema)),
  routinePublications: endpoint(
    'GET',
    '/routine-publications',
    empty,
    z.array(z.object({ name: z.string(), reference: RoutineReferenceSchema }).strict()),
  ),
  routineVersion: endpoint(
    'GET',
    '/routines/:id/versions/:version',
    id.extend({ version: z.number().int().positive() }),
    StoredRoutineSchema,
  ),
  routines: endpoint('GET', '/routines', empty, z.array(RoutineDraftV2Schema)),
  routine: endpoint('GET', '/routines/:id', id, RoutineDraftV2Schema),
  saveRoutine: endpoint(
    'POST',
    '/routines/:id',
    operation.extend({ content: RoutineDraftContentSchema }),
    RoutineDraftV2Schema,
  ),
  archiveRoutine: endpoint('POST', '/routines/:id/archive', operation, RoutineDraftV2Schema),
  archiveGoal: endpoint('POST', '/goal-programs/:id/archive', operation, GoalProgramSchema),
  endEnrollment: endpoint('POST', '/enrollments/:id/end', operation, EnrollmentSchema),
  publishRoutine: endpoint('POST', '/routines/:id/publish', operation, RoutineVersionV2Schema),
  alternatives: endpoint(
    'GET',
    '/routines/:id/alternatives/:stepId',
    id.extend({ stepId: IdSchema, version: z.number().int().positive() }),
    z.array(ReviewedRelationSchema),
  ),
  goals: endpoint('GET', '/members/:memberId/goals', member, z.array(GoalProgramSchema)),
  saveGoal: endpoint(
    'POST',
    '/members/:memberId/goals/:id',
    operation.extend({ memberId: IdSchema, content: GoalProgramDraftContentSchema }),
    GoalProgramSchema,
  ),
  enroll: endpoint(
    'POST',
    '/members/:memberId/enrollments/:id',
    operation.extend({
      memberId: IdSchema,
      goalProgramId: IdSchema,
      issuedGoalRevision: RevisionSchema,
      content: GoalProgramContentSchema,
    }),
    EnrollmentSchema,
  ),
  continuity: endpoint('GET', '/members/:memberId/continuity', member, RoutineContinuitySchema),
  periodPreview: endpoint(
    'POST',
    '/enrollments/:id/period-preview',
    id.extend({ expectedRevision: RevisionSchema, proposed: GoalProgramContentSchema }),
    PeriodPreviewSchema,
  ),
  applyPeriod: endpoint(
    'POST',
    '/enrollments/:enrollmentId/period',
    ApplyPeriodSchema,
    EnrollmentSchema,
  ),
  occurrences: endpoint(
    'GET',
    '/members/:memberId/occurrences',
    member.extend({ weekStart: WeekSchema.shape.startDate, timeZone: WeekSchema.shape.timeZone }),
    z.array(OccurrenceSchema),
  ),
  moveOccurrence: endpoint(
    'POST',
    '/occurrences/:id/move',
    operation.extend({ scheduledDate: OccurrenceSchema.shape.scheduledDate }),
    OccurrenceSchema,
  ),
  week: endpoint(
    'GET',
    '/members/:memberId/week',
    member.extend({ weekStart: WeekSchema.shape.startDate, timeZone: WeekSchema.shape.timeZone }),
    WeekSummarySchema,
  ),
  sessions: endpoint('GET', '/members/:memberId/sessions', member, z.array(SessionRecordSchema)),
  sessionRevisions: endpoint('GET', '/sessions/:id/revisions', id, z.array(SessionRecordSchema)),
  saveSession: endpoint('POST', '/sessions/:id/revisions', SaveSessionSchema, SessionReceiptSchema),
  ownHealth: endpoint('GET', '/health/own', empty, OwnHealthSchema),
  saveOwnHealth: endpoint(
    'POST',
    '/health/own',
    OperationSchema.extend({ data: NormalizedHealthSchema }),
    OwnHealthSchema,
  ),
  previewHealthImport: endpoint(
    'POST',
    '/health/import-preview',
    HealthImportRequestSchema,
    HealthImportPreviewSchema,
  ),
  applyHealthImport: endpoint(
    'POST',
    '/health/import',
    HealthImportRequestSchema.extend({ previewHash: HealthImportPreviewSchema.shape.previewHash }),
    OwnHealthSchema,
  ),
  healthConsents: endpoint('GET', '/health/consents', empty, z.array(HealthConsentSchema)),
  grantHealthConsent: endpoint(
    'POST',
    '/health/consents/:id',
    GrantHealthConsentSchema,
    HealthConsentSchema,
  ),
  revokeHealthConsent: endpoint(
    'POST',
    '/health/consents/:id/revoke',
    operation,
    HealthConsentSchema,
  ),
  consentedHealth: endpoint('GET', '/members/:memberId/health', member, ConsentedHealthSchema),
  personalExport: endpoint('GET', '/exports', empty, PersonalExportSchema, 'self'),
  b2cInvitation: endpoint('GET', '/b2c-invitation', empty, B2CInvitationSchema, 'self'),
  operationReceipt: endpoint('GET', '/operations/:id', id, OperationReceiptSchema),
} as const
export type ProductEndpoint = keyof typeof ProductEndpoints
export type ProductInput<K extends ProductEndpoint> = z.input<(typeof ProductEndpoints)[K]['input']>
export type ProductOutput<K extends ProductEndpoint> = z.output<
  (typeof ProductEndpoints)[K]['output']
>
export type ProductService<Context> = {
  [K in ProductEndpoint]: (context: Context, input: ProductInput<K>) => Promise<ProductOutput<K>>
}
