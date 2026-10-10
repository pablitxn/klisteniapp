import {
  B2BResponseSchemas as responses,
  AcceptInvitationSchema,
  BrandInputSchema,
  CoachAssignmentSchema,
  ExerciseInputSchema,
  ExerciseUpdateSchema,
  ExecutionInputSchema,
  InvitationInputSchema,
  MachineInputSchema,
  MachineUpdateSchema,
  MediaUploadSchema,
  MembershipUpdateSchema,
  ProgramAssignmentSchema,
  ProgramInputSchema,
  ProgramUpdateSchema,
  PublishSchema,
  UnitInputSchema,
  UnitUpdateSchema,
  UnitBatchSchema,
  WebsiteUpdateSchema,
  type B2BInputs,
} from '@klisteniapp/b2b-contracts'

import { ApiError, createTransport, type ClientOptions, type Parser } from './transport.ts'
export { ApiError, type ClientOptions } from './transport.ts'

function input<T>(schema: Parser<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success)
    throw new ApiError('Revisá los campos de la solicitud.', 400, 'INVALID_INPUT')
  return parsed.data
}
const segment = (value: string) => encodeURIComponent(value)
const orgPath = (orgId: string, route: string) => `/orgs/${segment(orgId)}${route}`
const memberQuery = (memberId?: string) => (memberId ? `?memberId=${segment(memberId)}` : '')

