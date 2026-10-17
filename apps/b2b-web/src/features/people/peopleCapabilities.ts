import type {
  OrganizationRoleV2,
  ProductAccess,
  ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'

export const productRoleLabels: Record<OrganizationRoleV2, string> = {
  superadmin: 'Superadministrador',
  admin: 'Administrador',
  coach: 'Entrenador',
  member: 'Socio',
}
export function creatableRoles(access: ProductAccess): OrganizationRoleV2[] {
  if (
    access.accessMode !== 'active' ||
    !['admin', 'superadmin'].includes(access.role) ||
    !access.capabilities.includes('manage-people')
  )
    return []
  return access.role === 'superadmin' && access.capabilities.includes('manage-admins')
    ? ['member', 'coach', 'admin', 'superadmin']
    : ['member', 'coach']
}
export function canManagePerson(access: ProductAccess, person: ProductOutput<'people'>[number]) {
  return creatableRoles(access).includes(person.role)
}
