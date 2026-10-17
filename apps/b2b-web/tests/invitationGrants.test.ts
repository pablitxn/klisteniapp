import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { ApiError, type ProductV2Client } from '@klisteniapp/b2b-client'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, type ViteDevServer } from 'vite'
import {
  invitationBranches,
  invitationError,
  selectInvitationGrant,
} from '../src/features/people/invitationGrants.ts'
import { invitationInput } from '../src/features/people/peopleModel.ts'
import { PeopleController } from '../src/features/people/peopleController.ts'
import {
  admin,
  superadmin,
  context,
  member,
  branchOptions,
  bootstrapFor,
  deferred,
} from './people/fixture.ts'

let vite: ViteDevServer
before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
    logLevel: 'error',
  })
})
after(async () => {
  await vite?.close()
})
async function render(name: string, file: string, props: Record<string, unknown>) {
  const module = await vite.ssrLoadModule(`/src/features/people/${file}.tsx`)
  return renderToStaticMarkup(
    createElement(module[name] as ComponentType<Record<string, unknown>>, props),
  )
}
const values = { name: 'New user', email: 'user@example.test', role: 'member' as const }
const ids = { id: 'invite', operationId: 'operation' }
const mixed = [
  { branchId: 'atlas-north', role: 'coach' as const, active: false },
  { branchId: 'atlas-principal', role: 'member' as const, active: true },
  { branchId: 'atlas-north', role: 'member' as const, active: true },
]

