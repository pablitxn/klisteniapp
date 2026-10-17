import {
  ProductMemberSchema,
  UpdateProductMemberSchema,
  InviteProductMemberSchema,
  ProductInvitationSchema,
} from './product-access.ts'
import { z } from 'zod'
import { IdSchema, RevisionSchema } from './common.ts'
import {
  AuditChangeSchema,
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
