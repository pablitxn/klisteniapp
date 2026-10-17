import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, type ViteDevServer } from 'vite'
import { admin, superadmin, member } from './people/fixture.ts'
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
async function render(path: string, name: string, props: Record<string, unknown>) {
  const module = await vite.ssrLoadModule(`/src/features/${path}.tsx`)
  return renderToStaticMarkup(
    createElement(module[name] as ComponentType<Record<string, unknown>>, props),
  )
}
const noop = () => {}
const state = {
  people: [member],
  loading: false,
  busy: false,
  error: '',
  message: '',
  blocked: false,
  retry: false,
  refresh: false,
  invitation: null,
}
const props = {
  state,
  access: admin,
  branchId: 'atlas-principal',
  branchName: 'Principal',
  onUpdate: async () => null,
  onInvite: async () => null,
  onRefresh: noop,
  onRetry: noop,
  onDismissInvitation: noop,
  onAudit: noop,
}
function labelled(html: string) {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  assert.equal(new Set(ids).size, ids.length)
  for (const [, id] of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(id))
}

test('People editors have labelled role/grant controls, explicit saves and supported invitation scope', async () => {
  const html = await render('people/PeopleWorkspace', 'PeopleView', props)
  labelled(html)
  assert.match(html, /Rol en la marca de/)
  assert.match(html, /Entrenador en esta sede/)
  assert.match(html, /Socio en esta sede/)
  assert.match(html, /Guardar acceso de/)
  assert.match(html, /Los permisos de otras sedes se conservan/)
  assert.match(html, /varias funciones o sedes todavía no están disponibles/)
  assert.doesNotMatch(html, /<option[^>]*value="admin"/)
  assert.doesNotMatch(html, /<option[^>]*value="superadmin"/)
  assert.match(html, /Ver cambios de/)
})
test('trainers cannot manage/invite even with a stale broad capability and can inspect scoped planning changes', async () => {
  const html = await render('people/PeopleWorkspace', 'PeopleView', {
    ...props,
    access: { ...superadmin, role: 'coach' },
  })
  assert.doesNotMatch(html, /Editar acceso de|Invitar persona|Crear invitación|Guardar acceso de/)
  assert.match(html, /Consultar cambios de planificación/)
  assert.match(html, /ID del recurso de planificación/)
})
test('last-superadmin safeguards are explicit and role/membership controls remain disabled', async () => {
  const person = { ...member, role: 'superadmin' }
  const html = await render('people/PeopleWorkspace', 'PersonEditor', {
    person,
    branchId: 'atlas-principal',
    access: superadmin,
    disabled: false,
    lastSuperadmin: true,
    onUpdate: async () => null,
  })
  assert.match(html, /último superadministrador activo visible/)
  assert.match(html, /<select[^>]*disabled/)
  assert.match(html, /<input[^>]*type="checkbox"[^>]*disabled/)
  assert.match(html, /servidor vuelve a verificarlo/)
})
test('loading, blocked, empty, conflict and exact retry states announce outcomes without private stale data', async () => {
  const loading = await render('people/PeopleWorkspace', 'PeopleView', {
    ...props,
    state: { ...state, people: [], loading: true },
  })
  assert.match(loading, /role="status">Cargando personas/)
  const empty = await render('people/PeopleWorkspace', 'PeopleView', {
    ...props,
    state: { ...state, people: [] },
  })
  assert.match(empty, /No hay personas visibles/)
  const conflict = await render('people/PeopleWorkspace', 'PeopleView', {
    ...props,
    state: { ...state, error: 'Revisión rechazada', refresh: true, retry: true },
  })
  assert.match(conflict, /role="alert"/)
  assert.match(conflict, /Reintentar la misma operación/)
  assert.match(conflict, /Recargar no reemplaza tus campos/)
  const blocked = await render('people/PeopleWorkspace', 'PeopleView', {
    ...props,
    state: { ...state, blocked: true, error: 'Acceso revocado' },
  })
  assert.doesNotMatch(blocked, /member@example.test|Enlace privado|Invitar persona/)
})
test('audit presentation includes actual actor/resource/time/revisions and marks unknown historical metadata', async () => {
  const changes = [
    {
      id: 'audit',
      organizationId: 'atlas',
      branchId: 'atlas-principal',
      actorId: 'admin',
      action: 'membership.update',
      resourceId: 'member',
      operationId: 'operation',
      beforeRevision: 3,
      afterRevision: 4,
      changedFields: ['role', 'branchGrants'],
      createdAt: '2026-10-17T12:00:00Z',
    },
    {
      id: 'legacy',
      organizationId: 'atlas',
      branchId: null,
      actorId: null,
      action: 'legacy.unknown',
      resourceId: 'member',
      operationId: null,
      beforeRevision: null,
      afterRevision: null,
      changedFields: [],
      createdAt: '2026-10-16T12:00:00Z',
    },
  ]
  const html = await render('audit/AuditDrawer', 'AuditEntries', {
    changes,
    actors: [{ userId: 'admin', name: 'Actual Admin' }],
  })
  assert.match(html, /Actual Admin/)
  assert.match(html, /dateTime="2026-10-17T12:00:00Z"/i)
  assert.match(html, /Rol en la marca, Funciones por sede/)
  assert.match(html, /3 → 4/)
  assert.match(html, /Sistema/)
  const planning = await render('audit/AuditDrawer', 'AuditEntries', {
    changes: [
      { ...changes[0], action: 'routine.save', changedFields: ['draft', 'publishedVersion'] },
    ],
    actors: [],
  })
  assert.match(planning, /Rutina guardada/)
  assert.match(planning, /Borrador, Versión publicada/)
  assert.match(html, /histórico no conserva el detalle/)
  assert.match(html, /Ámbito de marca/)
  const dialog = await render('audit/AuditDrawer', 'AuditDrawer', {
    createClient: () => ({ call: async () => [] }),
    resourceId: 'routine',
    signal: new AbortController().signal,
    close: noop,
  })
  assert.match(dialog, /<dialog[^>]*aria-labelledby/)
  assert.match(dialog, /Cerrar cambios/)
  assert.match(dialog, /role="status">Cargando cambios/)
})