test('authenticated branch choices are scoped to exact identity, realm, membership revision and selected role', () => {
  const scope = context(),
    boot = bootstrapFor(scope)
  assert.deepEqual(invitationBranches(scope, boot), branchOptions)
  for (const bad of [
    { ...boot, user: { ...boot.user, id: 'foreign' } },
    { ...boot, realm: { ...boot.realm, key: 'foreign-realm' } },
    { ...boot, memberships: boot.memberships.filter((m) => m.organizationId !== 'atlas') },
    {
      ...boot,
      memberships: boot.memberships.map((m) =>
        m.organizationId === 'atlas' ? { ...m, accessRevision: 99 } : m,
      ),
    },
    {
      ...boot,
      memberships: boot.memberships.map((m) =>
        m.organizationId === 'atlas' ? { ...m, choices: [] } : m,
      ),
    },
  ])
    assert.throws(() => invitationBranches(scope, bad))
  assert.ok(invitationBranches(scope, boot).every((b) => b.organizationId === 'atlas'))
  assert.throws(() =>
    invitationBranches(
      context({ ...superadmin, role: 'coach' }),
      bootstrapFor(context({ ...superadmin, role: 'coach' })),
    ),
  )
})
test('mixed multi-branch and privileged invitations retain the exact array and explicit inactive states', () => {
  const before = structuredClone(mixed)
  const input = invitationInput(
    admin,
    'atlas-principal',
    { ...values, branchGrants: mixed },
    ids,
    branchOptions,
  )
  assert.deepEqual(input.branchGrants, mixed)
  assert.deepEqual(mixed, before)
  assert.deepEqual(
    invitationInput(
      superadmin,
      'atlas-principal',
      { ...values, role: 'admin', branchGrants: mixed },
      ids,
      branchOptions,
    ).branchGrants,
    mixed,
  )
  assert.deepEqual(
    invitationInput(
      admin,
      'atlas-principal',
      { ...values, role: 'coach', branchGrants: [] },
      ids,
      branchOptions,
    ).branchGrants,
    [],
  )
  const selected = selectInvitationGrant(
    selectInvitationGrant([], 'atlas-north', 'coach', 'inactive'),
    'atlas-principal',
    'member',
    'active',
  )
  assert.deepEqual(selected, mixed.slice(0, 2))
  assert.deepEqual(selectInvitationGrant(selected, 'atlas-north', 'coach', 'none'), [mixed[1]])
})
test('foreign, duplicate, missing and archived active grants fail without dropping or widening the selection', () => {
  for (const grants of [
    [...mixed, mixed[0]],
    [{ branchId: 'sur-principal', role: 'member' as const, active: true }],
  ])
    assert.throws(() =>
      invitationInput(
        admin,
        'atlas-principal',
        { ...values, branchGrants: grants },
        ids,
        branchOptions,
      ),
    )
  const missing = branchOptions.filter((b) => b.branchId !== 'atlas-north')
  assert.throws(
    () =>
      invitationInput(admin, 'atlas-principal', { ...values, branchGrants: mixed }, ids, missing),
    /ya no está disponible/,
  )
  const archived = branchOptions.map((b) =>
    b.branchId === 'atlas-north' ? { ...b, status: 'archived' as const } : b,
  )
  assert.throws(
    () =>
      invitationInput(admin, 'atlas-principal', { ...values, branchGrants: mixed }, ids, archived),
    /archivada/,
  )
  assert.deepEqual(
    invitationInput(
      admin,
      'atlas-principal',
      { ...values, branchGrants: [mixed[0]] },
      ids,
      archived,
    ).branchGrants,
    [mixed[0]],
  )
  assert.deepEqual(mixed[0], { branchId: 'atlas-north', role: 'coach', active: false })
})
test('branch discovery is live and stale or revoked replies cannot repopulate the invitation catalog', async () => {
  const scope = context(),
    late = deferred<ReturnType<typeof bootstrapFor>>()
  const client = { call: async () => [member] } as ProductV2Client
  let count = 0
  const controller = new PeopleController(
    scope,
    () => client,
    async () =>
      ++count === 1
        ? late.promise
        : {
            ...bootstrapFor(scope),
            memberships: bootstrapFor(scope).memberships.map((m) =>
              m.organizationId === 'atlas'
                ? { ...m, choices: m.choices.filter((c) => c.branchId !== 'atlas-north') }
                : m,
            ),
          },
  )
  const old = controller.loadBranches()
  await controller.loadBranches()
  late.resolve(bootstrapFor(scope))
  await old
  assert.equal(
    controller.getSnapshot().branches.some((b) => b.branchId === 'atlas-north'),
    false,
  )
  const revoked = new PeopleController(
    scope,
    () => client,
    async () => ({ ...bootstrapFor(scope), user: { ...bootstrapFor(scope).user, id: 'foreign' } }),
  )
  await revoked.load()
  assert.equal(revoked.getSnapshot().branchesValid, false)
  assert.deepEqual(revoked.getSnapshot().people, [])
  assert.equal(revoked.getSnapshot().blocked, true)
})
test('explicit grant replay freezes the array through lost response and reports changed-operation conflict without silent retry', async () => {
  const sent: unknown[] = []
  const client = {
    call: async (key: string, input: unknown) => {
      if (key === 'people') return [member]
      sent.push(structuredClone(input))
      if (sent.length === 1) throw new ApiError('Lost response', 0, 'NETWORK_ERROR')
      throw new ApiError('Operation changed', 409, 'OPERATION_CONFLICT')
    },
  } as ProductV2Client
  const controller = new PeopleController(context(), () => client)
  await controller.load()
  const input = invitationInput(
    admin,
    'atlas-principal',
    { ...values, branchGrants: mixed },
    ids,
    branchOptions,
  )
  await controller.invite(input)
  input.branchGrants[0].active = true
  assert.equal(await controller.invite({ ...input, operationId: 'different' }), null)
  await controller.retry()
  assert.deepEqual(sent[0], sent[1])
  assert.equal(sent.length, 2)
  assert.match(controller.getSnapshot().error, /operación ya se usó/)
  assert.equal(controller.getSnapshot().retry, false)
})
test('admission failures explain existing membership/account, expired invite and branch/realm revocation', () => {
  for (const code of [
    'INVALID_INVITATION',
    'MEMBERSHIP_EXISTS',
    'EXISTING_ACCOUNT',
    'BRAND_SESSION_REQUIRED',
    'UNIFIED_SESSION_REQUIRED',
    'NEW_ACCOUNT_REQUIRED',
    'NOT_FOUND',
  ]) {
    const result = invitationError(
      new ApiError('Original code', code.includes('SESSION') ? 401 : 409, code),
    )
    assert.notEqual(result.message, 'Original code')
    assert.equal(result.uncertain, false)
  }
})
test('invitation controls label both roles and all three explicit states on every branch without defaulting a grant', async () => {
  const html = await render('InvitationGrantEditor', 'InvitationGrantEditor', {
    branches: branchOptions,
    grants: mixed,
    disabled: false,
    onChange: () => {},
  })
  assert.equal((html.match(/<select/g) ?? []).length, 6)
  assert.match(html, /Entrenador en North/)
  assert.match(html, /Socio en Principal/)
  assert.match(html, /value="inactive" selected=""/)
  assert.match(html, /value="active" selected=""/)
  assert.match(html, /Ninguna sede o función se agrega automáticamente/)
  const empty = await render('InvitationEditor', 'PeopleWorkspace', {
    access: admin,
    branchId: 'atlas-principal',
    branches: branchOptions,
    branchesLoading: false,
    branchesValid: true,
    branchesError: '',
    disabled: false,
    onInvite: async () => null,
    onReloadBranches: () => {},
  })
  assert.match(empty, /Confirmo que esta invitación no incluirá funciones por sede/)
  assert.match(empty, /Sin funciones por sede/)
  assert.doesNotMatch(empty, /value="active" selected=""/)
  assert.match(empty, /no agrega funciones de entrenador\/socio ni acceso a salud compartida/)
})
test('revoked selection remains visible for explicit removal and catalog errors never masquerade as success', async () => {
  const html = await render('InvitationGrantEditor', 'InvitationGrantEditor', {
    branches: [],
    grants: [mixed[0]],
    disabled: false,
    onChange: () => {},
  })
  assert.match(html, /role="alert"/)
  assert.match(html, /atlas-north/)
  assert.match(html, /Quitar explícitamente Entrenador/)
  const failed = await render('InvitationEditor', 'PeopleWorkspace', {
    access: admin,
    branchId: 'atlas-principal',
    branches: [],
    branchesLoading: false,
    branchesValid: false,
    branchesError: 'Sedes revocadas',
    disabled: false,
    onInvite: async () => null,
    onReloadBranches: () => {},
  })
  assert.match(failed, /Sedes revocadas/)
  assert.match(failed, /Crear invitación/)
  assert.match(failed, /<button[^>]*disabled="">Crear invitación/)
})
