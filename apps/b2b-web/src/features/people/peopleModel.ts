import type { InvitationBranch } from './invitationGrants.ts'
import { ApiError } from '@klisteniapp/b2b-client'
import {
  InviteProductMemberSchema,
  type ProductAccess,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import { creatableRoles } from './peopleCapabilities.ts'

export type Person = ProductOutput<'people'>[number]
export type PeopleContext = {
  accountId: string
  organizationId: string
  branchId: string
  hostBinding: string
  generation: string
  access: ProductAccess | null
  signal: AbortSignal
  requestSignal?: () => AbortSignal
}
export function peopleContextKey(context: PeopleContext) {
  return JSON.stringify([
    context.accountId,
    context.organizationId,
    context.branchId,
    context.hostBinding,
    context.generation,
    context.access,
  ])
}
export function peopleContextAllowed(context: PeopleContext) {
  const access = context.access
  return Boolean(
    !context.signal.aborted &&
      context.hostBinding &&
      context.generation &&
      context.branchId &&
      access &&
      access.userId === context.accountId &&
      access.organizationId === context.organizationId &&
      access.accessMode === 'active' &&
      access.role !== 'member' &&
      access.capabilities.includes('edit-planning'),
  )
}
export function currentBranchGrants(person: Person, branchId: string) {
  return {
    coach: person.branchGrants.some(
      (g) => g.branchId === branchId && g.role === 'coach' && g.active,
    ),
    member: person.branchGrants.some(
      (g) => g.branchId === branchId && g.role === 'member' && g.active,
    ),
  }
}
/** updateMember replaces the entire grant list. Preserve all other branch rows;
 * neither promotion nor editing the selected branch creates an implicit grant. */
export function replaceCurrentBranchGrants(
  person: Person,
  branchId: string,
  selected: { coach: boolean; member: boolean },
): Person['branchGrants'] {
  if (!branchId) throw new Error('Elegí una sede autorizada.')
  const grants = person.branchGrants.filter((g) => g.branchId !== branchId).map((g) => ({ ...g }))
  for (const role of ['coach', 'member'] as const) {
    if (
      selected[role] ||
      person.branchGrants.some((g) => g.branchId === branchId && g.role === role)
    )
      grants.push({ branchId, role, active: selected[role] })
  }
  return grants.sort((a, b) =>
    a.branchId < b.branchId
      ? -1
      : a.branchId > b.branchId
        ? 1
        : a.role < b.role
          ? -1
          : a.role > b.role
            ? 1
            : 0,
  )
}
export function lastVisibleSuperadmin(person: Person, roster: readonly Person[]) {
  return (
    person.active &&
    person.role === 'superadmin' &&
    roster.filter((p) => p.active && p.role === 'superadmin').length <= 1
  )
}
export function invitationInput(
  access: ProductAccess,
  branchId: string,
  values: {
    name: string
    email: string
    role: Person['role']
    branchGrants: ProductInput<'inviteMember'>['branchGrants']
  },
  ids: { id: string; operationId: string },
  availableBranches: readonly InvitationBranch[],
): ProductInput<'inviteMember'> {
  if (!branchId || !creatableRoles(access).includes(values.role))
    throw new Error('Tu función actual no permite esta invitación.')
  for (const grant of values.branchGrants) {
    const branch = availableBranches.find(
      (option) =>
        option.organizationId === access.organizationId && option.branchId === grant.branchId,
    )
    if (!branch)
      throw new Error(
        'Una sede seleccionada ya no está disponible. Recargá las sedes y revisá los permisos; no se modificó tu selección.',
      )
    if (grant.active && branch.status !== 'active')
      throw new Error(
        'Una sede archivada no admite funciones activas. Elegí explícitamente una función inactiva o quitá esa sede.',
      )
  }
  const parsed = InviteProductMemberSchema.safeParse({
    ...values,
    ...ids,
    expectedRevision: 0,
    branchGrants: values.branchGrants.map((grant) => ({ ...grant })),
  })
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    throw new Error(
      field === 'name'
        ? 'Ingresá un nombre válido para la persona invitada.'
        : field === 'email'
          ? 'Ingresá un email válido para la persona invitada.'
          : 'Revisá el rol y los permisos: cada combinación de sede y función debe aparecer una sola vez.',
    )
  }
  return parsed.data
}
export function peopleError(error: unknown): {
  message: string
  uncertain: boolean
  refresh: boolean
} {
  if (error instanceof ApiError) {
    if (error.status === 0 || error.status >= 500)
      return {
        message:
          'No pudimos confirmar la respuesta. Reintentá la misma operación para comprobar si se guardó; no se creará otra.',
        uncertain: true,
        refresh: false,
      }
    const messages: Record<string, string> = {
      LAST_SUPERADMIN:
        'La marca debe conservar un superadministrador activo. El cambio fue rechazado.',
      REVISION_CONFLICT:
        'Otra persona cambió este acceso. Tus campos se conservan: recargá la lista y revisá la versión actual antes de volver a guardar.',
      OPERATION_CONFLICT:
        'Esta operación ya se usó con otros datos. Recargá y revisá el estado actual.',
      FORBIDDEN:
        'Tu función seleccionada no permite este cambio. Recargá para validar tus permisos.',
      BRANCH_FORBIDDEN: 'Ya no tenés acceso a la sede seleccionada.',
      CONTEXT_REVOKED: 'El acceso cambió. Volvé a validar tu sede y función.',
      NOT_FOUND: 'La persona o el recurso no está disponible en esta organización y sede.',
      MEMBERSHIP_REQUIRED: 'Tu membresía en esta organización cambió.',
      UNAUTHENTICATED: 'La sesión finalizó. Iniciá sesión para continuar.',
      BRAND_SESSION_REQUIRED:
        'Iniciá sesión en la marca de esta invitación para validar el acceso.',
      UNIFIED_SESSION_REQUIRED: 'Iniciá sesión en este espacio para validar la invitación.',
      ACCOUNT_CHANGED: 'La cuenta cambió. Volvé a validar tu identidad antes de continuar.',
      NEW_ACCOUNT_REQUIRED: 'La persona invitada debe completar su propia activación de cuenta.',
      INVALID_INVITATION:
        'La invitación es inválida, venció o ya se usó. Pedí una nueva invitación a una persona autorizada.',
      MEMBERSHIP_EXISTS:
        'Esta persona ya tiene una membresía. Gestioná su acceso desde Personas; una invitación no puede promoverla ni reactivarla.',
      EXISTING_ACCOUNT:
        'Esta persona ya tiene una cuenta B2B. Debe aceptar con su propia contraseña y consentimiento; no se reemplaza su cuenta.',
      BRANCH_ARCHIVED:
        'Una sede seleccionada fue archivada. Recargá las sedes y revisá los permisos de la invitación.',
      GYM_SERVICE_INACTIVE: 'El servicio de la marca está suspendido. No se guardó el cambio.',
    }
    return {
      message: messages[error.code ?? ''] ?? error.message,
      uncertain: false,
      refresh: [401, 403, 409].includes(error.status),
    }
  }
  return {
    message: error instanceof Error ? error.message : 'No pudimos completar la operación.',
    uncertain: false,
    refresh: false,
  }
}
