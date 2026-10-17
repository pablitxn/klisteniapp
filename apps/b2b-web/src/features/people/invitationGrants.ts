import { ApiError } from '@klisteniapp/b2b-client'
import {
  ProductEndpoints,
  type ProductBootstrap,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import { peopleError, type PeopleContext } from './peopleModel.ts'
import { creatableRoles } from './peopleCapabilities.ts'

export type InvitationBranch = {
  organizationId: string
  branchId: string
  name: string
  status: 'active' | 'archived'
}
export type InvitationGrant = ProductInput<'inviteMember'>['branchGrants'][number]
/** Current guarded endpoint supplies only same-organization metadata, including
 * archived branches; no membership/Principal inference is needed. */
export function scopedInvitationBranches(
  context: PeopleContext,
  raw: ProductOutput<'invitationBranches'>,
): InvitationBranch[] {
  if (!context.access || !creatableRoles(context.access).length || context.signal.aborted)
    throw new ApiError('El contexto de acceso cambió.', 403, 'CONTEXT_REVOKED')
  const branches = ProductEndpoints.invitationBranches.output.parse(raw)
  if (branches.some((branch) => branch.organizationId !== context.organizationId))
    throw new ApiError('Las sedes no corresponden a esta organización.', 502, 'INVALID_RESPONSE')
  return branches
}
/** The current bootstrap deliberately lists active branch choices only. Never
 * reconstruct missing branches from a Principal convention, a typed ID or roster. */
export function invitationBranches(
  context: PeopleContext,
  bootstrap: ProductBootstrap,
): InvitationBranch[] {
  const membership = bootstrap.memberships.find((m) => m.organizationId === context.organizationId)
  if (
    !context.access ||
    !creatableRoles(context.access).length ||
    context.signal.aborted ||
    bootstrap.user.id !== context.accountId ||
    bootstrap.realm.key !== context.hostBinding ||
    !membership ||
    !membership.activated ||
    membership.accessMode !== 'active' ||
    membership.accessRevision !== context.access.accessRevision ||
    !membership.choices.some(
      (choice) => choice.branchId === context.branchId && choice.role === context.access?.role,
    )
  )
    throw new ApiError(
      'El contexto de acceso cambió. Recargá la lista y validá tu función.',
      403,
      'CONTEXT_REVOKED',
    )
  const unique = new Map<string, InvitationBranch>()
  for (const choice of membership.choices)
    unique.set(choice.branchId, {
      organizationId: membership.organizationId,
      branchId: choice.branchId,
      name: choice.name,
      status: 'active',
    })
  return [...unique.values()]
}
/** No implicit selection, sorting, role conversion or activation. The user's
 * chosen array order and explicit inactive entries are part of the request. */
export function selectInvitationGrant(
  grants: readonly InvitationGrant[],
  branchId: string,
  role: InvitationGrant['role'],
  state: 'none' | 'active' | 'inactive',
): InvitationGrant[] {
  const index = grants.findIndex((g) => g.branchId === branchId && g.role === role)
  const result = grants.map((g) => ({ ...g }))
  if (state === 'none') return result.filter((g) => g.branchId !== branchId || g.role !== role)
  const grant = { branchId, role, active: state === 'active' }
  if (index === -1) result.push(grant)
  else result[index] = grant
  return result
}

export function invitationError(error: unknown) {
  const failure = peopleError(error)
  if (error instanceof ApiError && error.code === 'NOT_FOUND')
    return {
      ...failure,
      refresh: true,
      message:
        'Una sede seleccionada no está disponible o cambió antes de aceptar la invitación. Recargá las sedes y revisá tu selección; no se agregan permisos alternativos.',
    }
  return failure
}