function createEndpoints(accountId?: string, options: ClientOptions = {}) {
  const request = createTransport(accountId, options)
  return {
    me: () => request('/me', responses.me),
    auth: {
      signIn: (body: B2BInputs['signIn']) =>
        request('/auth/sign-in/email', responses.signIn, 'POST', body),
      signOut: () => request('/auth/sign-out', responses.signOut, 'POST', {}),
    },
    public: {
      site: (slug: string) => request(`/public/${segment(slug)}`, responses.publicSite),
      unit: (slug: string, unitId: string) =>
        request(`/public/${segment(slug)}/units/${segment(unitId)}`, responses.publicUnit),
    },
    invitations: {
      accept: (body: B2BInputs['acceptInvitation']) =>
        request('/invitations/accept', responses.ok, 'POST', input(AcceptInvitationSchema, body)),
      join: (body: { token: string }) => request('/invitations/join', responses.ok, 'POST', body),
    },
    members: {
      list: (orgId: string) => request(orgPath(orgId, '/members'), responses.members),
      update: (orgId: string, userId: string, body: B2BInputs['membership']) =>
        request(
          orgPath(orgId, `/members/${segment(userId)}`),
          responses.ok,
          'PATCH',
          input(MembershipUpdateSchema, body),
        ),
      assignCoach: (orgId: string, body: B2BInputs['coachAssignment']) =>
        request(
          orgPath(orgId, '/coach-assignments'),
          responses.ok,
          'POST',
          input(CoachAssignmentSchema, body),
        ),
      invite: (orgId: string, body: B2BInputs['invitation']) =>
        request(
          orgPath(orgId, '/invitations'),
          responses.invitation,
          'POST',
          input(InvitationInputSchema, body),
        ),
    },
    brand: {
      update: (orgId: string, body: B2BInputs['brand']) =>
        request(
          orgPath(orgId, '/brand'),
          responses.organization,
          'PUT',
          input(BrandInputSchema, body),
        ),
    },
    catalog: {
      listExercises: (orgId: string) => request(orgPath(orgId, '/exercises'), responses.exercises),
      createExercise: (orgId: string, body: B2BInputs['exercise']) =>
        request(
          orgPath(orgId, '/exercises'),
          responses.exercise,
          'POST',
          input(ExerciseInputSchema, body),
        ),
      updateExercise: (orgId: string, id: string, body: B2BInputs['exerciseUpdate']) =>
        request(
          orgPath(orgId, `/exercises/${segment(id)}`),
          responses.exercise,
          'PUT',
          input(ExerciseUpdateSchema, body),
        ),
      reviewExercise: (orgId: string, id: string, body: B2BInputs['revision']) =>
        request(
          orgPath(orgId, `/exercises/${segment(id)}/review`),
          responses.exercise,
          'POST',
          input(PublishSchema, body),
        ),
      publishExercise: (orgId: string, id: string, body: B2BInputs['revision']) =>
        request(
          orgPath(orgId, `/exercises/${segment(id)}/publish`),
          responses.exercise,
          'POST',
          input(PublishSchema, body),
        ),
    },
    equipment: {
      listMachines: (orgId: string) => request(orgPath(orgId, '/machines'), responses.machines),
      createMachine: (orgId: string, body: B2BInputs['machine']) =>
        request(
          orgPath(orgId, '/machines'),
          responses.machine,
          'POST',
          input(MachineInputSchema, body),
        ),
      updateMachine: (orgId: string, id: string, body: B2BInputs['machineUpdate']) =>
        request(
          orgPath(orgId, `/machines/${segment(id)}`),
          responses.machine,
          'PUT',
          input(MachineUpdateSchema, body),
        ),
      reviewMachine: (orgId: string, id: string, body: B2BInputs['revision']) =>
        request(
          orgPath(orgId, `/machines/${segment(id)}/review`),
          responses.machine,
          'POST',
          input(PublishSchema, body),
        ),
      publishMachine: (orgId: string, id: string, body: B2BInputs['revision']) =>
        request(
          orgPath(orgId, `/machines/${segment(id)}/publish`),
          responses.machine,
          'POST',
          input(PublishSchema, body),
        ),
      listUnits: (orgId: string) => request(orgPath(orgId, '/units'), responses.units),
      createUnit: (orgId: string, body: B2BInputs['unit']) =>
        request(orgPath(orgId, '/units'), responses.unit, 'POST', input(UnitInputSchema, body)),
      updateUnit: (orgId: string, id: string, body: B2BInputs['unitUpdate']) =>
        request(
          orgPath(orgId, `/units/${segment(id)}`),
          responses.unit,
          'PUT',
          input(UnitUpdateSchema, body),
        ),
      createUnitsBatch: (orgId: string, body: B2BInputs['unitBatch']) =>
        request(
          orgPath(orgId, '/units/batch'),
          responses.units,
          'POST',
          input(UnitBatchSchema, body),
        ),
    },
    programs: {
      list: (orgId: string) => request(orgPath(orgId, '/programs'), responses.programs),
      create: (orgId: string, body: B2BInputs['program']) =>
        request(
          orgPath(orgId, '/programs'),
          responses.program,
          'POST',
          input(ProgramInputSchema, body),
        ),
      update: (orgId: string, id: string, body: B2BInputs['programUpdate']) =>
        request(
          orgPath(orgId, `/programs/${segment(id)}`),
          responses.program,
          'PUT',
          input(ProgramUpdateSchema, body),
        ),
      publish: (orgId: string, id: string, body: B2BInputs['revision']) =>
        request(
          orgPath(orgId, `/programs/${segment(id)}/publish`),
          responses.programVersion,
          'POST',
          input(PublishSchema, body),
        ),
      version: (orgId: string, id: string, version: number) =>
        request(
          orgPath(orgId, `/programs/${segment(id)}/versions/${version}`),
          responses.programVersion,
        ),
    },
    assignments: {
      list: (orgId: string, memberId?: string) =>
        request(orgPath(orgId, `/assignments${memberQuery(memberId)}`), responses.assignments),
      create: (orgId: string, body: B2BInputs['assignment']) =>
        request(
          orgPath(orgId, '/assignments'),
          responses.assignment,
          'POST',
          input(ProgramAssignmentSchema, body),
        ),
    },
    executions: {
      list: (orgId: string, memberId?: string) =>
        request(orgPath(orgId, `/executions${memberQuery(memberId)}`), responses.executions),
      create: (orgId: string, body: B2BInputs['execution']) =>
        request(
          orgPath(orgId, '/executions'),
          responses.execution,
          'POST',
          input(ExecutionInputSchema, body),
        ),
    },
    reports: { get: (orgId: string) => request(orgPath(orgId, '/reports'), responses.report) },
    website: {
      get: (orgId: string) => request(orgPath(orgId, '/website'), responses.website),
      update: (orgId: string, body: B2BInputs['website']) =>
        request(
          orgPath(orgId, '/website'),
          responses.website,
          'PUT',
          input(WebsiteUpdateSchema, body),
        ),
      publish: (orgId: string, body: B2BInputs['revision']) =>
        request(
          orgPath(orgId, '/website/publish'),
          responses.website,
          'POST',
          input(PublishSchema, body),
        ),
      unpublish: (orgId: string, body: B2BInputs['revision']) =>
        request(
          orgPath(orgId, '/website/unpublish'),
          responses.website,
          'POST',
          input(PublishSchema, body),
        ),
    },
    setup: {
      progress: (orgId: string) =>
        request(orgPath(orgId, '/setup-progress'), responses.setupProgress),
    },
    media: {
      list: (orgId: string) => request(orgPath(orgId, '/media'), responses.mediaList),
      upload: (orgId: string, metadata: B2BInputs['media'], file: Blob) => {
        const query = new URLSearchParams(input(MediaUploadSchema, metadata))
        return request(orgPath(orgId, `/media?${query}`), responses.media, 'POST', file)
      },
    },
  }
}
/** Bind account identity once; scoped reads can be cancelled without affecting writes. */
export function createB2BClient(accountId?: string, options: ClientOptions = {}) {
  return {
    ...createEndpoints(accountId, options),
    withSignal: (signal: AbortSignal) => createEndpoints(accountId, { ...options, signal }),
  }
}
export type B2BClient = ReturnType<typeof createB2BClient>
export const b2bClient = createB2BClient()
