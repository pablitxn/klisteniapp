import type { Branch } from '@klisteniapp/b2b-contracts'
export type BranchDraft = Pick<Branch, 'name' | 'address' | 'contact' | 'timezone' | 'status'>
export function branchDraft(branch: Branch): BranchDraft {
  return {
    name: branch.name,
    address: branch.address,
    contact: branch.contact,
    timezone: branch.timezone,
    status: branch.status,
  }
}
export function isBranchDraft(value: unknown): value is BranchDraft {
  if (!value || typeof value !== 'object') return false
  return (
    ['name', 'address', 'contact', 'timezone'].every(
      (key) => key in value && typeof value[key as keyof typeof value] === 'string',
    ) &&
    'status' in value &&
    (value.status === 'active' || value.status === 'archived')
  )
}
